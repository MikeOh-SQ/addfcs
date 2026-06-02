const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

loadEnvFile(path.join(__dirname, ".env"));

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const imagesDir = path.join(rootDir, "images");
const newImagesDir = path.join(rootDir, "newimages");
const dsmImagesDir = path.join(rootDir, "dsmimages");
const gameImagesDir = path.join(rootDir, "game", "images");
const gameScriptsDir = path.join(rootDir, "game", "scripts");
const test1ImagesDir = path.join(rootDir, "game", "test1");
const test2ImagesDir = path.join(rootDir, "game", "test2");
const test3ImagesDir = path.join(rootDir, "game", "test3");
const configDir = path.join(rootDir, "config");
const databaseDir = path.join(rootDir, "database");
const designMdDir = path.join(rootDir, "designmd");
const mapLayoutFilePath = path.join(databaseDir, "map-layout.json");
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

fs.mkdirSync(databaseDir, { recursive: true });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeJoin(base, target) {
  const resolved = path.normalize(path.join(base, target));
  if (!resolved.startsWith(base)) {
    throw new Error("Invalid path");
  }
  return resolved;
}

function getRecordFilePath(fileName) {
  if (
    typeof fileName !== "string"
    || path.basename(fileName) !== fileName
    || !fileName.endsWith(".json")
    || fileName === "map-layout.json"
  ) {
    const error = new Error("Record not found");
    error.code = "ENOENT";
    throw error;
  }
  return path.join(databaseDir, fileName);
}

function getMapAssetVersion() {
  const files = [
    path.join(publicDir, "map", "index.html"),
    path.join(publicDir, "map", "map.js"),
    path.join(publicDir, "map", "map.css")
  ];
  const latestMtime = files.reduce((latest, filePath) => {
    if (!fs.existsSync(filePath)) {
      return latest;
    }
    return Math.max(latest, fs.statSync(filePath).mtimeMs);
  }, 0);
  return String(Math.floor(latestMtime || Date.now()));
}

function extractFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : "";
}

function parseDesignScalar(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  return trimmed;
}

function parseIndentedYamlBlock(source) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  const lines = String(source || "").split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const indent = line.match(/^\s*/)?.[0]?.length || 0;
    const trimmed = line.trim();
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;
    if (!rawValue) {
      parent[key] = {};
      stack.push({ indent, obj: parent[key] });
      continue;
    }

    parent[key] = parseDesignScalar(rawValue);
  }

  return root;
}

function getTokenPathValue(source, tokenPath) {
  return String(tokenPath || "")
    .split(".")
    .reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), source);
}

function resolveTokenReferences(value, tokenSource) {
  if (Array.isArray(value)) {
    return value.map((item) => resolveTokenReferences(item, tokenSource));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, itemValue]) => [key, resolveTokenReferences(itemValue, tokenSource)])
    );
  }
  if (typeof value !== "string") {
    return value;
  }

  const tokenMatch = value.match(/^\{(.+)\}$/);
  if (!tokenMatch) {
    return value;
  }

  const resolved = getTokenPathValue(tokenSource, tokenMatch[1]);
  return resolved === undefined ? value : resolved;
}

function makeDesignSlug(fileName) {
  return String(fileName || "")
    .replace(/^design-/i, "")
    .replace(/\.md$/i, "")
    .trim()
    .toLowerCase();
}

function parseDesignThemeFile(fileName) {
  const filePath = safeJoin(designMdDir, fileName);
  const raw = fs.readFileSync(filePath, "utf-8");
  const frontMatter = parseIndentedYamlBlock(extractFrontMatter(raw));
  const resolved = resolveTokenReferences(frontMatter, frontMatter);

  return {
    slug: makeDesignSlug(fileName),
    fileName,
    filePath,
    name: frontMatter.name || makeDesignSlug(fileName),
    version: frontMatter.version || "unknown",
    description: frontMatter.description || "",
    tokens: frontMatter,
    resolved
  };
}

function listDesignThemes() {
  if (!fs.existsSync(designMdDir)) {
    return [];
  }

  return fs.readdirSync(designMdDir)
    .filter((fileName) => /^design-.*\.md$/i.test(fileName))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => parseDesignThemeFile(fileName));
}

function serveStatic(reqPath, res) {
  const baseDir = reqPath.startsWith("/images/")
    ? imagesDir
    : reqPath.startsWith("/newimages/")
      ? newImagesDir
      : reqPath.startsWith("/dsmimages/")
        ? dsmImagesDir
      : reqPath.startsWith("/game/images/")
        ? gameImagesDir
        : reqPath.startsWith("/game/scripts/")
          ? gameScriptsDir
          : reqPath.startsWith("/test1/images/")
            ? test1ImagesDir
            : reqPath.startsWith("/test1/events/")
              ? test1ImagesDir
            : reqPath.startsWith("/test2/images/")
              ? test2ImagesDir
              : reqPath.startsWith("/test2/events/")
                ? test2ImagesDir
                : reqPath.startsWith("/test3/images/")
                  ? test3ImagesDir
                  : reqPath.startsWith("/test3/events/")
                    ? test3ImagesDir
      : publicDir;
  const relativePath = reqPath === "/"
    ? "index.html"
    : reqPath.startsWith("/images/")
      ? reqPath.replace("/images/", "")
      : reqPath.startsWith("/newimages/")
        ? reqPath.replace("/newimages/", "")
      : reqPath.startsWith("/dsmimages/")
        ? reqPath.replace("/dsmimages/", "")
      : reqPath.startsWith("/game/images/")
        ? reqPath.replace("/game/images/", "")
      : reqPath.startsWith("/game/scripts/")
        ? reqPath.replace("/game/scripts/", "")
      : reqPath.startsWith("/test1/images/")
        ? reqPath.replace("/test1/images/", "")
      : reqPath.startsWith("/test1/events/")
        ? reqPath.replace("/test1/events/", "")
      : reqPath.startsWith("/test2/images/")
        ? reqPath.replace("/test2/images/", "")
      : reqPath.startsWith("/test2/events/")
        ? reqPath.replace("/test2/events/", "")
      : reqPath.startsWith("/test3/images/")
        ? reqPath.replace("/test3/images/", "")
      : reqPath.startsWith("/test3/events/")
        ? reqPath.replace("/test3/events/", "")
      : reqPath.slice(1);
  let filePath;

  try {
    filePath = safeJoin(baseDir, relativePath);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    "Content-Type": mimeTypes[ext] || "application/octet-stream"
  };
  if (((reqPath === "/" || reqPath === "/index.html" || reqPath === "/app.js" || reqPath === "/styles.css")
    || reqPath.startsWith("/test1")
    || reqPath.startsWith("/test2")
    || reqPath.startsWith("/test3")
    || reqPath.startsWith("/map")
    || reqPath.startsWith("/analysis")
    || reqPath.startsWith("/plangame")
    || reqPath.startsWith("/dtx"))
    && [".html", ".js", ".css"].includes(ext)) {
    headers["Cache-Control"] = "no-store";
  }

  if (reqPath.startsWith("/map") && path.basename(filePath) === "index.html") {
    const html = fs.readFileSync(filePath, "utf-8").replaceAll("__MAP_ASSET_VERSION__", getMapAssetVersion());
    res.writeHead(200, headers);
    res.end(html);
    return;
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

function getRecordMeta(fileName) {
  const filePath = getRecordFilePath(fileName);
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  return {
    fileName,
    id: parsed.id,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    currentStep: parsed.currentStep || "intro"
  };
}

function mergeResearchUsage(existingUsage, incomingUsage) {
  const sessions = new Map();
  const appendSessions = (usage) => {
    if (!Array.isArray(usage?.sessions)) {
      return;
    }
    for (const candidate of usage.sessions) {
      if (!candidate || typeof candidate.sessionId !== "string") {
        continue;
      }
      const prior = sessions.get(candidate.sessionId);
      if (!prior) {
        sessions.set(candidate.sessionId, candidate);
        continue;
      }
      const activities = [...(prior.activities || []), ...(candidate.activities || [])];
      const dedupedActivities = Array.from(
        new Map(activities.map((activity) => [JSON.stringify(activity), activity])).values()
      );
      const latestActivityAt = [prior.lastActivityAt, candidate.lastActivityAt].filter(Boolean).sort();
      sessions.set(candidate.sessionId, {
        ...prior,
        ...candidate,
        lastActivityAt: latestActivityAt[latestActivityAt.length - 1],
        durationMs: Math.max(Number(prior.durationMs || 0), Number(candidate.durationMs || 0)),
        activities: dedupedActivities
      });
    }
  };

  appendSessions(existingUsage);
  appendSessions(incomingUsage);
  return {
    version: 1,
    sessions: Array.from(sessions.values()).sort((a, b) => String(a.connectedAt).localeCompare(String(b.connectedAt)))
  };
}

function saveRecord(filePath, incomingRecord, writer = "main") {
  let existingRecord = null;
  if (fs.existsSync(filePath)) {
    existingRecord = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  const mergedRecord = {
    ...incomingRecord
  };
  if (existingRecord && writer !== "dtx") {
    for (const field of ["dtx", "planGame", "tutorials"]) {
      if (Object.prototype.hasOwnProperty.call(existingRecord, field)) {
        mergedRecord[field] = existingRecord[field];
      }
    }
  }
  const researchUsage = mergeResearchUsage(existingRecord?.researchUsage, incomingRecord?.researchUsage);
  if (researchUsage.sessions.length) {
    mergedRecord.researchUsage = researchUsage;
  }
  fs.writeFileSync(filePath, JSON.stringify(mergedRecord, null, 2));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toRatio(value, total) {
  if (!total) {
    return 0;
  }
  return Number((value / total).toFixed(2));
}

function formatPercent(ratio) {
  return `${Math.round((Number(ratio) || 0) * 100)}%`;
}

function formatCount(value) {
  return Number.isFinite(Number(value)) ? `${Number(value)}회` : null;
}

function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function getAsrsResponses(record) {
  const raw = record.tests?.asrs || record.tests?.asar || [];
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === "number" ? item : Number(item?.answer))).filter((value) => Number.isFinite(value));
  }
  if (Array.isArray(raw?.responses)) {
    return raw.responses.map((item) => Number(item)).filter((value) => Number.isFinite(value));
  }
  return [];
}

function getDsmResponses(record) {
  const raw = record.tests?.dsm5 || [];
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === "boolean" ? item : item?.answer)).filter((value) => typeof value === "boolean");
  }
  if (Array.isArray(raw?.responses)) {
    return raw.responses.filter((value) => typeof value === "boolean");
  }
  return [];
}

function analyzeDsmRecord(record) {
  const raw = record.tests?.dsm5;
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    const answeredCount = Array.isArray(raw.responses)
      ? raw.responses.filter((value) => typeof value === "boolean").length
      : Number(raw.inattention_true_count || 0) + Number(raw.hyperactivity_true_count || 0);
    return {
      answeredCount,
      inattentionYesCount: Number(raw.inattention_true_count || 0),
      hyperactivityYesCount: Number(raw.hyperactivity_true_count || 0),
      contextualYesCount: Number(raw.contextual_true_count || 0),
      totalYesCount: Number(raw.total_true_count || 0),
      subtype: raw.subtype || "패턴 확인 중"
    };
  }

  const dsmAnswers = record.tests?.dsm5 || [];
  const answered = dsmAnswers.filter((item) => typeof item?.answer === "boolean");
  const inattentionYesCount = answered.slice(0, 9).filter((item) => item.answer).length;
  const hyperactivityYesCount = answered.slice(9).filter((item) => item.answer).length;
  const contextualYesCount = answered.slice(18).filter((item) => item.answer).length;

  let subtype = "패턴 확인 중";
  if (answered.length >= 18) {
    if (inattentionYesCount >= 6 && hyperactivityYesCount >= 6) {
      subtype = "복합 실행 기능 패턴";
    } else if (inattentionYesCount >= 6) {
      subtype = "집중 유지 부담 패턴";
    } else if (hyperactivityYesCount >= 6) {
      subtype = "반응 조절 부담 패턴";
    } else {
      subtype = "큰 부담 낮음";
    }
  }

  return {
    answeredCount: answered.length,
    inattentionYesCount,
    hyperactivityYesCount,
    contextualYesCount,
    totalYesCount: answered.filter((item) => item.answer).length,
    subtype
  };
}

function computeAssessmentMetrics(record) {
  const asrsAnswers = getAsrsResponses(record);
  const dsm = analyzeDsmRecord(record);
  const hasAsrsSurvey = asrsAnswers.length > 0;
  const hasDsmSurvey = getDsmResponses(record).length > 0 || Number(dsm.answeredCount || 0) > 0;
  const surveyMode = hasAsrsSurvey && hasDsmSurvey
    ? "both"
    : hasAsrsSurvey
      ? "asrs"
      : hasDsmSurvey
        ? "dsm"
        : "none";
  const game = record.tests?.game || {};
  const signal = game.tests?.signal_detection || {};
  const goNogo = game.tests?.go_nogo || {};
  const balance = game.tests?.balance_hold || {};

  const asrsAverage = asrsAnswers.length
    ? asrsAnswers.reduce((sum, value) => sum + value, 0) / asrsAnswers.length
    : 0;
  const asrsPositiveCount = asrsAnswers.filter((answer, index) => {
    const threshold = index < 3 ? 2 : 3;
    return answer >= threshold;
  }).length;
  const attentionPositiveCount = asrsAnswers.slice(0, 4).filter((answer, index) => {
    const threshold = index < 3 ? 2 : 3;
    return answer >= threshold;
  }).length;
  const impulsePositiveCount = asrsAnswers.slice(4).filter((answer) => answer >= 3).length;
  const dsmYesCount = dsm.totalYesCount;

  const attention = clamp(92 - attentionPositiveCount * 14 - asrsAverage * 6, 20, 95);
  const executive = clamp(90 - attentionPositiveCount * 15 - asrsAverage * 7, 18, 92);
  const impulse = clamp(88 - impulsePositiveCount * 18 - dsm.hyperactivityYesCount * 7 - dsmYesCount * 2, 20, 90);
  const emotion = clamp(84 - dsmYesCount * 4 - impulsePositiveCount * 8 - asrsAverage * 3, 18, 88);
  const structure = clamp(88 - attentionPositiveCount * 12 - asrsAverage * 6, 20, 90);
  const asrsAttentionScore = asrsAnswers.slice(0, 4).reduce((sum, value) => sum + value, 0);
  const asrsImpulseScore = asrsAnswers.slice(4).reduce((sum, value) => sum + value, 0);
  const omissionRate = Number(
    (signal.omission_rate
      ?? toRatio(signal.omission_errors || 0, signal.target_count || 0))
      .toFixed(2)
  );
  const commissionRate = Number(
    (goNogo.commission_rate
      ?? goNogo.inhibition_failure_rate
      ?? toRatio(goNogo.commission_errors || 0, goNogo.nogo_count || 0))
      .toFixed(2)
  );
  const reactionVariability = Number(signal.reaction_time_variability || 0);
  const tau = Number(signal.tau || 0);
  const latePhaseDrop = Number(signal.late_phase_drop || signal.sustained_attention_drop || 0);
  const fastErrorRate = Number(goNogo.fast_error_rate || 0);
  const meanGoReactionTime = Number(goNogo.mean_go_reaction_time || 0);
  const stableDurationPct = Number(balance.stable_duration_pct || 0);
  const spikeCount = Number(balance.spike_count ?? balance.large_motion_count ?? 0);
  const signalHasDetail = Number.isFinite(Number(signal.target_count))
    || Number.isFinite(Number(signal.hit_count))
    || Number.isFinite(Number(signal.omission_errors));
  const goNogoHasDetail = Number.isFinite(Number(goNogo.go_count))
    || Number.isFinite(Number(goNogo.commission_errors))
    || Number.isFinite(Number(goNogo.premature_response_count));
  const balanceHasDetail = Number.isFinite(Number(balance.stable_duration_pct))
    || Number.isFinite(Number(balance.spike_count))
    || Number.isFinite(Number(balance.large_motion_count));
  const objectiveDomain = omissionRate >= commissionRate ? "부주의" : "충동성";
  const subjectiveDomain = hasAsrsSurvey
    ? (attentionPositiveCount >= impulsePositiveCount ? "부주의" : "충동성")
    : hasDsmSurvey
      ? (dsm.inattentionYesCount >= dsm.hyperactivityYesCount ? "부주의" : "충동성")
      : objectiveDomain;
  const alignment = Math.abs(omissionRate - commissionRate) < 0.12 && attentionPositiveCount === impulsePositiveCount
    ? "혼합"
    : subjectiveDomain === objectiveDomain
      ? "일치"
      : "불일치";
  const dsmImpactScore = hasDsmSurvey
    ? dsm.totalYesCount + dsm.contextualYesCount * 2
    : asrsPositiveCount;
  const dailyImpactLevel = Math.max(1, Math.min(5, Math.ceil(dsmImpactScore / 4) || 1));

  const surveySeverityHigh = (hasAsrsSurvey && asrsPositiveCount >= 4)
    || (hasDsmSurvey && (dsm.inattentionYesCount >= 6 || dsm.hyperactivityYesCount >= 6 || dsmYesCount >= 8));
  const surveySeverityMedium = (hasAsrsSurvey && asrsPositiveCount >= 2)
    || (hasDsmSurvey && dsmYesCount >= 4);
  const severity = surveySeverityHigh
    ? "높음"
    : surveySeverityMedium
      ? "중간"
      : "낮음";

  const metrics = {
    surveyMode,
    hasAsrsSurvey,
    hasDsmSurvey,
    asrsAverage: Number(asrsAverage.toFixed(2)),
    asrsPositiveCount,
    attentionPositiveCount,
    hyperactivityPositiveCount: impulsePositiveCount,
    dsmYesCount,
    dsmInattentionYesCount: dsm.inattentionYesCount,
    dsmHyperactivityYesCount: dsm.hyperactivityYesCount,
    dsmContextualYesCount: dsm.contextualYesCount || 0,
    dsmSubtype: dsm.subtype,
    severity,
    asrsAttentionScore,
    asrsImpulseScore,
    omissionRate,
    commissionRate,
    reactionVariability,
    tau,
    latePhaseDrop,
    fastErrorRate,
    meanGoReactionTime,
    stableDurationPct,
    spikeCount,
    subjectiveDomain,
    objectiveDomain,
    alignment,
    dailyImpactLevel,
    signalHasDetail,
    goNogoHasDetail,
    balanceHasDetail,
    signal,
    goNogo,
    balance,
    scores: {
      attention,
      executive,
      impulse,
      emotion,
      structure
    }
  };
  metrics.burdenPattern = buildBurdenPattern(metrics);
  return metrics;
}

const analysisOldCutoff = process.env.ANALYSIS_OLD_CUTOFF || "2026-06-01T00:00:00.000Z";

function isExplicitOldRecord(record, fileName) {
  const haystack = [
    fileName,
    record?.id,
    record?.old,
    record?.isOld,
    record?.dataset,
    record?.dataSet,
    record?.group,
    record?.source,
    record?.cohort,
    ...(Array.isArray(record?.tags) ? record.tags : [])
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).toLowerCase());

  return haystack.some((value) => value === "old" || value.includes("old-data") || value.includes("old_data"));
}

function isOldAnalysisRecord(record, fileName) {
  if (isExplicitOldRecord(record, fileName)) {
    return true;
  }

  const createdAt = Date.parse(record?.createdAt || "");
  const cutoff = Date.parse(analysisOldCutoff);
  return Number.isFinite(createdAt) && Number.isFinite(cutoff) && createdAt < cutoff;
}

function readAnalysisRecords() {
  return fs.readdirSync(databaseDir)
    .filter((fileName) => fileName.endsWith(".json") && fileName !== "map-layout.json")
    .map((fileName) => {
      try {
        const filePath = path.join(databaseDir, fileName);
        const record = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return {
          fileName,
          record,
          createdAt: record.createdAt || "",
          updatedAt: record.updatedAt || record.createdAt || "",
          excludedAsOld: isOldAnalysisRecord(record, fileName)
        };
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function getAnalysisUserKey(item) {
  return String(item?.record?.id || item?.fileName || "").trim().toLowerCase();
}

function latestItemsByUser(items) {
  const latest = new Map();
  for (const item of items) {
    const key = getAnalysisUserKey(item);
    if (!key) {
      continue;
    }
    const previous = latest.get(key);
    const previousDate = Date.parse(previous?.updatedAt || previous?.createdAt || "");
    const itemDate = Date.parse(item.updatedAt || item.createdAt || "");
    if (!previous || (Number.isFinite(itemDate) && (!Number.isFinite(previousDate) || itemDate > previousDate))) {
      latest.set(key, item);
    }
  }
  return Array.from(latest.values());
}

function hasCompletedAsrs(record) {
  return getAsrsResponses(record).length >= 6;
}

function hasStartedAsrs(record) {
  return getAsrsResponses(record).length > 0;
}

function hasCompletedDsm(record) {
  return getDsmResponses(record).length >= 23 || Number(analyzeDsmRecord(record).answeredCount || 0) >= 23;
}

function hasStartedDsm(record) {
  return getDsmResponses(record).length > 0 || Number(analyzeDsmRecord(record).answeredCount || 0) > 0;
}

function hasCompletedReactivity(record) {
  const game = record?.tests?.game;
  return game?.status === "completed" || Boolean(game?.completedAt);
}

function getProgressStage(record) {
  if (record?.report?.schemaVersion === 2 || record?.currentStep === "report" || record?.currentStep === "plan" || record?.currentStep === "hub") {
    return "report";
  }
  if (hasCompletedReactivity(record)) {
    return "reactivity_completed";
  }
  if (record?.tests?.game?.status === "running" || record?.currentStep === "game") {
    return "reactivity_started";
  }
  if (hasCompletedAsrs(record) || hasCompletedDsm(record) || /result$/.test(String(record?.currentStep || ""))) {
    return "survey_completed";
  }
  if (hasStartedAsrs(record) || hasStartedDsm(record) || record?.currentStep === "asrs" || record?.currentStep === "dsm") {
    return "survey_started";
  }
  if (record?.currentStep === "id") {
    return "id_created";
  }
  return "entered";
}

function getSurveySelection(record) {
  const asrsStarted = hasStartedAsrs(record);
  const dsmStarted = hasStartedDsm(record);
  const asrsCompleted = hasCompletedAsrs(record);
  const dsmCompleted = hasCompletedDsm(record);

  if (asrsStarted && dsmStarted) {
    return {
      key: "both",
      label: "간편+세부",
      completed: asrsCompleted && dsmCompleted
    };
  }
  if (asrsStarted) {
    return {
      key: "asrs",
      label: "간편설문",
      completed: asrsCompleted
    };
  }
  if (dsmStarted) {
    return {
      key: "dsm",
      label: "세부설문",
      completed: dsmCompleted
    };
  }
  return {
    key: "none",
    label: "미선택",
    completed: false
  };
}

function getReactivityStepCompletion(record) {
  const tests = record?.tests?.game?.tests || {};
  const completedKeys = [
    tests.signal_detection ? "signal_detection" : "",
    tests.go_nogo ? "go_nogo" : "",
    tests.balance_hold ? "balance_hold" : ""
  ].filter(Boolean);
  const count = completedKeys.length;
  const labels = {
    0: "반응성 시작 전",
    1: "1단계 신호탐지 완료",
    2: "2단계 Go/No-Go 완료",
    3: "3단계 균형유지 완료"
  };

  return {
    count,
    keys: completedKeys,
    label: labels[count] || labels[0]
  };
}

function incrementCount(target, key, amount = 1) {
  target[key] = (target[key] || 0) + amount;
}

function toAnalysisPercent(count, total) {
  return total ? Math.round((count / total) * 1000) / 10 : 0;
}

function averageAnalysis(values, digits = 1) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) {
    return null;
  }
  return roundTo(finite.reduce((sum, value) => sum + value, 0) / finite.length, digits);
}

function getSubjectiveBurden(metrics) {
  if (metrics.hasAsrsSurvey) {
    return Math.min(100, roundTo((metrics.asrsPositiveCount / 6) * 100, 1));
  }
  if (metrics.hasDsmSurvey) {
    return Math.min(100, roundTo((metrics.dsmYesCount / 18) * 100, 1));
  }
  return null;
}

function getObjectiveBurden(metrics) {
  const performanceScores = [
    Number(metrics.signal?.score),
    Number(metrics.goNogo?.score),
    Number(metrics.balance?.score)
  ].filter(Number.isFinite);
  if (!performanceScores.length) {
    return null;
  }
  const averagePerformance = performanceScores.reduce((sum, value) => sum + value, 0) / performanceScores.length;
  return roundTo(clamp(100 - averagePerformance, 0, 100), 1);
}

function buildBurdenPattern(metrics) {
  const subjectiveBurden = getSubjectiveBurden(metrics);
  const performanceBurden = getObjectiveBurden(metrics);
  const threshold = 50;
  const subjectiveHigh = Number(subjectiveBurden) >= threshold;
  const performanceHigh = Number(performanceBurden) >= threshold;

  let type = "낮은 신호형";
  let summary = "자가부담과 수행부담이 모두 낮은 편입니다.";
  let guidance = "현재 결과만 보면 비교적 안정적인 흐름으로 볼 수 있지만, 이 결과만으로 단정하지 않고 수면, 스트레스, 환경 변화에 따른 차이를 함께 살펴보는 것이 좋습니다.";

  if (subjectiveHigh && performanceHigh) {
    type = "수렴형 어려움형";
    summary = "자가부담과 수행부담이 모두 높게 나타난 패턴입니다.";
    guidance = "스스로 느끼는 어려움과 과제 수행 신호가 같은 방향으로 모이므로, 어려움이 일상에서 지속된다면 추가 전문가 평가가 도움이 될 수 있습니다.";
  } else if (subjectiveHigh && !performanceHigh) {
    type = "주관적 어려움 우세형";
    summary = "자가부담은 높지만 수행부담은 상대적으로 낮게 나타난 패턴입니다.";
    guidance = "과제 상황에서는 비교적 안정적이더라도 생활 장면의 부담이 클 수 있으므로, 실제 생활 맥락과 기능 손상 여부를 함께 확인하는 것이 필요합니다.";
  } else if (!subjectiveHigh && performanceHigh) {
    type = "수행 불안정성 우세형";
    summary = "자가부담은 낮지만 수행부담이 상대적으로 높게 나타난 패턴입니다.";
    guidance = "스스로 체감하는 어려움은 크지 않아도 과제 수행에서 흔들림이 보일 수 있으므로, 수면, 피로, 긴장도, 과제 이해 여부를 함께 확인하는 것이 좋습니다.";
  }

  return {
    type,
    summary,
    guidance,
    subjectiveBurdenScore: subjectiveBurden,
    performanceBurdenScore: performanceBurden,
    threshold,
    subjectiveLevel: subjectiveHigh ? "높음" : "낮음",
    performanceLevel: performanceHigh ? "높음" : "낮음",
    note: "자가부담은 설문 응답을 0-100점으로 환산하고, 수행부담은 반응성 과제 수행 점수의 평균을 100점에서 뺀 값입니다. 두 점수 모두 높을수록 부담 신호가 큰 것으로 해석합니다."
  };
}

function spreadObjectiveBurden(points) {
  const values = points
    .map((point) => Number(point.objectiveBurden))
    .filter(Number.isFinite);
  if (!values.length) {
    return {
      min: null,
      max: null,
      method: "no-data"
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  for (const point of points) {
    point.rawObjectiveBurden = point.objectiveBurden;
    point.objectiveBurden = range
      ? roundTo(((point.rawObjectiveBurden - min) / range) * 100, 1)
      : 50;
  }

  return {
    min: roundTo(min, 1),
    max: roundTo(max, 1),
    method: range ? "min-max" : "constant-midpoint"
  };
}

function averageFiniteAnalysis(values, digits = 1) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) {
    return null;
  }
  return roundTo(finite.reduce((sum, value) => sum + value, 0) / finite.length, digits);
}

function getDomainScores(metrics) {
  const subjectiveInattention = metrics.hasAsrsSurvey
    ? Math.min(100, roundTo((metrics.asrsAttentionScore / 16) * 100, 1))
    : metrics.hasDsmSurvey
      ? Math.min(100, roundTo((metrics.dsmInattentionYesCount / 9) * 100, 1))
      : null;
  const subjectiveImpulsivity = metrics.hasAsrsSurvey
    ? Math.min(100, roundTo((metrics.asrsImpulseScore / 8) * 100, 1))
    : metrics.hasDsmSurvey
      ? Math.min(100, roundTo((metrics.dsmHyperactivityYesCount / 9) * 100, 1))
      : null;
  const signalScore = Number(metrics.signal?.score);
  const goNogoScore = Number(metrics.goNogo?.score);
  const reactivityInattention = Number.isFinite(signalScore)
    ? Math.min(100, Math.max(0, roundTo(signalScore, 1)))
    : null;
  const reactivityImpulsivity = Number.isFinite(goNogoScore)
    ? Math.min(100, Math.max(0, roundTo(goNogoScore, 1)))
    : null;

  return {
    subjectiveInattention,
    subjectiveImpulsivity,
    reactivityInattention,
    reactivityImpulsivity
  };
}

function rankAverage(values) {
  return values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value)
    .reduce((ranks, item, sortedIndex, sorted) => {
      if (ranks[item.index] !== undefined) {
        return ranks;
      }
      let endIndex = sortedIndex;
      while (endIndex + 1 < sorted.length && sorted[endIndex + 1].value === item.value) {
        endIndex += 1;
      }
      const averageRank = (sortedIndex + 1 + endIndex + 1) / 2;
      for (let cursor = sortedIndex; cursor <= endIndex; cursor += 1) {
        ranks[sorted[cursor].index] = averageRank;
      }
      return ranks;
    }, []);
}

function pearsonCorrelation(xValues, yValues) {
  const n = Math.min(xValues.length, yValues.length);
  if (n < 2) {
    return null;
  }
  const xMean = xValues.reduce((sum, value) => sum + value, 0) / n;
  const yMean = yValues.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let xSumSquares = 0;
  let ySumSquares = 0;
  for (let index = 0; index < n; index += 1) {
    const xDiff = xValues[index] - xMean;
    const yDiff = yValues[index] - yMean;
    numerator += xDiff * yDiff;
    xSumSquares += xDiff ** 2;
    ySumSquares += yDiff ** 2;
  }
  const denominator = Math.sqrt(xSumSquares * ySumSquares);
  return denominator ? numerator / denominator : null;
}

function spearmanCorrelation(points, xKey = "subjectiveBurden", yKey = "objectiveBurden") {
  const pairs = points
    .map((point) => [Number(point[xKey]), Number(point[yKey])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 2) {
    return { n: pairs.length, rho: null };
  }

  const xRanks = rankAverage(pairs.map(([x]) => x));
  const yRanks = rankAverage(pairs.map(([, y]) => y));
  const rho = pearsonCorrelation(xRanks, yRanks);
  return {
    n: pairs.length,
    rho: rho === null ? null : roundTo(rho, 3)
  };
}

function kendallTauB(points, xKey = "subjectiveBurden", yKey = "objectiveBurden") {
  const pairs = points
    .map((point) => [Number(point[xKey]), Number(point[yKey])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  let concordant = 0;
  let discordant = 0;
  let xTies = 0;
  let yTies = 0;

  for (let i = 0; i < pairs.length - 1; i += 1) {
    for (let j = i + 1; j < pairs.length; j += 1) {
      const xDiff = pairs[i][0] - pairs[j][0];
      const yDiff = pairs[i][1] - pairs[j][1];
      if (xDiff === 0 && yDiff === 0) {
        xTies += 1;
        yTies += 1;
        continue;
      }
      if (xDiff === 0) {
        xTies += 1;
        continue;
      }
      if (yDiff === 0) {
        yTies += 1;
        continue;
      }
      if (xDiff * yDiff > 0) {
        concordant += 1;
      } else {
        discordant += 1;
      }
    }
  }

  const denominator = Math.sqrt((concordant + discordant + xTies) * (concordant + discordant + yTies));
  const tau = denominator ? (concordant - discordant) / denominator : null;
  return {
    n: pairs.length,
    tau: tau === null ? null : roundTo(tau, 3),
    concordant,
    discordant,
    xTies,
    yTies
  };
}

function pearsonCorrelationForPoints(points, xKey, yKey) {
  const pairs = points
    .map((point) => [Number(point[xKey]), Number(point[yKey])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const r = pearsonCorrelation(pairs.map(([x]) => x), pairs.map(([, y]) => y));
  return {
    n: pairs.length,
    r: r === null ? null : roundTo(r, 3)
  };
}

function buildDomainCorrelation(points, xKey, yKey, label) {
  const pearson = pearsonCorrelationForPoints(points, xKey, yKey);
  const spearman = spearmanCorrelation(points, xKey, yKey);
  const kendall = kendallTauB(points, xKey, yKey);
  return {
    label,
    xKey,
    yKey,
    n: pearson.n,
    pearson,
    spearman,
    kendall,
    interpretation: describeCorrelation(spearman.rho)
  };
}

function describeCorrelation(value) {
  if (value === null || value === undefined) {
    return "계산 불가";
  }
  const abs = Math.abs(Number(value));
  const direction = value > 0 ? "양의" : value < 0 ? "음의" : "거의 없는";
  const strength = abs >= 0.7
    ? "강한"
    : abs >= 0.4
      ? "중간 정도"
      : abs >= 0.2
        ? "약한"
        : "매우 약한";
  return `${strength} ${direction} 순위 관계`;
}

function buildAnalysisSummary() {
  const allItems = readAnalysisRecords();
  const activeItems = allItems.filter((item) => !item.excludedAsOld);
  const latestUsers = latestItemsByUser(activeItems);
  const totalUsers = latestUsers.length;

  const recordsByUser = new Map();
  for (const item of activeItems) {
    const key = getAnalysisUserKey(item);
    if (!key) {
      continue;
    }
    if (!recordsByUser.has(key)) {
      recordsByUser.set(key, []);
    }
    recordsByUser.get(key).push(item);
  }

  const returningUsers = Array.from(recordsByUser.values()).filter((items) => {
    if (items.length > 1) {
      return true;
    }
    const sessions = items[0]?.record?.researchUsage?.sessions;
    return Array.isArray(sessions) && sessions.length > 1;
  }).length;

  const stageLabels = {
    entered: "접속",
    id_created: "ID 생성",
    survey_started: "설문 진행 중",
    survey_completed: "설문 완료",
    reactivity_started: "반응성 진행 중",
    reactivity_completed: "반응성 완료",
    report: "리포트/허브"
  };
  const surveyLabels = {
    none: "미선택",
    asrs: "간편설문",
    dsm: "세부설문",
    both: "간편+세부"
  };
  const stageCounts = {};
  const surveyCounts = {};
  const surveyCompletionCounts = {};
  const reactivityProgressCounts = {};
  let reactivityInProgressTotal = 0;

  for (const item of latestUsers) {
    const record = item.record;
    const stage = getProgressStage(record);
    incrementCount(stageCounts, stage);
    if (stage === "reactivity_started") {
      const completion = getReactivityStepCompletion(record);
      incrementCount(reactivityProgressCounts, String(completion.count));
      reactivityInProgressTotal += 1;
    }
    const selection = getSurveySelection(record);
    incrementCount(surveyCounts, selection.key);
    if (selection.completed) {
      incrementCount(surveyCompletionCounts, selection.key);
    }
  }

  const reactivityExcludedIds = new Set(["team3", "yonsei"]);
  const reactivityItems = latestItemsByUser(activeItems.filter((item) => {
    const id = getAnalysisUserKey(item);
    return hasCompletedReactivity(item.record) && !reactivityExcludedIds.has(id);
  })).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  const alignmentCounts = {};
  const subjectiveDomainCounts = {};
  const objectiveDomainCounts = {};
  const crossTable = {};
  const scatter = [];
  const domainPoints = [];
  const metricRows = [];

  for (const [index, item] of reactivityItems.entries()) {
    const metrics = computeAssessmentMetrics(item.record);
    const analysisLabel = index + 1;
    incrementCount(alignmentCounts, metrics.alignment);
    incrementCount(subjectiveDomainCounts, metrics.subjectiveDomain);
    incrementCount(objectiveDomainCounts, metrics.objectiveDomain);
    if (!crossTable[metrics.subjectiveDomain]) {
      crossTable[metrics.subjectiveDomain] = {};
    }
    incrementCount(crossTable[metrics.subjectiveDomain], metrics.objectiveDomain);

    const subjectiveBurden = getSubjectiveBurden(metrics);
    const objectiveBurden = getObjectiveBurden(metrics);
    const domainScores = getDomainScores(metrics);
    if (subjectiveBurden !== null && objectiveBurden !== null) {
      scatter.push({
        label: analysisLabel,
        id: item.record.id,
        createdAt: item.createdAt,
        surveyMode: metrics.surveyMode,
        subjectiveDomain: metrics.subjectiveDomain,
        objectiveDomain: metrics.objectiveDomain,
        alignment: metrics.alignment,
        subjectiveBurden,
        objectiveBurden
      });
    }
    if (
      domainScores.subjectiveInattention !== null
      && domainScores.subjectiveImpulsivity !== null
      && domainScores.reactivityInattention !== null
      && domainScores.reactivityImpulsivity !== null
    ) {
      domainPoints.push({
        label: analysisLabel,
        id: item.record.id,
        createdAt: item.createdAt,
        surveyMode: metrics.surveyMode,
        subjectiveDomain: metrics.subjectiveDomain,
        objectiveDomain: metrics.objectiveDomain,
        alignment: metrics.alignment,
        ...domainScores
      });
    }

    metricRows.push(metrics);
  }

  const objectiveBurdenScale = spreadObjectiveBurden(scatter);
  const spearman = spearmanCorrelation(scatter);
  const kendall = kendallTauB(scatter);
  const domainCorrelations = [
    buildDomainCorrelation(domainPoints, "subjectiveInattention", "reactivityInattention", "자가보고 부주의 부담 x 신호탐지 안정 점수"),
    buildDomainCorrelation(domainPoints, "subjectiveInattention", "reactivityImpulsivity", "자가보고 부주의 부담 x Go/No-Go 안정 점수"),
    buildDomainCorrelation(domainPoints, "subjectiveImpulsivity", "reactivityInattention", "자가보고 충동성 부담 x 신호탐지 안정 점수"),
    buildDomainCorrelation(domainPoints, "subjectiveImpulsivity", "reactivityImpulsivity", "자가보고 충동성 부담 x Go/No-Go 안정 점수")
  ];
  const strongestDomainCorrelation = domainCorrelations
    .filter((item) => item.spearman.rho !== null)
    .sort((a, b) => Math.abs(b.spearman.rho) - Math.abs(a.spearman.rho))[0] || null;

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      oldCutoff: analysisOldCutoff,
      oldExcludedRecords: allItems.filter((item) => item.excludedAsOld).length,
      reactivityExcludedIds: Array.from(reactivityExcludedIds)
    },
    totals: {
      totalUsers,
      totalRecords: activeItems.length,
      returningUsers,
      returningRate: toAnalysisPercent(returningUsers, totalUsers)
    },
    progress: {
      stages: Object.entries(stageLabels).map(([key, label]) => ({
        key,
        label,
        count: stageCounts[key] || 0,
        percent: toAnalysisPercent(stageCounts[key] || 0, totalUsers)
      })),
      reactivityInProgress: [0, 1, 2, 3].map((stepCount) => {
        const completion = { count: stepCount, label: getReactivityStepCompletion({ tests: { game: { tests: {
          signal_detection: stepCount >= 1 ? {} : null,
          go_nogo: stepCount >= 2 ? {} : null,
          balance_hold: stepCount >= 3 ? {} : null
        } } } }).label };
        return {
          key: String(stepCount),
          label: completion.label,
          count: reactivityProgressCounts[String(stepCount)] || 0,
          percent: toAnalysisPercent(reactivityProgressCounts[String(stepCount)] || 0, reactivityInProgressTotal)
        };
      }),
      surveySelection: Object.entries(surveyLabels).map(([key, label]) => ({
        key,
        label,
        count: surveyCounts[key] || 0,
        completed: surveyCompletionCounts[key] || 0,
        percent: toAnalysisPercent(surveyCounts[key] || 0, totalUsers)
      }))
    },
    reactivity: {
      completedUsers: reactivityItems.length,
      analysisMethod: [
        "사용자 단위 최신 완료 기록을 기준으로 집계했습니다.",
        "자가보고는 선택한 설문의 부주의 지표와 충동성 지표로 나누어 0-100점으로 환산했습니다.",
        "반응성 테스트는 원래 앱 점수 방향을 그대로 사용했습니다. 신호탐지 안정 점수와 Go/No-Go 안정 점수는 높을수록 수행이 안정적이고 관련 부담 신호가 낮다는 뜻입니다.",
        "2x2 조합(자가보고 부주의/충동성 부담 x 반응성 안정 점수)에 대해 Pearson r, Spearman rho, Kendall tau-b를 계산했습니다."
      ],
      interpretation: {
        alignment: alignmentCounts,
        subjectiveDomain: subjectiveDomainCounts,
        objectiveDomain: objectiveDomainCounts,
        crossTable,
        summary: domainPoints.length
          ? `반응성 테스트 완료자 ${domainPoints.length}명 기준 2x2 도메인 상관을 계산했습니다. 가장 큰 순위상관은 ${strongestDomainCorrelation?.label || "-"}이며 Spearman rho=${strongestDomainCorrelation?.spearman?.rho ?? "-"}입니다.`
          : "반응성 테스트까지 완료한 분석 대상자가 아직 없습니다."
      },
      metricAverages: {
        omissionRatePct: averageAnalysis(metricRows.map((metrics) => metrics.omissionRate * 100)),
        commissionRatePct: averageAnalysis(metricRows.map((metrics) => metrics.commissionRate * 100)),
        reactionVariabilityMs: averageAnalysis(metricRows.map((metrics) => metrics.reactionVariability)),
        fastErrorRatePct: averageAnalysis(metricRows.map((metrics) => metrics.fastErrorRate * 100)),
        stableDurationPct: averageAnalysis(metricRows.map((metrics) => metrics.stableDurationPct))
      },
      correlation: {
        spearman: {
          ...spearman,
          label: "Spearman rho",
          interpretation: describeCorrelation(spearman.rho)
        },
        kendall: {
          ...kendall,
          label: "Kendall tau-b",
          interpretation: describeCorrelation(kendall.tau)
        },
        domainMatrix: domainCorrelations,
        strongest: strongestDomainCorrelation,
        note: "표본 수가 작아 p값 중심의 유의성 판단보다 방향과 효과크기 참고용으로 해석해야 합니다."
      },
      domainPoints,
      scatter,
      objectiveBurdenScale
    }
  };
}

function buildProfileBadges(metrics) {
  const badges = [];

  if (metrics.asrsAttentionScore >= 10 || metrics.dsmInattentionYesCount >= 6 || metrics.omissionRate >= 0.2) {
    badges.push("#주의력충전필요");
  }
  if (metrics.asrsImpulseScore >= 5 || metrics.dsmHyperactivityYesCount >= 6 || metrics.commissionRate >= 0.2) {
    badges.push("#반응속도조절중");
  }
  if (metrics.reactionVariability >= 180 || metrics.tau >= 250) {
    badges.push("#집중변동체크");
  }
  if (metrics.scores.executive >= 65) {
    badges.push("#구조화하면강해요");
  }
  if (metrics.scores.attention >= 60 && metrics.reactionVariability < 180 && metrics.commissionRate < 0.2) {
    badges.push("#몰입잠재력있음");
  }
  if (!badges.length) {
    badges.push("#기본안정패턴");
  }

  return badges.slice(0, 3);
}

function buildAlignmentLabel(alignment) {
  if (alignment === "일치") {
    return "주관-객관 결과가 비슷해요";
  }
  if (alignment === "불일치") {
    return "느낌과 측정값이 조금 달라요";
  }
  return "두 신호가 함께 섞여 보여요";
}

function buildDailyImpactLabel(level) {
  const labels = {
    1: "가벼운 피로",
    2: "조금 누적된 피로",
    3: "중간 수준의 부담",
    4: "지속적 소모가 큰 편",
    5: "상당한 에너지 소모"
  };
  return labels[level] || labels[3];
}

function determinePlanTendency(metrics) {
  const inattentionSignals = [
    metrics.asrsAttentionScore >= 10,
    metrics.dsmInattentionYesCount >= 6,
    metrics.omissionRate >= 0.18,
    metrics.reactionVariability >= 180,
    metrics.tau >= 250,
    metrics.latePhaseDrop >= 0.15
  ].filter(Boolean).length;
  const impulsivitySignals = [
    metrics.asrsImpulseScore >= 5,
    metrics.dsmHyperactivityYesCount >= 6,
    metrics.commissionRate >= 0.18,
    metrics.fastErrorRate >= 0.12,
    metrics.spikeCount >= 4,
    metrics.stableDurationPct > 0 && metrics.stableDurationPct < 60
  ].filter(Boolean).length;

  if (metrics.severity === "낮음" && inattentionSignals === 0 && impulsivitySignals === 0) {
    return "very_low";
  }
  if (inattentionSignals >= 2 && impulsivitySignals >= 2) {
    return "combined";
  }
  if (impulsivitySignals > inattentionSignals) {
    return "impulsivity";
  }
  if (inattentionSignals > impulsivitySignals) {
    return "inattention";
  }
  if (metrics.dsmSubtype === "복합형") {
    return "combined";
  }
  return metrics.subjectiveDomain === "충동성" || metrics.objectiveDomain === "충동성"
    ? "impulsivity"
    : "inattention";
}

function buildPlanForMetrics(metrics) {
  const tendency = determinePlanTendency(metrics);
  const plans = {
    inattention: {
      suggestions: [
        "아침에 책상에 앉자마자 오늘 할 일을 A(필수), B(선택)로 나누어 딱 3가지만 포스트잇에 적고 모니터 옆에 붙이세요.",
        "집중이 필요한 작업을 시작하기 직전, 스마트폰을 뒤집어 다른 방에 두거나 보이지 않는 서랍 안에 넣으세요.",
        "업무 중 딴생각이 나면 즉시 행동하지 말고, 책상 위 생각 노트에 단어 하나만 적어둔 뒤 바로 하던 일로 시선을 돌리세요."
      ],
      openingMessage: "생활 패턴이나 업무 환경에 맞춰 계획을 더 현실적으로 바꿀 수 있어요. 주로 집중력이 가장 많이 떨어지는 시간대나 일하는 장소를 알려 주세요."
    },
    impulsivity: {
      suggestions: [
        "불안하거나 충동적인 행동을 하고 싶어질 때 즉각 반응하지 말고, 제자리에 서서 3번 크게 심호흡하세요.",
        "충동적인 결정을 내리기 직전, 스마트폰 메모장을 열어 머릿속을 스쳐 지나간 자동적인 생각을 한 줄로 적어보세요.",
        "매일 저녁 5분 동안 다이어리를 펴고, 오늘 하루 겪었던 감정 기복과 충동적인 행동을 한 줄씩 기록하며 점검하세요."
      ],
      openingMessage: "지금 제안이 너무 답답하거나 일상에 안 맞으면, 가장 참기 힘든 충동이 일어나는 상황에 맞춰 다시 조정해 드릴게요."
    },
    combined: {
      suggestions: [
        "일과를 시작하기 전, 가장 중요한 과제 1개를 골라 15분 안에 끝낼 수 있는 아주 작은 행동 단위 3가지로 쪼개어 적으세요.",
        "작업 중 다른 일을 하고 싶은 충동이 들 때 즉각 일어서지 말고, 제자리에서 3번 심호흡한 뒤 책상 옆 메모장에 그 충동을 단어로 짧게 적고 하던 일로 돌아가세요.",
        "잠들기 전 침대에서 5분 동안, 오늘 일을 미루게 한 생각 옆에 내일 바로 할 수 있는 현실적인 행동 문장 1개를 적으며 하루를 마무리하세요."
      ],
      openingMessage: "지금 제안한 행동 단위가 너무 부담스럽거나 안 맞으면, 시간이나 실제 생활 패턴에 맞게 계획을 다시 조정해 드릴게요."
    },
    very_low: {
      suggestions: [
        "하루를 시작할 때 오늘 꼭 지키고 싶은 작은 루틴 1개를 정하고, 끝나면 달력에 짧게 표시하세요.",
        "집중이 잘 되는 시간대를 하루에 한 번만 기록해서, 중요한 일은 가능한 그 시간 앞쪽에 배치하세요.",
        "잠들기 전 3분 동안 오늘 잘 유지한 행동 1개와 내일 반복할 행동 1개를 메모장에 적어두세요."
      ],
      openingMessage: "현재 결과가 비교적 안정적으로 보여도 수면, 피로, 일정 변화에 따라 체감은 달라질 수 있어요. 유지하고 싶은 생활 루틴이나 흔들리는 상황을 알려 주면 더 맞게 조정해 드릴게요."
    }
  };

  return plans[tendency] || plans.inattention;
}

function buildDeterministicReport(metrics) {
  const badges = buildProfileBadges(metrics);
  const plan = buildPlanForMetrics(metrics);
  const surveyLabel = metrics.surveyMode === "dsm"
    ? "23문항 세부 설문"
    : metrics.surveyMode === "asrs"
      ? "6문항 간단 설문"
      : "자가보고 설문";
  const subjectiveBasis = metrics.surveyMode === "dsm"
    ? `세부 설문에서는 집중 유지 영역 ${metrics.dsmInattentionYesCount}개, 반응 조절 영역 ${metrics.dsmHyperactivityYesCount}개가 체크됐어요.`
    : `간단 설문에서는 집중 유지 응답 지표 ${metrics.asrsAttentionScore}/16, 반응 조절 응답 지표 ${metrics.asrsImpulseScore}/8로 기록됐어요.`;
  const subjectiveDomainLabel = metrics.subjectiveDomain === "부주의" ? "집중 유지" : "반응 조절";
  const objectiveDomainLabel = metrics.objectiveDomain === "부주의" ? "집중 유지" : "반응 조절";
  const heroSummary = metrics.severity === "높음"
    ? `${surveyLabel}과 반응성 과제에서 주의·집중과 실행 기능 부담이 비교적 크게 나타났어요. 의학적 진단이 아니라 현재 패턴을 쉽게 정리한 참고 리포트예요.`
    : metrics.severity === "중간"
      ? `${surveyLabel}에서 몇 가지 일상 어려움이 나타났어요. 반응성 과제까지 함께 보면 어떤 상황에서 흔들리는지 더 구체적으로 볼 수 있어요.`
      : `${surveyLabel}만 보면 큰 부담은 높지 않아 보여요. 그래도 피로, 수면, 환경 변화에 따라 체감은 달라질 수 있어요.`;
  const subjectiveText = metrics.subjectiveDomain === "부주의"
    ? `${subjectiveBasis} 특히 시작이 늦어지거나, 하던 일을 끝까지 붙잡는 과정에서 부담이 있었을 수 있어요.`
    : `${subjectiveBasis} 기다리기 어렵거나, 생각보다 반응이 먼저 나가는 순간이 있었을 수 있어요.`;
  const objectiveText = metrics.signalHasDetail || metrics.goNogoHasDetail
    ? [
      metrics.signalHasDetail
        ? `신호 찾기에서는 목표 놓침 비율 ${formatPercent(metrics.omissionRate)}, 반응시간 변동성 ${reactionVariabilityOrZero(metrics)}ms, 느리게 처지는 반응 폭 ${Number(metrics.tau || 0)}ms 수준이었어요.`
        : `신호 찾기 수행 지표는 ${Number(metrics.signal.score || 0)}점이었어요.`,
      metrics.goNogoHasDetail
        ? `Go/No-Go에서는 잘못된 반응 비율 ${formatPercent(metrics.commissionRate)}, 성급 반응 비율 ${formatPercent(metrics.fastErrorRate)}로 기록됐어요.`
        : `Go/No-Go 수행 지표는 ${Number(metrics.goNogo.score || 0)}점이었어요.`
    ].join(" ")
    : metrics.objectiveDomain === "부주의"
      ? `반응성 과제에서는 집중 유지 지표가 상대적으로 더 낮게 나타났어요. 순간 집중의 일관성을 확인해 볼 필요가 있어요.`
      : `반응성 과제에서는 멈추는 조절이 비교적 안정적으로 나타났어요.`;
  const alignmentSummary = metrics.alignment === "일치"
    ? "스스로 느끼는 어려움과 측정된 반응 패턴이 비슷한 방향을 보여줘요."
    : metrics.alignment === "불일치"
      ? "평소 체감과 과제 상황의 반응이 다르게 나타났어요. 환경, 긴장도, 과제 유형 차이의 영향을 함께 볼 필요가 있어요."
      : "집중 유지와 반응 조절 패턴이 함께 섞여 보여서 한쪽으로 단정하기보다 상황별 차이를 함께 보는 편이 좋아요.";
  const inattentionSummary = metrics.signalHasDetail
    ? `집중 유지 영역은 ${surveyLabel}의 응답과 목표 놓침 비율 ${formatPercent(metrics.omissionRate)}, 반응시간 변동성 ${reactionVariabilityOrZero(metrics)}ms를 함께 본 결과예요. ${metrics.omissionRate >= 0.18 || metrics.reactionVariability >= 180 || metrics.tau >= 250 ? "집중을 일정하게 유지하는 부분을 천천히 점검해 볼 만해요." : "반응성 지표는 비교적 안정적이지만, 평소 체감은 다를 수 있어요."}`
    : `집중 유지 영역은 ${surveyLabel}의 응답과 신호 찾기 수행 지표 ${Number(metrics.signal.score || 0)}점을 함께 참고했어요. 현재는 세부 오류 수치가 없어 수행 지표 중심으로만 조심스럽게 해석해요.`;
  const impulsivitySummary = metrics.goNogoHasDetail
    ? `반응 조절 영역은 ${surveyLabel}의 응답과 잘못된 반응 비율 ${formatPercent(metrics.commissionRate)}, 성급 반응 비율 ${formatPercent(metrics.fastErrorRate)}를 함께 본 결과예요. ${metrics.commissionRate >= 0.18 ? "빠르게 누르는 것보다 잠깐 멈추는 연습이 도움이 될 수 있어요." : "멈추는 조절은 비교적 안정적으로 보여요."}`
    : `반응 조절 영역은 ${surveyLabel}의 응답과 Go/No-Go 수행 지표 ${Number(metrics.goNogo.score || 0)}점을 함께 참고했어요. 현재는 세부 오류 수치가 없어 수행 지표 중심으로만 조심스럽게 해석해요.`;
  const hyperactivitySummary = metrics.balanceHasDetail
    ? `균형 유지 과제에서는 안정 유지 시간 ${roundTo(metrics.stableDurationPct, 1)}%, 큰 흔들림 ${Number(metrics.spikeCount || 0)}회로 기록됐어요. 이 영역은 보조 참고 정보로만 활용하는 것이 적절해요.`
    : "";
  const empathy = metrics.dailyImpactLevel >= 4
    ? "이 정도 패턴이면 일상에서 해야 할 일을 따라가는 것만으로도 꽤 많은 에너지가 들었을 수 있어요. 스스로를 탓하기보다 부담이 커지는 상황을 먼저 알아차리는 것이 중요해요."
    : metrics.dailyImpactLevel >= 3
      ? "일상에서는 집중 유지와 감정 소모가 번갈아 부담으로 느껴졌을 수 있어요. 잘 안 되는 날이 반복됐다면 의지 부족보다 환경과 피로의 영향을 함께 보는 편이 더 정확해요."
      : "현재 결과만 보면 일상 부담은 아주 높게 보이지 않지만, 특정 일정이나 관계 맥락에서는 체감이 달라질 수 있어요. 무리가 시작되는 조건을 미리 파악해 두면 도움이 됩니다.";

  return {
    report: {
      severity: metrics.severity,
      scores: metrics.scores,
      sections: {
        summary: heroSummary,
        strength: "구조를 만들면 수행이 안정될 여지가 보이고, 관심이 생기는 과제에서는 몰입이 보호 요인으로 작동할 수 있어요.",
        watchout: "이 리포트만으로 단정할 수는 없고 수면, 스트레스, 불안·우울 같은 다른 요인도 함께 살펴봐야 해요. 의학적 진단이 아니라 자기점검 참고 자료입니다."
      },
      hero: {
        badges,
        summary: heroSummary
      },
	      crossCheck: {
	        subjectiveTitle: `${surveyLabel}에서는 ${subjectiveDomainLabel} 쪽 부담이 더 보여요`,
	        subjectiveText,
	        objectiveTitle: `수행 과제에서는 ${objectiveDomainLabel} 쪽 패턴이 더 보여요`,
	        objectiveText,
	        alignmentLabel: buildAlignmentLabel(metrics.alignment),
	        alignmentSummary
	      },
	      burdenPattern: metrics.burdenPattern,
	      profile: {
	        inattentionSummary,
	        impulsivitySummary,
	        hyperactivitySummary
      },
      dailyImpact: {
        level: metrics.dailyImpactLevel,
        label: buildDailyImpactLabel(metrics.dailyImpactLevel),
        empathy
      },
      bridge: {
        cta: "내 패턴에 맞춘 실천 계획 보기"
      }
    },
    plan
  };
}

function reactionVariabilityOrZero(metrics) {
  return Number(metrics.signal?.reaction_time_variability || 0);
}

async function callGeminiJson({ systemInstruction, prompt, schemaHint }) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env and restart the server.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiApiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompt}\n\nReturn JSON only.\n${schemaHint}` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const text = extractGeminiText(payload);
  return parseJsonLoose(text);
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || "").join("").trim();
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw error;
  }
}

function normalizePlanSuggestion(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlanSuggestions(values, fallbackValues = []) {
  const source = Array.isArray(values) && values.length ? values : fallbackValues;
  return source
    .map((item) => normalizePlanSuggestion(item))
    .filter(Boolean)
    .slice(0, 3);
}

function buildInsightsPrompt(record, metrics) {
  const selectedSurvey = metrics.surveyMode === "dsm"
    ? "사용자는 23문항 세부 설문만 선택했습니다. ASRS 값이 비어 있으면 사용하지 마세요."
    : metrics.surveyMode === "asrs"
      ? "사용자는 6문항 간단 설문만 선택했습니다. DSM 값이 비어 있으면 사용하지 마세요."
      : "사용자가 선택해 완료한 설문만 근거로 사용하세요.";
  return [
    "서비스: ADDFCS.COM 주의·집중·실행 기능 패턴 자기점검 모바일 웹 앱",
    "참고 정보: ADHD는 배경 설명에서만 언급하고 사용자를 ADHD로 판정하거나 의심군처럼 표현하지 말 것",
    "중요: 의학적 진단, 판별, 위험군, 정상/비정상 표현 금지. 자기점검 참고 리포트와 전문가 상담 고려 수준으로 작성",
    "어조: 따뜻하고 전문적인 임상심리사처럼, 부드러운 경어체 한국어 사용",
    "표현 지침: '목표 놓침', '멈춰야 할 때 누른 반응'처럼 쉬운 말로 설명",
    "교차 분석 지침: 사용자가 느끼는 일상 어려움과 게임 기반 수행 지표가 비슷한지 분명히 짚기",
    `선택 설문 지침: ${selectedSurvey}`,
    "결과 구조 지침: 사용자는 ASRS와 DSM 중 하나만 선택해서 진행합니다. 리포트와 플랜에서 두 설문을 모두 완료한 것처럼 말하지 말 것",
	    "수치 사용 지침: JSON에 실제 존재하는 숫자만 인용하고, 없는 오류 횟수나 반응시간은 추정해서 쓰지 말 것",
	    "자가부담-수행부담 2x2 해석 지침:",
	    "- metrics.burdenPattern을 리포트에 반드시 반영할 것",
	    "- 자가부담과 수행부담은 모두 높을수록 부담 신호가 큰 점수임",
	    "- 둘 다 높음: 수렴형 어려움형. 추가 전문가 평가가 도움이 될 수 있다고 안내",
	    "- 자가부담 높음, 수행부담 낮음: 주관적 어려움 우세형. 생활의 맥락과 기능 손상의 확인이 필요하다고 안내",
	    "- 자가부담 낮음, 수행부담 높음: 수행 불안정성 우세형. 수면, 피로, 과제 이해 확인을 안내",
	    "- 둘 다 낮음: 낮은 신호형. 안정적으로 볼 수 있지만 단정하지 않도록 안내",
	    "- report.burdenPattern.type은 metrics.burdenPattern.type의 네 유형명 중 하나를 그대로 사용할 것",
	    "간단 자기점검 해석 기준:",
    "- 1, 2, 3번 문항은 가끔(2) 이상이면 일상 부담 응답으로 참고",
    "- 4, 5, 6번 문항은 자주(3) 이상이면 일상 부담 응답으로 참고",
    "- 부담 응답이 4개 이상이면 주의·집중 또는 실행 기능 부담이 비교적 크게 나타난 패턴으로 해석",
    "- 집중 유지 관련 문항: 1, 2, 3, 4번",
    "- 반응 조절 관련 문항: 5, 6번",
    "세부 자기점검 해석 기준:",
    "- 총 18문항, 집중 유지 9문항과 반응 조절 9문항으로 구성",
    "- 집중 유지 6개 이상 Yes, 반응 조절 6개 미만 Yes면 집중 유지 부담 패턴",
    "- 반응 조절 6개 이상 Yes, 집중 유지 6개 미만 Yes면 반응 조절 부담 패턴",
    "- 두 영역 모두 6개 이상 Yes면 복합 실행 기능 패턴",
    "- 본 결과는 의학적 진단이 아니라 참고용 자기점검 리포트로만 설명",
    "실행계획 작성 기준:",
    "- 대상은 성인 사용자로 가정하고, 아동/청소년용 표현이나 보호자 지시는 쓰지 말 것",
    "- plan.suggestions는 반드시 3개만 작성",
    "- 각 제안은 시간 또는 타이밍, 장소, 하나의 구체적 행동 단위가 드러나야 함",
    "- 의료적 처방, 진단, 치료 지시처럼 쓰지 말고 일상 코칭 언어로 작성",
    "- 집중 유지 부담이 두드러지면 과제 분할, 시각적 단서, 환경 통제, 시작 장벽 낮추기 전략을 사용",
    "- 반응 조절 부담이 두드러지면 지연 행동, 자기 점검, 심호흡, 행동 전 메모 전략을 사용",
    "- 복합 실행 기능 패턴이면 집중 유지 보완 전략과 반응 조절 전략을 섞어서 제안",
    "- 큰 부담이 낮으면 현재 흐름을 유지하는 작고 반복 가능한 생활 루틴을 제안",
    "- '인지행동치료', '작업 기억력', 'MBSR' 같은 학술 용어는 사용자 문장에 직접 쓰지 말고 쉬운 말로 풀어 쓸 것",
    "대상 기록 JSON:",
    JSON.stringify(record, null, 2),
    "계산된 핵심 지표:",
    JSON.stringify(metrics, null, 2),
    "요청:",
    "1. report.severity는 낮음/중간/높음 중 하나",
    "2. report.hero.badges는 짧은 해시태그 2~3개",
    "3. report.hero.summary는 전체 결과를 아우르는 1~2문장 핵심 요약",
    "4. report.crossCheck.subjectiveTitle, subjectiveText는 사용자가 선택한 설문 하나를 기준으로 한 일상 어려움 설명",
    "5. report.crossCheck.objectiveTitle, objectiveText는 반응성 과제 기준의 수행 패턴 설명",
    "6. report.crossCheck.alignmentLabel은 일치 여부를 보여주는 짧은 뱃지 문구",
	    "7. report.crossCheck.alignmentSummary는 두 결과의 일치/불일치를 해석하는 1~2문장",
	    "8. report.burdenPattern은 metrics.burdenPattern의 점수와 유형을 유지하고, summary/guidance만 사용자에게 자연스러운 1문장으로 다듬기",
	    "9. report.profile.inattentionSummary는 선택한 설문 응답과 목표 놓침/반응시간 변동성 지표를 쉬운 말로 종합한 설명",
	    "10. report.profile.impulsivitySummary는 선택한 설문 응답과 잘못된 반응 지표를 쉬운 말로 종합한 설명",
	    "11. report.dailyImpact.empathy는 선택한 설문 결과를 바탕으로 한 일상 피로도 공감 메시지",
	    "12. report.sections.strength는 보호 요인과 강점 신호",
	    "13. report.sections.watchout는 자기점검 도구의 한계와 전문가 상담 고려 안내",
	    "14. plan.suggestions는 위 실행계획 기준을 지킨 한국어 문장 3개",
	    "15. plan.openingMessage는 사용자가 생활 패턴에 맞춰 계획 수정을 요청할 수 있게 유도하는 1~2문장"
	  ].join("\n");
	}

function buildChatPrompt(record, message, metrics) {
  return [
    "서비스: ADDFCS.COM 주의·집중·실행 기능 패턴 자기점검 모바일 웹 앱",
    "역할: 자기점검 리포트와 현재 실행계획을 바탕으로 사용자의 계획을 현실적으로 조정하는 한국어 행동 코치",
    "중요: 의학적 진단 표현 금지, 의료행위처럼 말하지 말 것",
    "응답 기준:",
    "- 사용자의 실제 생활 조건에 맞춰 시간, 장소, 행동 단위를 더 작게 조정",
    "- 한 번에 여러 행동을 시키지 말고 가장 작은 다음 행동 1개를 우선 제안",
    "- 집중 유지 부담은 과제 분할, 시각적 단서, 환경 통제 중심으로 조정",
    "- 반응 조절 부담은 지연 행동, 자기 점검, 심호흡, 행동 전 메모 중심으로 조정",
    "현재 기록:",
    JSON.stringify(record, null, 2),
    "계산된 핵심 지표:",
    JSON.stringify(metrics, null, 2),
    "사용자 메시지:",
    message,
    "요청:",
    "reply는 사용자의 요청을 반영한 짧고 구체적인 답변 2~4문장",
    "additionalSuggestion은 선택값이며, 꼭 필요할 때만 한 문장으로 제안"
  ].join("\n");
}

function buildAsrsAnalysisPrompt(record, analysis, metrics) {
  return [
    "서비스: ADDFCS.COM 주의·집중·실행 기능 패턴 자기점검 모바일 웹 앱",
    "역할: 간단 자기점검 응답을 짧고 공감적으로 해석하는 한국어 자기점검 보조 AI",
    "중요: 의학적 진단 표현 금지, 일상 패턴 탐색과 전문가 상담 고려 수준으로만 작성",
    "사용자 흐름: 이 사용자는 6문항 간단 설문을 선택했습니다. 이 다음에는 DSM이 아니라 반응성 과제로 이동합니다.",
    "표현 지침: 어려운 용어보다 쉬운 일상어를 쓰고, 사용자를 평가하지 말고 함께 확인하는 말투로 작성",
    "간단 자기점검 기준:",
    "- 1, 2, 3번 문항은 가끔(2) 이상이면 유의미",
    "- 4, 5, 6번 문항은 자주(3) 이상이면 유의미",
    "- 부담 응답 4개 이상이면 주의·집중 또는 실행 기능 부담이 비교적 크게 나타난 패턴",
    "기록 JSON:",
    JSON.stringify(record, null, 2),
    "계산된 간단 자기점검 해석용 지표:",
    JSON.stringify(analysis, null, 2),
    "보조 지표:",
    JSON.stringify(metrics, null, 2),
    "요청:",
    "1. summary는 전체 경향을 초등 고학년도 이해할 수 있는 쉬운 말로 2문장 이내 요약",
    "2. attention는 집중을 유지하거나 일을 시작하는 어려움 관점에서 2문장 이내 설명",
    "3. hyperactivity는 기다리기, 멈추기, 빠른 반응 관점에서 2문장 이내 설명",
    "4. guidance는 간단 설문의 한계와 다음 단계인 반응성 과제 안내를 2문장 이내로 설명",
    "5. 한국어로만 작성"
  ].join("\n");
}

function buildDsmAnalysisPrompt(record, analysis, metrics) {
  return [
    "서비스: ADDFCS.COM 주의·집중·실행 기능 패턴 자기점검 모바일 웹 앱",
    "역할: 세부 자기점검 결과를 짧고 공감적으로 해석하는 한국어 자기점검 보조 AI",
    "중요: 의학적 진단 표현 금지, 일상 패턴 탐색과 전문가 상담 고려 수준으로만 작성",
    "사용자 흐름: 이 사용자는 23문항 세부 설문을 선택했습니다. 이 다음에는 ASRS가 아니라 반응성 과제로 이동합니다.",
    "표현 지침: 어려운 용어보다 쉬운 일상어를 쓰고, 사용자를 평가하지 말고 함께 확인하는 말투로 작성",
    "세부 자기점검 기준:",
    "- 집중 유지 9문항 중 6개 이상 Yes면 집중 유지 부담 패턴",
    "- 반응 조절 9문항 중 6개 이상 Yes면 반응 조절 부담 패턴",
    "- 두 영역이 모두 6개 이상 Yes면 복합 실행 기능 패턴",
    "- 두 영역 모두 6개 미만 Yes면 큰 부담이 낮은 패턴으로 설명",
    "- 본 결과는 의학적 진단이 아니라 현재 일상 패턴을 참고하기 위한 것입니다.",
    "기록 JSON:",
    JSON.stringify(record, null, 2),
    "계산된 세부 자기점검 해석용 지표:",
    JSON.stringify(analysis, null, 2),
    "보조 지표:",
    JSON.stringify(metrics, null, 2),
    "요청:",
    "1. summary는 전체 경향을 초등 고학년도 이해할 수 있는 쉬운 말로 2문장 이내 요약",
    "2. subtype는 현재 분류를 낙인 없이 참고 신호로 2문장 이내 설명",
    "3. inattention는 집중 유지, 시작 지연, 마무리 어려움 관점에서 2문장 이내 설명",
    "4. hyperactivity는 기다리기, 멈추기, 빠른 반응 관점에서 2문장 이내 설명",
    "5. guidance는 세부 설문의 한계와 다음 단계인 반응성 과제 안내를 2문장 이내로 설명",
    "6. 한국어로만 작성"
  ].join("\n");
}

function buildReactivityAnalysisPrompt(record, analysis, metrics) {
  return [
    "서비스: ADDFCS.COM 주의·집중·실행 기능 패턴 자기점검 모바일 웹 앱",
    "역할: 반응성 과제 3종 결과를 쉽고 친절하게 해석하는 한국어 자기점검 보조 AI",
    "중요: 의학적 진단 표현 금지, 수행 과제 결과와 전문가 상담 고려 수준으로만 작성",
    "사용자 흐름: 이 사용자는 설문을 마친 뒤 반응성 과제 3종을 완료했습니다. 이 결과 다음에는 패턴 리포트로 이동합니다.",
    "표현 지침: 어려운 용어보다 쉬운 일상어를 쓰고, 사용자를 평가하지 말고 함께 확인하는 말투로 작성",
    "친절한 설명 지침:",
    "- '부주의', '충동성', '활동성'이라는 진단명처럼 들릴 수 있는 단어만 던지지 말고 일상 행동으로 풀어 설명",
    "- omissionRate는 '목표를 놓친 정도', reactionVariability/tau는 '반응 속도가 흔들린 정도', commissionRate는 '멈춰야 할 때 누른 정도'처럼 쉽게 표현",
    "- 결과가 높거나 낮아도 단정하지 말고 '그럴 수 있어요', '확인해 볼 만해요', '참고 신호예요'처럼 부드럽게 말하기",
    "- 사용자가 잘못했다는 인상을 주는 표현 금지: 실패, 문제, 결함, 비정상, 심각 같은 단어를 피하기",
    "- 짧은 과제라 컨디션, 기기 조작, 집중 환경의 영향을 받을 수 있음을 guidance에서 자연스럽게 안내",
    "반응성 과제 해석 기준:",
    "- omissionRate가 높고 reactionVariability 또는 tau가 크면 집중 유지 어려움을 우선 설명",
    "- commissionRate가 높으면 반응 억제 과제의 실수나 멈춤 조절 어려움을 설명",
    "- stableDurationPct가 낮거나 spikeCount가 많으면 움직임/자기조절 패턴을 보조적으로 설명",
    "- validity.valid가 false인 영역은 데이터 부족으로 해석이 어렵다고 안내",
    "- 수치를 과도하게 나열하지 말고, 이미 계산된 결과를 자연어로 풀어 설명",
    "기록 JSON:",
    JSON.stringify(record, null, 2),
    "로컬 반응성 요약:",
    JSON.stringify(analysis, null, 2),
    "보조 지표:",
    JSON.stringify(metrics, null, 2),
    "요청:",
    "1. summary는 전체 경향을 초등 고학년도 이해할 수 있는 쉬운 말로 2문장 이내 요약",
    "2. inattention는 목표를 놓치거나 반응 속도가 흔들리는 관점에서 2문장 이내 설명",
    "3. impulsivity는 멈춰야 할 때 멈추는 조절 관점에서 2문장 이내 설명",
    "4. hyperactivity는 몸의 움직임, 기다림, 자기조절 관점에서 2문장 이내 설명",
    "5. guidance는 짧은 수행 과제의 한계와 다음 단계인 종합 리포트 안내를 2문장 이내로 설명",
    "6. 한국어로만 작성"
  ].join("\n");
}

async function generateInsights(record) {
  const metrics = computeAssessmentMetrics(record);
  const deterministic = buildDeterministicReport(metrics);
  let payload = {};

  if (geminiApiKey) {
    payload = await callGeminiJson({
      systemInstruction: "You are a warm, professional Korean self-check assistant for attention, focus, and executive-function patterns. Avoid medical labeling language. Return concise Korean JSON only.",
      prompt: buildInsightsPrompt(record, metrics),
      schemaHint: [
        "Schema:",
        "{",
        '  "report": {',
        '    "severity": "낮음|중간|높음",',
        '    "hero": {',
        '      "badges": ["string", "string"],',
        '      "summary": "string"',
        "    },",
        '    "crossCheck": {',
        '      "subjectiveTitle": "string",',
        '      "subjectiveText": "string",',
        '      "objectiveTitle": "string",',
        '      "objectiveText": "string",',
	        '      "alignmentLabel": "string",',
	        '      "alignmentSummary": "string"',
	        "    },",
	        '    "burdenPattern": {',
	        '      "type": "수렴형 어려움형|주관적 어려움 우세형|수행 불안정성 우세형|낮은 신호형",',
	        '      "summary": "string",',
	        '      "guidance": "string"',
	        "    },",
	        '    "profile": {',
        '      "inattentionSummary": "string",',
        '      "impulsivitySummary": "string"',
        "    },",
        '    "dailyImpact": {',
        '      "empathy": "string"',
        "    },",
        '    "sections": {',
        '      "strength": "string",',
        '      "watchout": "string"',
        "    }",
        "  },",
        '  "plan": {',
        '    "suggestions": ["string", "string", "string"],',
        '    "openingMessage": "string"',
        "  }",
        "}"
      ].join("\n")
    });
  }

  const mergedReport = payload.report || {};

  return {
    report: {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      severity: mergedReport.severity || deterministic.report.severity,
      scores: metrics.scores,
      sections: {
        summary: mergedReport.sections?.summary || deterministic.report.sections.summary,
        strength: mergedReport.sections?.strength || deterministic.report.sections.strength,
        watchout: mergedReport.sections?.watchout || deterministic.report.sections.watchout
      },
      hero: {
        badges: Array.isArray(mergedReport.hero?.badges) && mergedReport.hero.badges.length
          ? mergedReport.hero.badges.slice(0, 3)
          : deterministic.report.hero.badges,
        summary: mergedReport.hero?.summary || deterministic.report.hero.summary
      },
	      crossCheck: {
	        subjectiveTitle: mergedReport.crossCheck?.subjectiveTitle || deterministic.report.crossCheck.subjectiveTitle,
	        subjectiveText: mergedReport.crossCheck?.subjectiveText || deterministic.report.crossCheck.subjectiveText,
	        objectiveTitle: mergedReport.crossCheck?.objectiveTitle || deterministic.report.crossCheck.objectiveTitle,
	        objectiveText: mergedReport.crossCheck?.objectiveText || deterministic.report.crossCheck.objectiveText,
	        alignmentLabel: mergedReport.crossCheck?.alignmentLabel || deterministic.report.crossCheck.alignmentLabel,
	        alignmentSummary: mergedReport.crossCheck?.alignmentSummary || deterministic.report.crossCheck.alignmentSummary
	      },
	      burdenPattern: {
	        ...deterministic.report.burdenPattern,
	        ...(mergedReport.burdenPattern || {}),
	        type: deterministic.report.burdenPattern.type,
	        subjectiveBurdenScore: deterministic.report.burdenPattern.subjectiveBurdenScore,
	        performanceBurdenScore: deterministic.report.burdenPattern.performanceBurdenScore,
	        threshold: deterministic.report.burdenPattern.threshold,
	        subjectiveLevel: deterministic.report.burdenPattern.subjectiveLevel,
	        performanceLevel: deterministic.report.burdenPattern.performanceLevel,
	        note: deterministic.report.burdenPattern.note
	      },
	      profile: {
        inattentionSummary: mergedReport.profile?.inattentionSummary || deterministic.report.profile.inattentionSummary,
        impulsivitySummary: mergedReport.profile?.impulsivitySummary || deterministic.report.profile.impulsivitySummary,
        hyperactivitySummary: mergedReport.profile?.hyperactivitySummary || deterministic.report.profile.hyperactivitySummary || ""
      },
      dailyImpact: {
        level: metrics.dailyImpactLevel,
        label: mergedReport.dailyImpact?.label || buildDailyImpactLabel(metrics.dailyImpactLevel),
        empathy: mergedReport.dailyImpact?.empathy || deterministic.report.dailyImpact.empathy
      },
      bridge: {
        cta: mergedReport.bridge?.cta || deterministic.report.bridge.cta
      }
    },
    plan: {
      suggestions: normalizePlanSuggestions(payload.plan?.suggestions, deterministic.plan.suggestions),
      chat: [
        {
          role: "assistant",
          text: payload.plan?.openingMessage || deterministic.plan.openingMessage
        }
      ]
    }
  };
}

async function generateChatReply(record, message) {
  const metrics = computeAssessmentMetrics(record);
  const payload = await callGeminiJson({
    systemInstruction: "You are a concise Korean AI coach for an attention and executive-function self-check app. Avoid medical labeling language. Return JSON only.",
    prompt: buildChatPrompt(record, message, metrics),
    schemaHint: [
      "Schema:",
      "{",
      '  "reply": "string",',
      '  "additionalSuggestion": "string or empty string"',
      "}"
    ].join("\n")
  });

  return {
    reply: payload.reply || "요청 내용을 반영해 시작 장벽을 낮추는 쪽으로 계획을 조정해 보겠습니다.",
    additionalSuggestion: normalizePlanSuggestion(payload.additionalSuggestion || "")
  };
}

async function generateAsrsAnalysis(record, analysis) {
  const metrics = computeAssessmentMetrics(record);
  const payload = await callGeminiJson({
    systemInstruction: "You are a concise Korean assistant for interpreting self-check responses without medical labeling language. Return JSON only.",
    prompt: buildAsrsAnalysisPrompt(record, analysis, metrics),
    schemaHint: [
      "Schema:",
      "{",
      '  "summary": "string",',
      '  "attention": "string",',
      '  "hyperactivity": "string",',
      '  "guidance": "string"',
      "}"
    ].join("\n")
  });

  return {
    summary: payload.summary || "자가보고 응답에서 현재 주의집중 관련 어려움의 강도를 함께 살펴볼 필요가 있습니다.",
    attention: payload.attention || "집중 유지 관련 응답 지표를 기준으로 일상 집중 유지와 시작 지연 패턴을 확인할 수 있습니다.",
    hyperactivity: payload.hyperactivity || "반응 조절 관련 응답 지표를 기준으로 몸의 안절부절함이나 끼어들기 양상을 참고할 수 있습니다.",
    guidance: payload.guidance || "이 내용은 의학적 진단이 아니라 자기점검 참고 자료이므로, 어려움이 지속되면 전문가 상담을 함께 고려하는 것이 좋습니다."
  };
}

async function generateDsmAnalysis(record, analysis) {
  const metrics = computeAssessmentMetrics(record);
  const payload = await callGeminiJson({
    systemInstruction: "You are a concise Korean assistant for interpreting executive-function self-check responses without medical labeling language. Return JSON only.",
    prompt: buildDsmAnalysisPrompt(record, analysis, metrics),
    schemaHint: [
      "Schema:",
      "{",
      '  "summary": "string",',
      '  "subtype": "string",',
      '  "inattention": "string",',
      '  "hyperactivity": "string",',
      '  "guidance": "string"',
      "}"
    ].join("\n")
  });

  return {
    summary: payload.summary || "세부 자기점검 응답에서는 현재 집중 유지와 반응 조절 부담의 분포를 함께 살펴볼 필요가 있습니다.",
    subtype: payload.subtype || `현재 응답은 ${analysis.subtype || "패턴 확인 중"}으로 정리됩니다.`,
    inattention: payload.inattention || `집중 유지 문항은 ${analysis.inattentionYes || 0} / 9개 Yes로 집계되었습니다.`,
    hyperactivity: payload.hyperactivity || `반응 조절 문항은 ${analysis.hyperactivityYes || 0} / 9개 Yes로 집계되었습니다.`,
    guidance: payload.guidance || "이 내용은 의학적 진단이 아니라 자기점검 참고 자료이므로 어려움이 지속되면 전문가 상담을 함께 고려하는 것이 좋습니다."
  };
}

async function generateReactivityAnalysis(record, analysis) {
  const metrics = computeAssessmentMetrics(record);
  const payload = await callGeminiJson({
    systemInstruction: "You are a warm, concise Korean assistant for explaining short reactivity test results in plain language. Return JSON only.",
    prompt: buildReactivityAnalysisPrompt(record, analysis, metrics),
    schemaHint: [
      "Schema:",
      "{",
      '  "summary": "string",',
      '  "inattention": "string",',
      '  "impulsivity": "string",',
      '  "hyperactivity": "string",',
      '  "guidance": "string"',
      "}"
    ].join("\n")
  });

  return {
    summary: payload.summary || analysis.summary || "반응성 과제에서는 일부 수행 지표를 함께 참고할 필요가 있습니다.",
    inattention: payload.inattention || analysis.inattention || "신호 찾기 결과를 바탕으로 집중 유지 관련 수행 패턴을 보조적으로 참고할 수 있습니다.",
    impulsivity: payload.impulsivity || analysis.impulsivity || "멈춤 버튼 결과를 바탕으로 반응 조절 관련 수행 패턴을 보조적으로 참고할 수 있습니다.",
    hyperactivity: payload.hyperactivity || analysis.hyperactivity || "균형 유지 결과를 바탕으로 움직임 조절 관련 수행 패턴을 보조적으로 참고할 수 있습니다.",
    guidance: payload.guidance || analysis.guidance || "반응성 과제는 짧은 수행 기반의 보조 자료이므로 자기점검 응답과 생활 맥락을 함께 해석하는 것이 적절합니다."
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname.startsWith("/api/config/")) {
      const fileName = pathname.replace("/api/config/", "");
      const filePath = safeJoin(configDir, fileName);
      const raw = fs.readFileSync(filePath, "utf-8");
      sendJson(res, 200, JSON.parse(raw));
      return;
    }

    if (req.method === "GET" && pathname === "/api/records") {
      const files = fs.readdirSync(databaseDir).filter((file) => file.endsWith(".json"));
      const records = files
        .map((file) => {
          try {
            return getRecordMeta(file);
          } catch (error) {
            return null;
          }
        })
        .filter((record) => record && typeof record.createdAt === "string")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      sendJson(res, 200, records);
      return;
    }

    if (req.method === "GET" && pathname === "/api/analysis") {
      sendJson(res, 200, buildAnalysisSummary());
      return;
    }

    if (req.method === "GET" && pathname === "/api/design-themes") {
      const themes = listDesignThemes().map((theme) => ({
        slug: theme.slug,
        fileName: theme.fileName,
        name: theme.name,
        version: theme.version,
        description: theme.description
      }));
      sendJson(res, 200, {
        themes,
        defaultThemeSlug: themes.some((theme) => theme.slug === "kraken") ? "kraken" : themes[0]?.slug || ""
      });
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/design-themes/")) {
      const slug = pathname.replace("/api/design-themes/", "").trim().toLowerCase();
      const theme = listDesignThemes().find((item) => item.slug === slug);
      if (!theme) {
        sendJson(res, 404, { error: "Design theme not found" });
        return;
      }
      sendJson(res, 200, theme);
      return;
    }

    if (req.method === "GET" && pathname === "/api/map-layout") {
      if (!fs.existsSync(mapLayoutFilePath)) {
        sendJson(res, 200, { nodes: {} });
        return;
      }
      const raw = fs.readFileSync(mapLayoutFilePath, "utf-8");
      sendJson(res, 200, JSON.parse(raw));
      return;
    }

    if (req.method === "GET" && pathname === "/api/ai/status") {
      sendJson(res, 200, {
        configured: Boolean(geminiApiKey),
        model: geminiModel
      });
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/records/")) {
      const fileName = pathname.replace("/api/records/", "");
      const filePath = getRecordFilePath(fileName);
      const raw = fs.readFileSync(filePath, "utf-8");
      sendJson(res, 200, JSON.parse(raw));
      return;
    }

    if (req.method === "POST" && pathname === "/api/records") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.fileName || !payload.data) {
        sendJson(res, 400, { error: "fileName and data are required" });
        return;
      }

      const filePath = getRecordFilePath(payload.fileName);
      saveRecord(filePath, payload.data, payload.writer);
      sendJson(res, 200, { ok: true, fileName: payload.fileName });
      return;
    }

    if (req.method === "POST" && pathname === "/api/map-layout") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");
      const nodes = payload?.nodes;

      if (!nodes || typeof nodes !== "object" || Array.isArray(nodes)) {
        sendJson(res, 400, { error: "nodes object is required" });
        return;
      }

      const normalizedNodes = {};
      for (const [nodeId, position] of Object.entries(nodes)) {
        if (!position || typeof position !== "object") {
          continue;
        }
        const x = Number(position.x);
        const y = Number(position.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          continue;
        }
        normalizedNodes[nodeId] = {
          x: Math.round(x),
          y: Math.round(y)
        };
      }

      const payloadToSave = {
        updatedAt: new Date().toISOString(),
        nodes: normalizedNodes
      };

      fs.writeFileSync(mapLayoutFilePath, JSON.stringify(payloadToSave, null, 2));
      sendJson(res, 200, { ok: true, updatedAt: payloadToSave.updatedAt });
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/insights") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.record) {
        sendJson(res, 400, { error: "record is required" });
        return;
      }

      const insights = await generateInsights(payload.record);
      sendJson(res, 200, insights);
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/chat") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.record || !payload.message) {
        sendJson(res, 400, { error: "record and message are required" });
        return;
      }

      const reply = await generateChatReply(payload.record, String(payload.message));
      sendJson(res, 200, reply);
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/asrs-analysis") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.record || !payload.analysis) {
        sendJson(res, 400, { error: "record and analysis are required" });
        return;
      }

      const analysis = await generateAsrsAnalysis(payload.record, payload.analysis);
      sendJson(res, 200, analysis);
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/dsm-analysis") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.record || !payload.analysis) {
        sendJson(res, 400, { error: "record and analysis are required" });
        return;
      }

      const analysis = await generateDsmAnalysis(payload.record, payload.analysis);
      sendJson(res, 200, analysis);
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/react-analysis") {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");

      if (!payload.record || !payload.analysis) {
        sendJson(res, 400, { error: "record and analysis are required" });
        return;
      }

      const analysis = await generateReactivityAnalysis(payload.record, payload.analysis);
      sendJson(res, 200, analysis);
      return;
    }

    serveStatic(pathname, res);
  } catch (error) {
    const status = error.code === "ENOENT" ? 404 : 500;
    sendJson(res, status, { error: error.message });
  }
});

const port = process.env.PORT || 3333;
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`ADDFCS.COM app listening on http://${host}:${port}`);
});
