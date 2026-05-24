const state = {
  route: "intro",
  configs: {
    asrs: null,
    dsm: null,
    report: null
  },
  aiStatus: null,
  records: [],
  currentRecord: null,
  asrsIndex: 0,
  dsmIndex: 0,
  isGeneratingInsights: false,
  isGeneratingAsrsAnalysis: false,
  isGeneratingDsmAnalysis: false,
  isGeneratingReactivityAnalysis: false,
  loadUserId: "",
  pendingResumeFileName: "",
  pendingResumeRoute: "",
  showExistingIdForm: false,
  idOnboardingStep: "greeting",
  showSurveyDifference: false,
  showAdminModal: false,
  showJsonModal: false,
  showThemeModal: false,
  jsonModalContent: "",
  statusMessage: "",
  designThemes: [],
  activeThemeSlug: "",
  activeTheme: null,
  themeFontScaleEnabled: false,
  gameUi: null,
  hubTrend: {
    id: "",
    loading: false,
    records: [],
    error: ""
  },
  reportProfileTab: "inattention",
  showAsrsExamples: false,
  isAdvancingAsrs: false,
  isAdvancingDsm: false,
  surveyAdvanceTimerId: null,
  preferredBalanceInputSource: null
};

const routes = [
  { key: "hub", label: "홈", icon: "home" },
  { key: "asrs", label: "간단", icon: "quiz" },
  { key: "dsm", label: "심층", icon: "checklist" },
  { key: "game", label: "반응", icon: "neurology" },
  { key: "report", label: "기록", icon: "analytics" }
];

const app = document.querySelector("#app");
const bottomNav = document.querySelector("#bottom-nav");
const topbarActions = document.querySelector("#topbar-actions");
const themeNameplate = document.querySelector("#theme-nameplate");
const THEME_FONT_SCALE_STORAGE_KEY = "soulai-theme-font-scale-enabled";
const GAME_ORDER = ["signal_detection", "go_nogo", "balance_hold"];
const GAME_META = {
  signal_detection: {
    title: "신호 찾기",
    eyebrow: "signal detection",
    domain: "집중 유지 과제",
    description: "파란 별이 나올때만 화면을 클릭합니다.",
    practiceTrials: 6,
    mainTrials: 60
  },
  go_nogo: {
    title: "멈춤 버튼",
    eyebrow: "go / no-go",
    domain: "반응 조절 과제",
    description: "동그라미만 정해진 영역에서 클릭합니다.",
    practiceTrials: 8,
    mainTrials: 50
  },
  balance_hold: {
    title: "균형 유지",
    eyebrow: "balance hold",
    domain: "움직임 조절 과제",
    description: "중앙 영역 안에 공을 머물게 합니다.",
    durationMs: 30000
  }
};
const SIGNAL_IMAGE_BASE_PATH = "/react1";
const SIGNAL_TARGET_IMAGE = `${SIGNAL_IMAGE_BASE_PATH}/0.gif`;
const SIGNAL_STIMULUS_DURATION_MS = 500;
const SIGNAL_ISI_OPTIONS_MS = [1000, 1250, 1500];
const SIGNAL_MIN_VALID_RT_MS = 100;
const SIGNAL_FEEDBACK_IMAGES = {
  idle: `${SIGNAL_IMAGE_BASE_PATH}/idle.png`,
  success: `${SIGNAL_IMAGE_BASE_PATH}/true.png`,
  fail: `${SIGNAL_IMAGE_BASE_PATH}/fail.png`
};
const GO_NOGO_IMAGE_BASE_PATH = "/react2";
const GO_NOGO_GIF_DURATION_MS = 500;
const GO_NOGO_STIMULUS_DURATION_MS = GO_NOGO_GIF_DURATION_MS;
const GO_NOGO_ISI_OPTIONS_MS = [800, 1000, 1200];
const GO_NOGO_MIN_VALID_RT_MS = 100;
const GO_NOGO_SUCCESS_MIN_RT_MS = 140;
const GO_NOGO_APPLE_TOUCH_VISUAL_OFFSET_MS = 380;
const GO_NOGO_TOUCH_GRACE_MS = 10;
const GO_NOGO_RESPONSE_WINDOW_EXTENSION_MS = 350;
const GO_NOGO_FAST_RESPONSE_MS = 200;
const BALANCE_PRACTICE_DURATION_MS = 8000;
const GO_NOGO_BACKGROUND_IMAGE = `${GO_NOGO_IMAGE_BASE_PATH}/back.gif`;
const GO_NOGO_FEEDBACK_IMAGES = {
  idle: `${GO_NOGO_IMAGE_BASE_PATH}/idle.png`,
  success: `${GO_NOGO_IMAGE_BASE_PATH}/true.png`,
  fail: `${GO_NOGO_IMAGE_BASE_PATH}/fail.png`
};
const GO_NOGO_STIMULUS_IMAGES = {
  go: `${GO_NOGO_IMAGE_BASE_PATH}/o.gif`,
  nogo: `${GO_NOGO_IMAGE_BASE_PATH}/x.gif`
};
const IMAGE_ASSET_VERSION = "2";
state.introImageSrc = getRandomIntroImageSrc();
const SIGNAL_DISTRACTOR_IMAGES = [1, 2, 3, 4, 5].map((index) => ({
  stimulusType: "non-target",
  variant: index,
  imageSrc: `${SIGNAL_IMAGE_BASE_PATH}/${index}.gif`
}));
const gameRuntime = {
  timeouts: new Set(),
  intervalId: null,
  frameId: null,
  listeners: [],
  activeTrial: null,
  pointerControl: { x: 0, y: 0 },
  balanceTouchActive: false,
  balanceSamples: [],
  lastBalanceSampleAt: 0,
  currentPhase: null,
  currentTestKey: null,
  liveDomUpdater: null
};

init();

async function init() {
  hydrateThemePreferences();
  await Promise.all([
    loadConfigs(),
    loadRecords(),
    loadAiStatus(),
    loadDesignThemes().catch((error) => {
      console.warn("Design theme loading skipped:", error);
      state.designThemes = [];
      state.activeThemeSlug = "";
      state.activeTheme = null;
      applyDesignTheme(null);
    })
  ]);
  const shortcut = await applyShortcutRouteFromUrl();
  if (shortcut?.route && ["report", "plan"].includes(shortcut.route) && state.currentRecord) {
    await ensureInsights().catch((error) => setStatus(error.message));
  }
  render();
}

function hydrateThemePreferences() {
  try {
    state.themeFontScaleEnabled = window.localStorage.getItem(THEME_FONT_SCALE_STORAGE_KEY) === "true";
  } catch (error) {
    state.themeFontScaleEnabled = false;
  }
}

function getShortcutRouteSpec() {
  const params = new URLSearchParams(window.location.search);
  const shortcut = String(params.get("shortcut") || "").trim().toLowerCase();
  const route = String(params.get("route") || "").trim().toLowerCase();
  const test = String(params.get("test") || "").trim().toLowerCase();
  const userId = String(params.get("id") || "").trim();
  const selectedTest = GAME_ORDER.includes(test) ? test : "";
  const validRoutes = new Set(["intro", "id", "hub", "asrs", "asrs-result", "dsm", "dsm-result", "game", "report", "plan"]);

  if (shortcut === "reactivity") {
    return { route: "game", test: selectedTest, userId, gamePhase: "overview" };
  }
  if (shortcut === "reactivity-result") {
    return { route: "game", test: selectedTest, userId, gamePhase: "completed" };
  }
  if (validRoutes.has(route)) {
    return { route, test: route === "game" ? selectedTest : "", userId, gamePhase: "overview" };
  }
  return null;
}

function applyGameShortcutUi(shortcut) {
  const game = getGameState();
  if (!game) {
    return;
  }

  if (shortcut.gamePhase === "completed") {
    const activeTestKey = shortcut.test || game.currentTestKey || GAME_ORDER[GAME_ORDER.length - 1];
    const fallbackResult = game.tests?.[activeTestKey]
      || game.tests?.[GAME_ORDER[GAME_ORDER.length - 1]]
      || {};

    if (game.status === "completed" && game.summary) {
      state.gameUi = {
        ...createOverviewUi(),
        phase: "completed",
        activeTestKey,
        stage: "completed-shortcut",
        result: fallbackResult,
        progressPercent: 100
      };
      return;
    }
    setStatus("완료 화면으로 바로 가려면 먼저 반응성 과제 완료 기록이 필요합니다.");
  }

  resetGameUi();
}

async function applyShortcutRouteFromUrl() {
  const shortcut = getShortcutRouteSpec();
  if (!shortcut) {
    return null;
  }

  if (shortcut.userId) {
    const record = findLatestRecordById(shortcut.userId);
    if (record) {
      await handleLoadRecord(record.fileName);
    } else {
      setStatus("해당 ID의 저장 기록을 찾지 못했습니다.");
    }
  }

  if (["hub", "asrs", "asrs-result", "dsm", "dsm-result", "game", "report", "plan"].includes(shortcut.route)) {
    if (!state.currentRecord) {
      ensureGuestGameRecord();
    }
    const game = getGameState();
    if (shortcut.test) {
      const targetIndex = GAME_ORDER.indexOf(shortcut.test);
      if (targetIndex >= 0) {
        game.currentTestIndex = targetIndex;
        game.currentTestKey = shortcut.test;
      }
    }
  }

  if (shortcut.route === "game") {
    applyGameShortcutUi(shortcut);
  } else {
    resetGameUi();
  }
  state.route = shortcut.route;
  if (state.currentRecord && shortcut.route !== "intro") {
    state.currentRecord.currentStep = shortcut.route;
  }
  return shortcut;
}

async function loadConfigs() {
  const [asrs, dsm, report] = await Promise.all([
    api(`/api/config/asrs.json`),
    api(`/api/config/dsm-5.json`),
    api(`/api/config/report.json`)
  ]);
  state.configs = { asrs, dsm, report };
}

async function loadRecords() {
  state.records = await api("/api/records");
}

async function loadAiStatus() {
  state.aiStatus = await api("/api/ai/status");
}

async function loadDesignThemes() {
  const payload = await api("/api/design-themes");
  state.designThemes = Array.isArray(payload?.themes) ? payload.themes : [];

  if (!state.designThemes.length) {
    state.activeThemeSlug = "";
    state.activeTheme = null;
    applyDesignTheme(null);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedSlug = String(params.get("theme") || "").trim().toLowerCase();
  const resolvedSlug = state.designThemes.some((theme) => theme.slug === requestedSlug)
    ? requestedSlug
    : payload.defaultThemeSlug || state.designThemes[0].slug;

  await selectDesignTheme(resolvedSlug, { replaceHistory: true });
}

function pickFirstToken(theme, candidates, fallback = "") {
  for (const key of candidates) {
    const value = theme?.resolved?.colors?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function setThemeCssVar(name, value) {
  if (!value) {
    return;
  }
  document.documentElement.style.setProperty(name, value);
}

function applyThemeTypographyScale(theme) {
  const typography = theme?.resolved?.typography || {};
  const enabled = state.themeFontScaleEnabled;

  setThemeCssVar("--theme-brand-title-size", enabled ? (typography["title-sm"]?.fontSize || "1.05rem") : "1.05rem");
  setThemeCssVar("--theme-brand-title-letter-spacing", enabled ? (typography["title-sm"]?.letterSpacing || "0.02em") : "0.02em");
  setThemeCssVar("--theme-brand-subtitle-size", enabled ? (typography.caption?.fontSize || "0.54rem") : "0.54rem");
  setThemeCssVar("--theme-brand-subtitle-letter-spacing", enabled ? (typography["label-uppercase"]?.letterSpacing || "0.18em") : "0.18em");
  setThemeCssVar("--theme-nav-label-size", enabled ? (typography["label-uppercase"]?.fontSize || "9px") : "9px");
  setThemeCssVar("--theme-nav-label-letter-spacing", enabled ? (typography["label-uppercase"]?.letterSpacing || "0.08em") : "0.08em");
  setThemeCssVar("--theme-eyebrow-size", enabled ? (typography["label-uppercase"]?.fontSize || "10px") : "10px");
  setThemeCssVar("--theme-eyebrow-letter-spacing", enabled ? (typography["label-uppercase"]?.letterSpacing || "0.1em") : "0.1em");
  setThemeCssVar("--theme-title-xl-size", enabled ? (typography["display-lg"]?.fontSize || "clamp(1.55rem, 6.4vw, 2.8rem)") : "clamp(1.55rem, 6.4vw, 2.8rem)");
  setThemeCssVar("--theme-title-xl-line-height", enabled ? (typography["display-lg"]?.lineHeight || "1.02") : "1.02");
  setThemeCssVar("--theme-title-xl-letter-spacing", enabled ? (typography["display-lg"]?.letterSpacing || "-0.03em") : "-0.03em");
  setThemeCssVar("--theme-title-lg-size", enabled ? (typography["title-lg"]?.fontSize || "clamp(1.22rem, 4.8vw, 1.9rem)") : "clamp(1.22rem, 4.8vw, 1.9rem)");
  setThemeCssVar("--theme-title-lg-line-height", enabled ? (typography["title-lg"]?.lineHeight || "1.1") : "1.1");
  setThemeCssVar("--theme-title-lg-letter-spacing", enabled ? (typography["title-lg"]?.letterSpacing || "-0.02em") : "-0.02em");
  setThemeCssVar("--theme-body-md-size", enabled ? (typography["body-md"]?.fontSize || "0.93rem") : "0.93rem");
  setThemeCssVar("--theme-body-md-line-height", enabled ? (typography["body-md"]?.lineHeight || "1.45") : "1.45");
  setThemeCssVar("--theme-button-size", enabled ? (typography.button?.fontSize || "0.92rem") : "0.92rem");
  setThemeCssVar("--theme-button-letter-spacing", enabled ? (typography.button?.letterSpacing || "0") : "0");
  setThemeCssVar("--theme-button-ghost-size", enabled ? (typography.button?.fontSize || "0.88rem") : "0.88rem");
  setThemeCssVar("--theme-question-size", enabled ? (typography["title-md"]?.fontSize || "clamp(1.05rem, 4.1vw, 1.45rem)") : "clamp(1.05rem, 4.1vw, 1.45rem)");
  setThemeCssVar("--theme-question-line-height", enabled ? (typography["title-md"]?.lineHeight || "1.38") : "1.38");
  setThemeCssVar("--theme-question-letter-spacing", enabled ? (typography["title-md"]?.letterSpacing || "-0.02em") : "-0.02em");
}

function applyDesignTheme(theme) {
  const root = document.documentElement;
  if (!theme) {
    root.removeAttribute("data-design-theme");
    if (themeNameplate) {
      themeNameplate.textContent = "";
    }
    return;
  }

  const colors = theme.resolved?.colors || {};
  const typography = theme.resolved?.typography || {};
  const rounded = theme.resolved?.rounded || {};
  const components = theme.resolved?.components || {};

  const canvas = colors.canvas || "#131313";
  const surface = colors["surface-soft"] || colors["surface-card"] || "#1b1b1b";
  const surfaceCard = colors["surface-card"] || "#1f1f1f";
  const surfaceElevated = colors["surface-elevated"] || colors["surface-card"] || "#2a2a2a";
  const text = colors["body-strong"] || colors.ink || colors.primary || "#e2e2e2";
  const textStrong = colors.primary || colors.ink || "#ffffff";
  const muted = colors.body || colors.muted || "#bbbbbb";
  const accent = pickFirstToken(
    theme,
    ["green-accent", "signal-green", "m-red", "primary", "starbucks-green", "mint", "bmw-blue", "cobalt"],
    "#ffacea"
  );
  const accentStrong = pickFirstToken(
    theme,
    ["house-green", "mint", "m-blue-dark", "soft-purple", "electric-blue", "secondary", "deep-cobalt"],
    "#f67adf"
  );
  const secondary = pickFirstToken(
    theme,
    ["gold", "green-light", "m-blue-light", "soft-purple", "emerald", "bmw-blue", "cobalt", "secondary"],
    "#c2c1ff"
  );
  const secondaryText = colors["on-primary"] || colors["on-dark"] || colors.canvas || "#1900a7";
  const success = colors.success || "#0fa336";
  const warning = colors.warning || "#f4b400";
  const brandStripe = `linear-gradient(90deg, ${secondary} 0 34%, ${accentStrong} 34% 67%, ${accent} 67% 100%)`;

  setThemeCssVar("--theme-canvas", canvas);
  setThemeCssVar("--theme-surface", surface);
  setThemeCssVar("--theme-surface-card", surfaceCard);
  setThemeCssVar("--theme-surface-elevated", surfaceElevated);
  setThemeCssVar("--theme-surface-soft", colors["surface-soft"] || canvas);
  setThemeCssVar("--theme-text", text);
  setThemeCssVar("--theme-text-strong", textStrong);
  setThemeCssVar("--theme-muted", muted);
  setThemeCssVar("--theme-hairline", colors.hairline || "rgba(255,255,255,0.08)");
  setThemeCssVar("--theme-hairline-strong", colors["hairline-strong"] || colors.hairline || "rgba(255,255,255,0.14)");
  setThemeCssVar("--theme-accent", accent);
  setThemeCssVar("--theme-accent-strong", accentStrong);
  setThemeCssVar("--theme-secondary", secondary);
  setThemeCssVar("--theme-secondary-text", secondaryText);
  setThemeCssVar("--theme-success", success);
  setThemeCssVar("--theme-warning", warning);
  setThemeCssVar("--theme-display-font", typography["display-lg"]?.fontFamily || typography["title-lg"]?.fontFamily || '"Plus Jakarta Sans", sans-serif');
  setThemeCssVar("--theme-body-font", typography["body-md"]?.fontFamily || '"Inter", sans-serif');
  setThemeCssVar("--theme-label-font", typography["label-uppercase"]?.fontFamily || typography.button?.fontFamily || '"Space Grotesk", sans-serif');
  applyThemeTypographyScale(theme);
  setThemeCssVar("--theme-radius-panel", components["feature-photo-card"]?.rounded || rounded.md || "1.75rem");
  setThemeCssVar("--theme-radius-card", components["spec-cell"]?.rounded || rounded.sm || "1rem");
  setThemeCssVar("--theme-radius-input", components["text-input"]?.rounded || rounded.sm || "0.9rem");
  setThemeCssVar("--theme-radius-stage", components["model-card"]?.rounded || rounded.md || "2rem");
  setThemeCssVar("--theme-radius-full", rounded.full || "999px");
  setThemeCssVar("--theme-radius-button", components["button-primary"]?.rounded || rounded.full || "999px");
  setThemeCssVar("--theme-radius-chip", components["button-icon"]?.rounded || rounded.full || "999px");
  setThemeCssVar("--theme-shadow-ambient", canvas === "#000000" ? "0 12px 42px rgba(0, 0, 0, 0.36)" : "0 4px 48px rgba(226, 226, 226, 0.06)");
  setThemeCssVar("--theme-button-bg", components["button-primary"]?.backgroundColor || "linear-gradient(135deg, var(--theme-accent), var(--theme-accent-strong))");
  setThemeCssVar("--theme-button-text", components["button-primary"]?.textColor || secondaryText);
  setThemeCssVar("--theme-button-secondary-bg", components["button-primary-outline"]?.backgroundColor === "transparent" ? surfaceElevated : (components["button-on-light"]?.backgroundColor || secondary));
  setThemeCssVar("--theme-button-secondary-text", components["button-primary-outline"]?.textColor || textStrong);
  setThemeCssVar("--theme-button-ghost-bg", components["button-icon"]?.backgroundColor || surfaceElevated);
  setThemeCssVar("--theme-button-ghost-text", components["text-link"]?.textColor || accent);
  setThemeCssVar("--theme-progress-bg", surfaceElevated);
  setThemeCssVar("--theme-progress-fill", "linear-gradient(90deg, var(--theme-secondary), var(--theme-accent-strong), var(--theme-accent))");
  setThemeCssVar("--theme-overlay", "rgba(0, 0, 0, 0.72)");
  setThemeCssVar("--theme-brand-stripe", brandStripe);
  root.setAttribute("data-design-theme", theme.slug);

  if (themeNameplate) {
    themeNameplate.textContent = theme.name || "";
  }
}

function updateThemeFontScalePreference(enabled) {
  state.themeFontScaleEnabled = Boolean(enabled);
  try {
    window.localStorage.setItem(THEME_FONT_SCALE_STORAGE_KEY, String(state.themeFontScaleEnabled));
  } catch (error) {
    console.warn("Unable to persist theme font scale preference:", error);
  }

  applyThemeTypographyScale(state.activeTheme);
  render();
}

async function selectDesignTheme(slug, options = {}) {
  if (!slug) {
    return;
  }
  const theme = await api(`/api/design-themes/${encodeURIComponent(slug)}`);
  state.activeThemeSlug = theme.slug;
  state.activeTheme = theme;
  applyDesignTheme(theme);

  const params = new URLSearchParams(window.location.search);
  params.delete("theme");
  const query = params.toString();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  if (options.replaceHistory) {
    window.history.replaceState({}, "", nextUrl);
  } else {
    window.history.pushState({}, "", nextUrl);
  }
}

async function api(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }
  return response.json();
}

function formatDate(dateLike) {
  return new Date(dateLike).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function makeTimestamp(now) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("") + "-" + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("");
}

function normalizeUserId(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

function createEmptyRecord(userId) {
  const createdAt = new Date().toISOString();
  const safeId = normalizeUserId(userId) || "guest";
  const fileName = `${safeId}-${makeTimestamp(new Date())}.json`;
  return {
    id: safeId,
    createdAt,
    updatedAt: createdAt,
    fileName,
    currentStep: "id",
    tests: {
      asrs: [],
      dsm5: [],
      game: createEmptyGameState()
    },
    asrsAnalysis: null,
    dsm5Analysis: null,
    dsm5QuickAnalysis: null,
    reactivityAnalysis: null,
    report: null,
    plan: {
      suggestions: [],
      chat: []
    }
  };
}

function createEmptyGameState() {
  return {
    status: "pending",
    mode: "assessment",
    currentTestIndex: 0,
    currentTestKey: GAME_ORDER[0],
    tests: {
      signal_detection: null,
      go_nogo: null,
      balance_hold: null
    },
    summary: null,
    rawEventLog: [],
    startedAt: null,
    completedAt: null
  };
}

function ensureGameState(record = state.currentRecord) {
  if (!record) {
    return null;
  }

  if (!record.tests) {
    record.tests = {};
  }

  if (!record.tests.game || typeof record.tests.game !== "object") {
    record.tests.game = createEmptyGameState();
  }

  if (!record.tests.game.tests) {
    record.tests.game.tests = createEmptyGameState().tests;
  }

  if (!Array.isArray(record.tests.game.rawEventLog)) {
    record.tests.game.rawEventLog = [];
  }

  if (!Number.isInteger(record.tests.game.currentTestIndex)) {
    record.tests.game.currentTestIndex = 0;
  }

  record.tests.game.currentTestKey = record.tests.game.currentTestKey || GAME_ORDER[record.tests.game.currentTestIndex] || GAME_ORDER[0];
  record.tests.game.mode = record.tests.game.mode || "assessment";
  return record.tests.game;
}

function ensureGuestGameRecord() {
  if (state.currentRecord) {
    return;
  }

  const guestId = `reactivity-${makeTimestamp(new Date())}`;
  state.currentRecord = createEmptyRecord(guestId);
  state.currentRecord.currentStep = "game";
  ensureGameState();
  persistRecord().catch((error) => setStatus(error.message));
}

function getGameState(record = state.currentRecord) {
  return ensureGameState(record);
}

function getAsrsAnswers(record = state.currentRecord) {
  const raw = record?.tests?.asrs || record?.tests?.asar || [];
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === "number" ? { answer: item } : item));
  }
  if (Array.isArray(raw?.responses)) {
    return raw.responses.map((answer) => ({ answer }));
  }
  return [];
}

function getDsmAnswers(record = state.currentRecord) {
  const raw = record?.tests?.dsm5 || [];
  if (Array.isArray(raw)) {
    return raw.map((item, index) => {
      if (typeof item?.answer === "boolean") {
        return item;
      }
      if (typeof item === "boolean") {
        return {
          section: state.configs.dsm?.questions?.[index]?.section,
          answer: item
        };
      }
      return item;
    });
  }
  if (Array.isArray(raw?.responses)) {
    return raw.responses.map((answer, index) => ({
      section: state.configs.dsm?.questions?.[index]?.section,
      answer
    }));
  }
  return [];
}

function normalizeCurrentStep(step) {
  return step === "asar" ? "asrs" : step === "id" ? "hub" : step;
}

function findLatestRecordById(userId) {
  const normalizedId = normalizeUserId(userId);
  return state.records.find((record) => record.id === normalizedId) || null;
}

async function syncCurrentStep(route) {
  if (!state.currentRecord) {
    return;
  }

  const flowSteps = new Set(["hub", "asrs", "asrs-result", "dsm", "dsm-result", "game", "report", "plan"]);
  if (!flowSteps.has(route)) {
    return;
  }

  state.currentRecord.currentStep = route;
  if (route === "plan") {
    state.currentRecord.completedPlanOnce = true;
  }
  await persistRecord();
}

function analyzeAsrs(record = state.currentRecord) {
  const answers = getAsrsAnswers(record)
    .map((item) => Number(item.answer))
    .filter((value) => Number.isFinite(value));
  const thresholds = [2, 2, 2, 3, 3, 3];
  const positiveFlags = answers.map((answer, index) => answer >= thresholds[index]);
  const totalPositive = positiveFlags.filter(Boolean).length;
  const attentionPositive = positiveFlags.slice(0, 4).filter(Boolean).length;
  const hyperPositive = positiveFlags.slice(4).filter(Boolean).length;
  const isComplete = answers.length === 6;
  const severity = totalPositive >= 4 ? "뚜렷함" : "살펴볼 만함";

  let summary = "현재 응답만으로는 주의·집중 어려움이 크게 두드러지지는 않습니다.";
  if (totalPositive >= 4) {
    summary = "간단 자기점검에서 주의·집중 또는 실행 기능 부담이 비교적 크게 나타났습니다.";
  } else if (totalPositive >= 2) {
    summary = "간단 자기점검에서 일부 주의·집중 또는 실행 기능 관련 어려움이 나타나 생활 맥락을 함께 살펴볼 만합니다.";
  }

  const attentionMessage = attentionPositive
    ? `집중 유지와 일 시작 관련 문항 4개 중 ${attentionPositive}개에서 부담이 표시됐습니다. 마감 관리, 시작 지연, 끝까지 붙잡기에서 어려움이 나타날 수 있습니다.`
    : "집중 유지와 일 시작 관련 문항에서는 부담 응답이 많지 않습니다.";
  const hyperMessage = hyperPositive
    ? `반응 조절 관련 문항 2개 중 ${hyperPositive}개에서 부담이 표시됐습니다. 오래 앉아 있기 어렵거나 대화 중 먼저 반응하는 양상이 함께 있을 수 있습니다.`
    : "반응 조절 관련 문항에서는 부담 응답이 많지 않습니다.";
  const guidance = totalPositive >= 4
    ? "이 내용은 의학적 진단이 아니라 자기점검 참고 자료예요. 다음 반응성 과제에서 목표를 찾고 멈추는 수행 패턴도 함께 살펴볼게요."
    : "이 내용만으로 단정하지는 않아요. 다음 반응성 과제를 통해 설문에서 느낀 점과 실제 수행 패턴이 비슷한지 이어서 확인해 볼게요.";

  return {
    answers,
    isComplete,
    totalPositive,
    attentionPositive,
    hyperPositive,
    severity,
    summary,
    attentionMessage,
    hyperMessage,
    guidance
  };
}

function analyzeDsm(record = state.currentRecord) {
  const answers = getDsmAnswers(record).filter((item) => typeof item?.answer === "boolean");
  const inattentionYes = answers
    .filter((item) => item.section === "부주의" && item.answer)
    .length;
  const hyperactivityYes = answers
    .filter((item) => item.section === "과잉행동/충동성" && item.answer)
    .length;
  const contextualYes = answers
    .filter((item) => item.section === "추가 확인" && item.answer)
    .length;
  const totalQuestions = state.configs.dsm?.questions?.length || 18;
  const completedCount = answers.length;
  const isComplete = completedCount === totalQuestions;

  let subtype = "패턴 확인 중";
  let summary = "아직 세부 점검 응답이 충분하지 않아 현재까지의 흐름만 표시합니다.";
  let detail = "최근 6개월 동안의 반복 패턴을 기준으로 끝까지 응답하면 어느 영역의 부담이 큰지 볼 수 있습니다.";

  if (isComplete) {
    if (inattentionYes >= 6 && hyperactivityYes >= 6) {
      subtype = "복합 실행 기능 패턴";
      summary = "집중 유지와 반응 조절 영역의 부담이 함께 크게 나타났습니다.";
      detail = "집중을 유지하는 어려움과 빠른 반응/안절부절함이 함께 보이는 패턴입니다.";
    } else if (inattentionYes >= 6) {
      subtype = "집중 유지 부담 패턴";
      summary = "집중 유지와 정리·마무리 관련 부담이 더 두드러집니다.";
      detail = "집중, 정리, 기억, 과제 마무리와 관련된 어려움이 상대적으로 크게 보입니다.";
    } else if (hyperactivityYes >= 6) {
      subtype = "반응 조절 부담 패턴";
      summary = "반응 조절과 기다림 관련 부담이 더 두드러집니다.";
      detail = "안절부절함, 즉각 반응, 기다리기 어려움과 같은 패턴이 상대적으로 크게 보입니다.";
    } else {
      subtype = "큰 부담 낮음";
      summary = "현재 세부 점검에서는 특정 영역의 부담이 크게 모이지 않았습니다.";
      detail = "지금 응답만으로는 한 영역으로 뚜렷하게 몰리는 패턴이 크지 않습니다.";
    }
  } else {
    const inattentionGap = Math.max(6 - inattentionYes, 0);
    const hyperactivityGap = Math.max(6 - hyperactivityYes, 0);
    summary = `현재까지 집중 유지 영역 ${inattentionYes}개, 반응 조절 영역 ${hyperactivityYes}개가 체크됐습니다.`;
    detail = `패턴을 더 안정적으로 보려면 집중 유지 ${inattentionGap}개, 반응 조절 ${hyperactivityGap}개의 추가 응답을 더 확인해야 합니다.`;
  }

  return {
    completedCount,
    totalQuestions,
    isComplete,
    inattentionYes,
    hyperactivityYes,
    contextualYes,
    subtype,
    summary,
    detail,
    guidance: "이 내용은 의학적 진단이 아니라 현재 일상 패턴을 이해하기 위한 참고 자료예요. 다음 반응성 과제에서 실제 수행 패턴도 함께 확인해 볼게요."
  };
}

function buildLocalDsmQuickAnalysis(record = state.currentRecord) {
  const analysis = analyzeDsm(record);
  let subtypeText = "현재 응답만으로는 한 방향으로 단정하기보다 전체 생활 맥락을 함께 보는 것이 적절합니다.";
  if (analysis.isComplete) {
    if (analysis.subtype === "복합 실행 기능 패턴") {
      subtypeText = "집중 유지와 반응 조절 부담이 함께 나타나 두 영역을 같이 살펴볼 필요가 있습니다.";
    } else if (analysis.subtype === "집중 유지 부담 패턴") {
      subtypeText = "집중 유지, 정리, 기억, 마무리와 관련된 어려움이 상대적으로 더 두드러집니다.";
    } else if (analysis.subtype === "반응 조절 부담 패턴") {
      subtypeText = "즉각 반응, 안절부절함, 기다리기 어려움과 같은 패턴이 상대적으로 더 두드러집니다.";
    } else {
      subtypeText = "현재 응답에서는 한 영역으로 뚜렷하게 몰리는 부담이 크게 보이지 않습니다.";
    }
  }

  return {
    summary: analysis.summary,
    subtype: analysis.subtype,
    inattention: `집중 유지 문항은 ${analysis.inattentionYes} / 9개가 체크됐습니다. ${analysis.inattentionYes >= 6 ? "일상에서 집중 유지 부담이 비교적 크게 나타난 편입니다." : "현재 응답만으로는 집중 유지 부담이 크게 모였다고 보기는 어렵습니다."}`,
    hyperactivity: `반응 조절 문항은 ${analysis.hyperactivityYes} / 9개가 체크됐습니다. ${analysis.hyperactivityYes >= 6 ? "일상에서 기다림이나 멈춤 조절 부담이 비교적 크게 나타난 편입니다." : "현재 응답만으로는 반응 조절 부담이 크게 모였다고 보기는 어렵습니다."}`,
    guidance: `${subtypeText} 이 내용은 의학적 진단이 아니라 참고용 자기점검 리포트예요. 다음 반응성 과제에서 실제 수행 패턴도 함께 확인해 볼게요.`
  };
}

function buildLocalReactivityAnalysis(record = state.currentRecord) {
  const game = getGameState(record);
  const summary = game?.summary || summarizeReactivity(record) || {};
  const signal = game?.tests?.signal_detection;
  const goNogo = game?.tests?.go_nogo;
  const balance = game?.tests?.balance_hold;
  const fallbackMessage = "이번 과제에서는 충분한 데이터가 수집되지 않아 이 영역 해석은 보조적으로만 참고해 주세요.";

  let inattention = "신호 찾기 결과가 아직 없어 집중 유지 관련 수행 패턴을 해석할 수 없습니다.";
  if (signal) {
    if (signal.validity?.valid === false) {
      inattention = fallbackMessage;
    } else if (signal.level_summary?.overall === "high") {
      inattention = `목표를 놓치는 비율과 반응시간 흔들림이 함께 커 보여 집중 유지가 자주 끊기는 패턴으로 볼 수 있습니다. 목표 놓침은 ${roundTo((signal.omission_rate || 0) * 100, 1)}% 수준입니다.`;
    } else if (signal.level_summary?.overall === "moderate") {
      inattention = `간헐적인 목표 놓침이나 반응시간 흔들림이 보여 집중 유지 일관성을 함께 볼 필요가 있습니다. 목표 놓침은 ${roundTo((signal.omission_rate || 0) * 100, 1)}% 수준입니다.`;
    } else {
      inattention = `목표 자극에 대한 반응은 전반적으로 안정적인 편입니다. 목표 놓침은 ${roundTo((signal.omission_rate || 0) * 100, 1)}% 수준으로 비교적 낮습니다.`;
    }
  }

  let impulsivity = "멈춤 버튼 결과가 아직 없어 반응 억제 관련 수행 패턴을 해석할 수 없습니다.";
  if (goNogo) {
    const commissionRate = roundTo((goNogo.commission_rate || goNogo.inhibition_failure_rate || 0) * 100, 1);
    if (goNogo.validity?.valid === false) {
      impulsivity = fallbackMessage;
    } else if (goNogo.level_summary?.overall === "high") {
      impulsivity = `멈춰야 할 자극에서 반응하는 비율이 높아 반응 억제 과제에서 실수가 자주 나타났습니다. 잘못된 반응은 ${commissionRate}% 수준입니다.`;
    } else if (goNogo.level_summary?.overall === "moderate") {
      impulsivity = `참아야 할 자극에 가끔 반응하는 패턴이 있어 반응 억제를 함께 볼 필요가 있습니다. 잘못된 반응은 ${commissionRate}% 수준입니다.`;
    } else {
      impulsivity = `전반적인 억제 조절은 비교적 안정적인 편입니다. 잘못된 반응은 ${commissionRate}% 수준으로 낮습니다.`;
    }
  }

  let hyperactivity = "균형 유지 결과가 아직 없어 움직임 조절 관련 수행 패턴을 해석할 수 없습니다.";
  if (balance) {
    if (balance.validity?.valid === false) {
      hyperactivity = fallbackMessage;
    } else if (balance.level_summary?.overall === "high") {
      hyperactivity = `기기를 안정적으로 유지하기 어려운 흔들림이 자주 관찰됩니다. 안정 유지 시간은 ${balance.stable_duration_pct || 0}% 수준입니다.`;
    } else if (balance.level_summary?.overall === "moderate") {
      hyperactivity = `기기를 유지하는 동안 간헐적인 흔들림이 있어 활동성 신호를 보조적으로 참고할 수 있습니다. 안정 유지 시간은 ${balance.stable_duration_pct || 0}% 수준입니다.`;
    } else {
      hyperactivity = `기기 유지 패턴은 비교적 안정적인 편입니다. 안정 유지 시간은 ${balance.stable_duration_pct || 0}% 수준으로 양호합니다.`;
    }
  }

  return {
    source: "local",
    summary: summary.summary || "반응성 과제 3종 기록이 저장되었습니다.",
    inattention,
    impulsivity,
    hyperactivity,
    guidance: "반응성 과제는 짧은 수행 기반의 보조 자료이므로, 자가점검 응답과 생활 맥락을 함께 보고 해석하는 것이 적절합니다. 의학적 진단을 대신하지 않습니다."
  };
}

function summarizeAsrsForStorage(record = state.currentRecord) {
  const responses = getAsrsAnswers(record)
    .map((item) => Number(item.answer))
    .filter((value) => Number.isFinite(value));
  const attentionResponses = responses.slice(0, 4);
  const hyperactivityResponses = responses.slice(4, 6);
  const analysis = analyzeAsrs(record);

  return {
    responses,
    attention_score: attentionResponses.reduce((sum, value) => sum + value, 0),
    attention_max: 16,
    hyperactivity_score: hyperactivityResponses.reduce((sum, value) => sum + value, 0),
    hyperactivity_max: 8,
    total_score: responses.reduce((sum, value) => sum + value, 0),
    total_max: 24,
    positive_count: analysis.totalPositive
  };
}

function summarizeDsmForStorage(record = state.currentRecord) {
  const responses = getDsmAnswers(record)
    .map((item) => (typeof item?.answer === "boolean" ? item.answer : null));
  const analysis = analyzeDsm(record);

  return {
    responses,
    inattention_true_count: analysis.inattentionYes,
    hyperactivity_true_count: analysis.hyperactivityYes,
    contextual_true_count: analysis.contextualYes,
    total_true_count: analysis.inattentionYes + analysis.hyperactivityYes,
    subtype: analysis.subtype
  };
}

function summarizeGameForStorage(record = state.currentRecord) {
  const game = getGameState(record);
  if (!game) {
    return createEmptyGameState();
  }

  const compactTests = Object.fromEntries(
    Object.entries(game.tests || {}).map(([key, value]) => {
      if (!value || typeof value !== "object") {
        return [key, null];
      }

      return [key, {
        test_type: value.test_type || key,
        mode: value.mode || "assessment",
        score: Number.isFinite(value.score) ? value.score : null,
        interpretation: value.interpretation || "",
        validity: value.validity || null,
        level_summary: value.level_summary || null,
        ...(key === "signal_detection" ? {
          trial_count: value.trial_count ?? null,
          target_count: value.target_count ?? null,
          non_target_count: value.non_target_count ?? null,
          hit_count: value.hit_count ?? null,
          omission_errors: value.omission_errors ?? null,
          false_alarm_count: value.false_alarm_count ?? null,
          omission_rate: value.omission_rate ?? null,
          mean_reaction_time: value.mean_reaction_time ?? null,
          reaction_time_variability: value.reaction_time_variability ?? null,
          late_response_count: value.late_response_count ?? null,
          tau: value.tau ?? null,
          late_phase_drop: value.late_phase_drop ?? null,
          anticipatory_count: value.anticipatory_count ?? null,
          raw_trials: Array.isArray(value.raw_trials) ? value.raw_trials : []
        } : {}),
        ...(key === "go_nogo" ? {
          go_count: value.go_count ?? null,
          nogo_count: value.nogo_count ?? null,
          go_hit_count: value.go_hit_count ?? null,
          go_omission_count: value.go_omission_count ?? null,
          commission_errors: value.commission_errors ?? null,
          successful_stop_count: value.successful_stop_count ?? null,
          false_stop_count: value.false_stop_count ?? null,
          late_stop_count: value.late_stop_count ?? null,
          mean_go_reaction_time: value.mean_go_reaction_time ?? null,
          mean_stop_latency: value.mean_stop_latency ?? null,
          premature_response_count: value.premature_response_count ?? null,
          post_error_slowing: value.post_error_slowing ?? null,
          inhibition_failure_rate: value.inhibition_failure_rate ?? null,
          hold_success_rate: value.hold_success_rate ?? null,
          commission_rate: value.commission_rate ?? null,
          fast_error_rate: value.fast_error_rate ?? null,
          anticipatory_count: value.anticipatory_count ?? null,
          raw_trials: Array.isArray(value.raw_trials) ? value.raw_trials : []
        } : {}),
        ...(key === "balance_hold" ? {
          stable_hold_time: value.stable_hold_time ?? null,
          drift_distance: value.drift_distance ?? null,
          movement_variability: value.movement_variability ?? null,
          large_motion_count: value.large_motion_count ?? null,
          correction_count: value.correction_count ?? null,
          inside_target_ratio: value.inside_target_ratio ?? null,
          input_source: value.input_source ?? null,
          stable_duration_pct: value.stable_duration_pct ?? null,
          spike_count: value.spike_count ?? null,
          total_movement: value.total_movement ?? null,
          raw_samples: Array.isArray(value.raw_samples) ? value.raw_samples : []
        } : {})
      }];
    })
  );

  return {
    status: game.status || "pending",
    mode: game.mode || "assessment",
    currentTestIndex: game.currentTestIndex || 0,
    currentTestKey: game.currentTestKey || GAME_ORDER[0],
    tests: compactTests,
    rawEventLog: Array.isArray(game.rawEventLog) ? game.rawEventLog : [],
    summary: game.summary || {
      inattention_signal_score: game.summary?.inattention_signal?.score ?? null,
      impulsivity_signal_score: game.summary?.impulsivity_signal?.score ?? null,
      activity_signal_score: game.summary?.activity_signal?.score ?? null
    },
    startedAt: game.startedAt || null,
    completedAt: game.completedAt || null
  };
}

function buildPersistedRecord(record = state.currentRecord) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    fileName: record.fileName,
    currentStep: record.currentStep,
    tests: {
      asrs: summarizeAsrsForStorage(record),
      dsm5: summarizeDsmForStorage(record),
      game: summarizeGameForStorage(record)
    },
    asrsAnalysis: record.asrsAnalysis || null,
    dsm5Analysis: record.dsm5Analysis || null,
    dsm5QuickAnalysis: record.dsm5QuickAnalysis || null,
    reactivityAnalysis: record.reactivityAnalysis || null,
    report: record.report || null,
    plan: record.plan || { suggestions: [], chat: [] },
    dtx: record.dtx || null,
    planGame: record.planGame || null,
    tutorials: record.tutorials || null,
    completedPlanOnce: Boolean(record.completedPlanOnce || record.currentStep === "plan" || record.plan?.suggestions?.length)
  };
}

function renderTopbarActions() {
  if (!topbarActions) {
    return;
  }

  const shouldShowHubButton = Boolean(
    state.currentRecord
      && (state.currentRecord.completedPlanOnce || state.currentRecord.currentStep === "plan" || state.currentRecord.plan?.suggestions?.length)
  );

  topbarActions.innerHTML = `
    ${shouldShowHubButton ? `<button class="button-ghost topbar-button" type="button" id="topbar-hub-button">허브로 가기</button>` : ""}
    <button class="button-ghost topbar-button" type="button" id="open-json-modal">기록</button>
  `;

  topbarActions.querySelector("#topbar-hub-button")?.addEventListener("click", () => {
    navTo("hub");
  });

  topbarActions.querySelector("#open-theme-modal")?.addEventListener("click", () => {
    openThemeModal();
  });

  topbarActions.querySelector("#open-json-modal")?.addEventListener("click", () => {
    openJsonModal().catch((error) => setStatus(error.message));
  });
}

function openThemeModal() {
  state.showThemeModal = true;
  render();
}

function closeThemeModal() {
  state.showThemeModal = false;
  render();
}

async function openJsonModal() {
  if (!state.currentRecord?.fileName) {
    state.jsonModalContent = JSON.stringify({
      message: "아직 생성되거나 불러온 자기점검 기록이 없습니다."
    }, null, 2);
    state.showJsonModal = true;
    render();
    return;
  }

  const latestRecord = await api(`/api/records/${state.currentRecord.fileName}`);
  state.jsonModalContent = JSON.stringify(latestRecord, null, 2);
  state.showJsonModal = true;
  render();
}

function closeJsonModal() {
  state.showJsonModal = false;
  render();
}

async function persistRecord() {
  if (!state.currentRecord) {
    return;
  }

  state.currentRecord.updatedAt = new Date().toISOString();
  const payload = buildPersistedRecord(state.currentRecord);
  await api("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: state.currentRecord.fileName,
      data: payload
    })
  });
  await loadRecords();
}

function setStatus(message) {
  state.statusMessage = message;
  render();
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    state.statusMessage = "";
    render();
  }, 2200);
}

function requireRecord(nextRoute) {
  if (!state.currentRecord) {
    setStatus("먼저 ID를 생성하거나 불러와 주세요.");
    state.route = "id";
    render();
    return false;
  }
  state.route = nextRoute;
  render();
  return true;
}

function navTo(route) {
  if (route === "game" && !state.currentRecord) {
    ensureGuestGameRecord();
    resetGameUi();
  }

  if (["hub", "asrs", "asrs-result", "dsm", "dsm-result", "report", "plan"].includes(route) && !state.currentRecord) {
    requireRecord(route);
    return;
  }

  if (route === "dtx" && !state.currentRecord) {
    requireRecord("hub");
    return;
  }

  if (route !== "game") {
    cleanupGameRuntime();
  }
  state.route = route;
  render();
}

async function handleCreateId(event) {
  event.preventDefault();
  const userId = new FormData(event.currentTarget).get("userId");
  state.currentRecord = createEmptyRecord(String(userId || ""));
  state.currentRecord.currentStep = "id";
  state.showAsrsExamples = false;
  state.isAdvancingAsrs = false;
  state.isAdvancingDsm = false;
  state.idOnboardingStep = "survey-choice";
  state.showSurveyDifference = false;
  await persistRecord();
  state.records = await api("/api/records");
  setStatus(`${state.currentRecord.fileName} 생성 완료`);
  render();
}

async function handleLoadRecord(fileName) {
  state.currentRecord = await api(`/api/records/${fileName}`);
  const normalizedLoadedStep = normalizeCurrentStep(state.currentRecord.currentStep || "id");
  const shouldRestorePlanReached = !state.currentRecord.completedPlanOnce
    && getGameState(state.currentRecord)?.status === "completed"
    && ["asrs", "asrs-result", "dsm", "dsm-result"].includes(normalizedLoadedStep)
    && !state.currentRecord.report
    && !state.currentRecord.plan?.suggestions?.length;
  state.currentRecord.completedPlanOnce = Boolean(
    state.currentRecord.completedPlanOnce
      || state.currentRecord.currentStep === "plan"
      || state.currentRecord.plan?.suggestions?.length
      || shouldRestorePlanReached
  );
  if (!state.currentRecord.tests.asrs && state.currentRecord.tests.asar) {
    state.currentRecord.tests.asrs = state.currentRecord.tests.asar;
  }
  state.currentRecord.asrsAnalysis = state.currentRecord.asrsAnalysis || null;
  if (!state.currentRecord.dsm5Analysis) {
    state.currentRecord.dsm5Analysis = analyzeDsm(state.currentRecord);
  }
  state.currentRecord.dsm5QuickAnalysis = state.currentRecord.dsm5QuickAnalysis || null;
  state.currentRecord.reactivityAnalysis = state.currentRecord.reactivityAnalysis || null;
  ensureGameState();
  resetGameUi();
  state.showAsrsExamples = false;
  state.isAdvancingAsrs = false;
  state.isAdvancingDsm = false;
  state.asrsIndex = Math.min(getAsrsAnswers(state.currentRecord).length, state.configs.asrs.questions.length - 1);
  state.dsmIndex = Math.min(getDsmAnswers(state.currentRecord).length, state.configs.dsm.questions.length - 1);
  if (shouldRestorePlanReached) {
    await persistRecord();
  }
  setStatus(`${fileName} 불러오기 완료`);
  let nextRoute = normalizeCurrentStep(state.currentRecord.currentStep || "id");
  if (nextRoute === "game" && hasCompletedReactivity(state.currentRecord) && !state.currentRecord.report) {
    nextRoute = "report";
  }
  navTo(nextRoute);
  if (["report", "plan"].includes(nextRoute)) {
    ensureInsights().catch((error) => setStatus(error.message));
  }
}

function getResumeRoute(record) {
  const normalized = normalizeCurrentStep(record?.currentStep || "hub");
  if (record?.plan?.suggestions?.length || normalized === "plan") {
    return "hub";
  }
  return normalized;
}

async function submitManualLoad(event) {
  event.preventDefault();
  if (!state.loadUserId) {
    setStatus("불러올 ID를 입력해 주세요.");
    return;
  }

  const record = findLatestRecordById(state.loadUserId);
  if (!record) {
    setStatus("해당 ID의 저장 기록을 찾지 못했습니다.");
    return;
  }

  const resumeRoute = getResumeRoute(record);
  if (resumeRoute === "hub") {
    await handleLoadRecord(record.fileName);
    navTo("hub");
    return;
  }

  state.pendingResumeFileName = record.fileName;
  state.pendingResumeRoute = resumeRoute;
  state.idOnboardingStep = "resume-confirm";
  state.showExistingIdForm = false;
  render();
}

async function continuePendingResume() {
  if (!state.pendingResumeFileName) {
    setStatus("이어갈 기록을 찾지 못했습니다.");
    return;
  }
  const route = state.pendingResumeRoute || "hub";
  await handleLoadRecord(state.pendingResumeFileName);
  state.pendingResumeFileName = "";
  state.pendingResumeRoute = "";
  navTo(route);
}

function toggleExistingIdForm() {
  state.showExistingIdForm = !state.showExistingIdForm;
  render();
}

function openAdminModal() {
  state.showAdminModal = true;
  render();
}

function closeAdminModal() {
  state.showAdminModal = false;
  render();
}

function scheduleTimeout(callback, delay) {
  const timeoutId = window.setTimeout(() => {
    gameRuntime.timeouts.delete(timeoutId);
    callback();
  }, delay);
  gameRuntime.timeouts.add(timeoutId);
  return timeoutId;
}

function cleanupGameRuntime() {
  gameRuntime.timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  gameRuntime.timeouts.clear();

  if (gameRuntime.intervalId) {
    window.clearInterval(gameRuntime.intervalId);
    gameRuntime.intervalId = null;
  }

  if (gameRuntime.frameId) {
    window.cancelAnimationFrame(gameRuntime.frameId);
    gameRuntime.frameId = null;
  }

  gameRuntime.listeners.forEach(({ target, type, handler, options }) => {
    target.removeEventListener(type, handler, options);
  });
  gameRuntime.listeners = [];
  gameRuntime.activeTrial = null;
  gameRuntime.balanceSamples = [];
  gameRuntime.balanceTouchActive = false;
  gameRuntime.lastBalanceSampleAt = 0;
  gameRuntime.currentPhase = null;
  gameRuntime.currentTestKey = null;
  gameRuntime.tapHandler = null;
  gameRuntime.metrics = null;
  gameRuntime.liveDomUpdater = null;
}

function addGameListener(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  gameRuntime.listeners.push({ target, type, handler, options });
}

function renderGameUi(nextUi) {
  const prevUi = state.gameUi;
  state.gameUi = {
    ...(state.gameUi || {}),
    ...nextUi
  };

  if (
    typeof gameRuntime.liveDomUpdater === "function" &&
    state.route === "game" &&
    state.gameUi?.phase === "running" &&
    state.gameUi?.activeTestKey === "balance_hold"
  ) {
    gameRuntime.liveDomUpdater(state.gameUi);
    return;
  }
  render();
}

function createOverviewUi() {
  const game = getGameState();
  const activeTestKey = game?.currentTestKey || GAME_ORDER[0];
  return {
    phase: "overview",
    activeTestKey,
    stage: "intro",
    prompt: "",
    message: "",
    countdown: null,
    progressPercent: ((game?.currentTestIndex || 0) / GAME_ORDER.length) * 100,
    signalFeedbackState: "idle",
    goNoGoFeedbackState: "idle"
  };
}

function resetGameUi() {
  state.gameUi = createOverviewUi();
}

function getCurrentGameMeta() {
  const game = getGameState();
  return GAME_META[game?.currentTestKey || GAME_ORDER[0]];
}

function pushGameEvent(event) {
  const game = getGameState();
  if (!game) {
    return;
  }
  game.rawEventLog.push({
    timestamp: Date.now(),
    test_type: game.currentTestKey,
    ...event
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }
  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance);
}

function roundTo(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function averageTopPercentDelta(values, percent = 0.1) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const topCount = Math.max(1, Math.ceil(sorted.length * percent));
  const topSlice = sorted.slice(-topCount);
  return mean(topSlice) - mean(sorted);
}

function buildSignalTrials(count, targetRatio) {
  const targetCount = Math.round(count * targetRatio);
  const trials = [
    ...Array.from({ length: targetCount }, () => ({
      stimulusType: "target",
      variant: 0,
      imageSrc: SIGNAL_TARGET_IMAGE
    })),
    ...Array.from({ length: count - targetCount }, (_, index) => {
      const template = SIGNAL_DISTRACTOR_IMAGES[index % SIGNAL_DISTRACTOR_IMAGES.length];
      return {
        ...template
      };
    })
  ];
  return shuffle(trials);
}

function withReplayToken(src, token) {
  if (!src) {
    return src;
  }
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}v=${encodeURIComponent(token || "0")}`;
}

function buildGoNoGoTrials(count, goRatio) {
  const goCount = Math.round(count * goRatio);
  const nogoCount = Math.max(count - goCount, 0);
  const trials = [];
  let remainingGo = goCount;
  let remainingNoGo = nogoCount;
  let consecutiveGo = 0;

  for (let index = 0; index < count; index += 1) {
    const remainingSlots = count - index;
    const mustReserveGoPrefix = consecutiveGo < 2 ? 2 - consecutiveGo : 0;
    const mustPlaceGo = remainingGo > 0 && (remainingGo === remainingSlots || consecutiveGo < 2);
    const canPlaceNoGo = remainingNoGo > 0
      && consecutiveGo >= 2
      && remainingGo >= 0
      && remainingSlots - 1 >= remainingGo + Math.max(remainingNoGo - 1, 0) + mustReserveGoPrefix
      && !mustPlaceGo;
    const shouldPlaceNoGo = canPlaceNoGo && Math.random() < (remainingNoGo / Math.max(remainingSlots, 1));

    if (shouldPlaceNoGo) {
      trials.push({ stimulusType: "nogo", imageSrc: GO_NOGO_STIMULUS_IMAGES.nogo, label: "엑스" });
      remainingNoGo -= 1;
      consecutiveGo = 0;
      continue;
    }

    if (remainingGo > 0) {
      trials.push({ stimulusType: "go", imageSrc: GO_NOGO_STIMULUS_IMAGES.go, label: "원" });
      remainingGo -= 1;
      consecutiveGo += 1;
      continue;
    }

    trials.push({ stimulusType: "nogo", imageSrc: GO_NOGO_STIMULUS_IMAGES.nogo, label: "엑스" });
    remainingNoGo -= 1;
    consecutiveGo = 0;
  }

  return trials;
}

function buildGoNoGoPracticeTrials() {
  return [
    { stimulusType: "go", imageSrc: GO_NOGO_STIMULUS_IMAGES.go, label: "원" },
    { stimulusType: "go", imageSrc: GO_NOGO_STIMULUS_IMAGES.go, label: "원" },
    { stimulusType: "nogo", imageSrc: GO_NOGO_STIMULUS_IMAGES.nogo, label: "엑스" },
    { stimulusType: "go", imageSrc: GO_NOGO_STIMULUS_IMAGES.go, label: "원" },
    { stimulusType: "go", imageSrc: GO_NOGO_STIMULUS_IMAGES.go, label: "원" },
    { stimulusType: "nogo", imageSrc: GO_NOGO_STIMULUS_IMAGES.nogo, label: "엑스" },
    { stimulusType: "go", imageSrc: GO_NOGO_STIMULUS_IMAGES.go, label: "원" },
    { stimulusType: "go", imageSrc: GO_NOGO_STIMULUS_IMAGES.go, label: "원" }
  ];
}

function detectBalanceInputOptions() {
  const isLikelyMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")
    || Number(navigator.maxTouchPoints || 0) > 1;
  const supportsDeviceMotion = isLikelyMobile
    && (typeof window.DeviceMotionEvent !== "undefined" || typeof window.DeviceOrientationEvent !== "undefined");
  const supportsTouchFallback = "ontouchstart" in window || Number(navigator.maxTouchPoints || 0) > 0;
  return {
    supportsDeviceMotion,
    supportsTouchFallback,
    defaultSource: supportsDeviceMotion ? "sensor" : supportsTouchFallback ? "long_touch" : "pointer"
  };
}

function getBalanceInputDescription(inputSource, isPractice = false) {
  if (inputSource === "sensor") {
    return isPractice
      ? "연습에서는 기기를 기울여 공을 중앙 원 안에 유지하는 감각을 먼저 익혀보세요."
      : "기기를 기울여 공을 중앙 원 안에 최대한 오래 유지하세요.";
  }
  if (inputSource === "long_touch") {
    return isPractice
      ? "연습에서는 중앙 원을 길게 눌러 공을 안쪽에 유지하는 감각을 먼저 익혀보세요."
      : "중앙 원을 길게 눌러 공을 안쪽에 최대한 오래 유지하세요.";
  }
  return isPractice
    ? "연습에서는 마우스나 터치 위치로 움직이는 기준 원을 따라가며 공을 안쪽에 유지해보세요."
    : "마우스나 터치 위치로 움직이는 기준 원을 따라가며 공을 안쪽에 최대한 오래 유지하세요.";
}

function showBalanceInputSelection() {
  cleanupGameRuntime();
  const options = detectBalanceInputOptions();
  renderGameUi({
    phase: "input-select",
    activeTestKey: "balance_hold",
    stage: "practice-input-select",
    progressPercent: (getGameState().currentTestIndex / GAME_ORDER.length) * 100,
    balanceInputOptions: options
  });
}

async function startGameFlow() {
  ensureGuestGameRecord();
  const game = getGameState();
  if (game.status === "completed") {
    if (state.aiStatus?.configured) {
      await ensureReactivityAnalysis().catch((error) => setStatus(error.message));
    }
    await syncCurrentStep("report");
    navTo("report");
    await ensureInsights();
    return;
  }
  game.status = "running";
  game.startedAt = game.startedAt || new Date().toISOString();
  game.currentTestKey = GAME_ORDER[game.currentTestIndex] || GAME_ORDER[0];
  state.currentRecord.currentStep = "game";
  await persistRecord();
  if (game.currentTestKey === "signal_detection") {
    showSignalDetectionInstruction();
    return;
  }
  await startCountdownForTest(game.currentTestKey);
}

async function selectGameTest(testKey) {
  ensureGuestGameRecord();
  const game = getGameState();
  const targetIndex = GAME_ORDER.indexOf(testKey);
  if (targetIndex === -1) {
    return;
  }

  cleanupGameRuntime();
  game.currentTestIndex = targetIndex;
  game.currentTestKey = testKey;
  game.status = "running";
  game.startedAt = game.startedAt || new Date().toISOString();
  state.currentRecord.currentStep = "game";
  state.gameUi = {
    ...createOverviewUi(),
    activeTestKey: testKey,
    progressPercent: (targetIndex / GAME_ORDER.length) * 100
  };
  await persistRecord();
  if (testKey === "signal_detection") {
    showSignalDetectionInstruction();
    return;
  }
  await startCountdownForTest(testKey);
}

function showSignalDetectionInstruction() {
  cleanupGameRuntime();
  const game = getGameState();
  renderGameUi({
    phase: "instruction",
    activeTestKey: "signal_detection",
    stage: "instruction",
    stimulus: {
      stimulusType: "target",
      variant: 0,
      imageSrc: SIGNAL_TARGET_IMAGE
    },
    stimulusVisible: true,
    signalFeedbackState: "idle",
    stimulusReplayToken: `signal-instruction-${Date.now()}`,
    progressPercent: (game.currentTestIndex / GAME_ORDER.length) * 100,
    message: "파란색 별이 나올 때만 클릭하세요. 다음 이미지가 나오기 전까지 클릭 가능합니다."
  });
}

async function startCountdownForTest(testKey) {
  cleanupGameRuntime();
  const game = getGameState();
  game.currentTestKey = testKey;
  gameRuntime.currentTestKey = testKey;
  renderGameUi({
    phase: "countdown",
    activeTestKey: testKey,
    stage: "countdown",
    countdown: 3,
    message: "과제 시작 전 규칙을 다시 확인하세요.",
    progressPercent: (game.currentTestIndex / GAME_ORDER.length) * 100
  });

  for (let value = 3; value >= 1; value -= 1) {
    renderGameUi({ countdown: value });
    await new Promise((resolve) => scheduleTimeout(resolve, 800));
  }

  if (testKey === "signal_detection") {
    startSignalDetectionMain();
  } else if (testKey === "go_nogo") {
    startGoNoGoPractice();
  } else {
    showBalanceInputSelection();
  }
}

function completeCurrentGameTest(result) {
  const game = getGameState();
  game.tests[game.currentTestKey] = result;
  game.status = "running";

  const nextIndex = GAME_ORDER.indexOf(game.currentTestKey) + 1;
  const nextTestKey = GAME_ORDER[nextIndex] || null;

  if (nextTestKey) {
    game.currentTestIndex = nextIndex;
    game.currentTestKey = nextTestKey;
    game.summary = summarizeReactivity();
    persistRecord().catch((error) => setStatus(error.message));
    startCountdownForTest(nextTestKey).catch((error) => setStatus(error.message));
    return;
  }

  game.currentTestIndex = GAME_ORDER.length - 1;
  game.currentTestKey = GAME_ORDER[GAME_ORDER.length - 1];
  game.status = "completed";
  game.completedAt = new Date().toISOString();
  game.summary = summarizeReactivity();
  state.currentRecord.reactivityAnalysis = buildLocalReactivityAnalysis(state.currentRecord);
  persistRecord().catch((error) => setStatus(error.message));
  renderGameUi({
    phase: "completed",
    activeTestKey: result.test_type,
    result,
    progressPercent: 100
  });
}

async function goToNextGameTest() {
  const game = getGameState();
  if (game.status === "completed") {
    if (state.aiStatus?.configured) {
      await ensureReactivityAnalysis().catch((error) => setStatus(error.message));
    }
    await syncCurrentStep("report");
    navTo("report");
    await ensureInsights();
    return;
  }

  await startCountdownForTest(game.currentTestKey);
}

function summarizeReactivity(record = state.currentRecord) {
  const game = getGameState(record);
  if (!game) {
    return null;
  }

  const signal = game.tests.signal_detection;
  const nogo = game.tests.go_nogo;
  const balance = game.tests.balance_hold;

  const inattentionScore = signal?.score ?? null;
  const impulsivityScore = nogo?.score ?? null;
  const activityScore = balance?.score ?? null;

  const parts = [];
  if (Number.isFinite(inattentionScore)) {
    parts.push(`집중 유지 지표 ${inattentionScore}점`);
  }
  if (Number.isFinite(impulsivityScore)) {
    parts.push(`반응 조절 지표 ${impulsivityScore}점`);
  }
  if (Number.isFinite(activityScore)) {
    parts.push(`움직임 조절 지표 ${activityScore}점`);
  }

  const sorted = [
    { key: "집중 유지", value: inattentionScore },
    { key: "반응 조절", value: impulsivityScore },
    { key: "움직임 조절", value: activityScore }
  ].filter((item) => Number.isFinite(item.value)).sort((a, b) => b.value - a.value);

  let summary = "반응성 과제 3종 기록이 저장되었습니다.";
  if (sorted.length) {
    summary = `${sorted[0].key} 관련 지표가 상대적으로 더 높게 관찰되며, ${parts.join(", ")} 수준입니다.`;
  }

  const highlights = [];
  if (signal) {
    highlights.push({
      label: "신호 찾기 목표 놓침",
      value: `${roundTo((signal.omission_rate || 0) * 100, 1)}%`,
      note: `RT 변동성 ${signal.reaction_time_variability || 0}ms, Tau ${signal.tau || 0}ms`,
      sourceTests: ["Test1"]
    });
    highlights.push({
      label: "후반부 집중 유지",
      value: `${roundTo((signal.late_phase_drop || 0) * 100, 1)}%`,
      note: signal.validity?.valid === false ? "재시행 권장" : `유효 시행 ${signal.trial_count || 0}회`,
      sourceTests: ["Test1"]
    });
  }
  if (nogo) {
    highlights.push({
      label: "잘못된 반응",
      value: `${roundTo((nogo.commission_rate || nogo.inhibition_failure_rate || 0) * 100, 1)}%`,
      note: `성급 반응 ${roundTo((nogo.fast_error_rate || 0) * 100, 1)}%`,
      sourceTests: ["Test2"]
    });
    highlights.push({
      label: "Go 반응시간",
      value: `${nogo.mean_go_reaction_time || 0}ms`,
      note: nogo.level_summary?.pattern === "mixed"
      ? "집중 유지 혼합 패턴"
        : nogo.level_summary?.pattern === "impulsive"
          ? "충동적 반응 패턴"
          : "억제 조절 참고용",
      sourceTests: ["Test2"]
    });
  }
  if (balance) {
    highlights.push({
      label: "안정 유지 시간",
      value: `${balance.stable_duration_pct || 0}%`,
      note: `큰 흔들림 ${balance.spike_count ?? balance.large_motion_count ?? 0}회`,
      sourceTests: ["Test3"]
    });
    highlights.push({
      label: "총 움직임",
      value: `${balance.total_movement || 0}`,
      note: balance.validity?.valid === false ? "보조 참고 지표" : `입력 ${balance.input_source || "-"} `,
      sourceTests: ["Test3"]
    });
  }

  return {
    inattention_signal: {
      score: inattentionScore,
      source_test: "signal_detection"
    },
    impulsivity_signal: {
      score: impulsivityScore,
      source_test: "go_nogo"
    },
    activity_signal: {
      score: activityScore,
      source_test: "balance_hold"
    },
    summary,
    highlights
  };
}

function startSignalDetectionPractice() {
  const practiceTrials = buildSignalTrials(GAME_META.signal_detection.practiceTrials, 0.4);
  runSignalDetectionTrials(practiceTrials, "practice");
}

function startSignalDetectionMain() {
  const mainTrials = buildSignalTrials(GAME_META.signal_detection.mainTrials, 0.25);
  runSignalDetectionTrials(mainTrials, "main");
}

function runSignalDetectionTrials(trials, stage) {
  cleanupGameRuntime();
  const metrics = {
    targetCount: trials.filter((trial) => trial.stimulusType === "target").length,
    nonTargetCount: trials.filter((trial) => trial.stimulusType !== "target").length,
    hitCount: 0,
    omissionErrors: 0,
    falseAlarmCount: 0,
    lateResponseCount: 0,
    reactionTimes: [],
    anticipatoryCount: 0,
    firstHalfHits: 0,
    firstHalfTargets: 0,
    secondHalfHits: 0,
    secondHalfTargets: 0,
    rawTrials: [],
    sessionStartAt: performance.now()
  };
  gameRuntime.metrics = metrics;
  let trialIndex = 0;

  const nextTrial = () => {
    if (trialIndex >= trials.length) {
      if (stage === "practice") {
        renderGameUi({
          phase: "result",
          activeTestKey: "signal_detection",
          stage: "practice-complete",
          result: {
            title: "연습 완료",
            interpretation: "규칙을 확인했습니다. 이제 본 과제 60문항을 시작합니다."
          },
          progressPercent: (getGameState().currentTestIndex / GAME_ORDER.length) * 100
        });
        return;
      }

      const validTrials = metrics.rawTrials.filter((trial) => !trial.is_anticipatory);
      const meanReactionTime = Math.round(mean(metrics.reactionTimes));
      const reactionTimeVariability = Math.round(standardDeviation(metrics.reactionTimes));
      const tau = Math.round(Math.max(0, averageTopPercentDelta(metrics.reactionTimes, 0.1)));
      const firstHalfAccuracy = metrics.firstHalfTargets ? metrics.firstHalfHits / metrics.firstHalfTargets : 0;
      const secondHalfAccuracy = metrics.secondHalfTargets ? metrics.secondHalfHits / metrics.secondHalfTargets : 0;
      const sustainedAttentionDrop = roundTo(clamp(firstHalfAccuracy - secondHalfAccuracy, 0, 1), 2);
      const omissionRate = metrics.targetCount ? metrics.omissionErrors / metrics.targetCount : 0;
      const variabilityPenalty = clamp(reactionTimeVariability / 4, 0, 35);
      const falseAlarmPenalty = metrics.nonTargetCount ? (metrics.falseAlarmCount / metrics.nonTargetCount) * 20 : 0;
      const score = Math.round(clamp(100 - omissionRate * 45 - variabilityPenalty - falseAlarmPenalty - sustainedAttentionDrop * 25, 5, 100));
      const lowGoHitRate = metrics.targetCount ? (metrics.hitCount / metrics.targetCount) < 0.33 : true;
      const excessiveAnticipation = metrics.rawTrials.length ? (metrics.anticipatoryCount / metrics.rawTrials.length) >= 0.5 : false;
      const omissionLevel = omissionRate > 0.25 ? "high" : omissionRate > 0.1 ? "moderate" : "low";
      const variabilityLevel = reactionTimeVariability > 250 ? "high" : reactionTimeVariability > 150 ? "moderate" : "low";
      const tauLevel = tau > 400 ? "high" : tau > 200 ? "moderate" : "low";
      const latePhaseLevel = sustainedAttentionDrop > 0.25 ? "high" : sustainedAttentionDrop > 0.1 ? "moderate" : "low";
      const moderateOrHigherCount = [omissionLevel, variabilityLevel, tauLevel, latePhaseLevel].filter((level) => level !== "low").length;
      const highCount = [omissionLevel, variabilityLevel, tauLevel, latePhaseLevel].filter((level) => level === "high").length;
      const overallLevel = highCount >= 3 ? "high" : moderateOrHigherCount >= 2 ? "moderate" : "low";
      const interpretation = overallLevel === "high"
        ? "누락 오류와 반응시간 흔들림이 커서 주의 유지가 자주 끊기는 패턴이 관찰됩니다."
        : overallLevel === "moderate"
          ? "간헐적인 목표 놓침과 반응 흔들림이 있어 집중 유지 일관성을 함께 볼 필요가 있습니다."
          : "목표 자극 반응은 전반적으로 안정적인 편입니다.";

      completeCurrentGameTest({
        test_type: "signal_detection",
        mode: "assessment",
        trial_count: validTrials.length,
        target_count: metrics.targetCount,
        non_target_count: metrics.nonTargetCount,
        hit_count: metrics.hitCount,
        omission_errors: metrics.omissionErrors,
        false_alarm_count: metrics.falseAlarmCount,
        omission_rate: roundTo(omissionRate, 3),
        mean_reaction_time: meanReactionTime || 0,
        reaction_time_variability: reactionTimeVariability || 0,
        late_response_count: metrics.lateResponseCount,
        tau,
        late_phase_drop: sustainedAttentionDrop,
        anticipatory_count: metrics.anticipatoryCount,
        validity: {
          valid: !lowGoHitRate && !excessiveAnticipation,
          reason: lowGoHitRate
            ? "go_hit_rate_below_threshold"
            : excessiveAnticipation
              ? "anticipatory_responses_over_threshold"
              : null
        },
        level_summary: {
          omission: omissionLevel,
          variability: variabilityLevel,
          tau: tauLevel,
          late_phase: latePhaseLevel,
          overall: overallLevel
        },
        raw_trials: metrics.rawTrials,
        score,
        interpretation
      });
      return;
    }

    const trial = trials[trialIndex];
    const trialNumber = trialIndex + 1;
    const trialStart = performance.now();
    const isiDuration = stage === "practice"
      ? SIGNAL_ISI_OPTIONS_MS[trialIndex % SIGNAL_ISI_OPTIONS_MS.length]
      : SIGNAL_ISI_OPTIONS_MS[Math.floor(Math.random() * SIGNAL_ISI_OPTIONS_MS.length)];
    const nextTrialDelay = SIGNAL_STIMULUS_DURATION_MS + isiDuration;
    const trialMetrics = {
      responded: false,
      responseType: "none"
    };
    const isFirstHalf = trialIndex < Math.ceil(trials.length / 2);
    if (trial.stimulusType === "target") {
      if (isFirstHalf) {
        metrics.firstHalfTargets += 1;
      } else {
        metrics.secondHalfTargets += 1;
      }
    }

    gameRuntime.activeTrial = {
      ...trial,
      stage,
      trialIndex,
      trialStart,
      responseDeadline: trialStart + nextTrialDelay,
      visibleUntil: trialStart + SIGNAL_STIMULUS_DURATION_MS,
      nextTrialAt: trialStart + nextTrialDelay,
      onsetMs: Math.round(trialStart - metrics.sessionStartAt),
      metrics: trialMetrics
    };

    renderGameUi({
      phase: "running",
      activeTestKey: "signal_detection",
      stage,
      prompt: "",
      progressPercent: ((trialIndex + (stage === "main" ? 0 : 0)) / trials.length) * 100,
      trialIndex: trialNumber,
      totalTrials: trials.length,
      stimulus: trial,
      stimulusVisible: true,
      responseWindowState: "visible",
      signalFeedbackState: "idle",
      stimulusReplayToken: `signal-${stage}-${trialIndex}-${Date.now()}`
    });

    scheduleTimeout(() => {
      if (state.gameUi?.activeTestKey === "signal_detection") {
        renderGameUi({
          stimulusVisible: false,
          responseWindowState: "pending"
        });
      }
    }, SIGNAL_STIMULUS_DURATION_MS);

    scheduleTimeout(() => {
      let feedbackState = "success";
      let isCorrect = false;
      if (trial.stimulusType === "target" && !trialMetrics.responded) {
        metrics.omissionErrors += 1;
        feedbackState = "fail";
      } else if (trial.stimulusType === "target" && trialMetrics.responseType === "tap") {
        isCorrect = true;
      }
      if (trialMetrics.responseType === "false_alarm" || trialMetrics.responseType === "late" || trialMetrics.responseType === "anticipatory") {
        feedbackState = "fail";
      }
      if (trial.stimulusType !== "target" && trialMetrics.responseType === "none") {
        isCorrect = true;
      }
      if (state.gameUi?.activeTestKey === "signal_detection") {
        renderGameUi({
          signalFeedbackState: feedbackState,
          responseWindowState: "closing"
        });
      }
      metrics.rawTrials.push({
        trial_number: trialNumber,
        trial_type: trial.stimulusType === "target" ? "go" : "nogo",
        stimulus_shape: trial.stimulusType === "target" ? "circle" : `variant-${trial.variant ?? "x"}`,
        stimulus_onset_ms: gameRuntime.activeTrial?.onsetMs ?? 0,
        response_ms: trialMetrics.responded ? (gameRuntime.activeTrial?.onsetMs ?? 0) + (trialMetrics.reactionTime || 0) : null,
        reaction_time_ms: trialMetrics.reactionTime ?? null,
        is_correct: isCorrect,
        is_anticipatory: trialMetrics.responseType === "anticipatory"
      });
      pushGameEvent({
        trial_index: trialIndex,
        stimulus_type: trial.stimulusType,
        user_action: trialMetrics.responseType,
        reaction_time: trialMetrics.reactionTime || null
      });
    }, nextTrialDelay - 60);

    scheduleTimeout(() => {
      trialIndex += 1;
      nextTrial();
    }, nextTrialDelay);
  };

  gameRuntime.currentPhase = "signal_detection";
  nextTrial();
}

function handleSignalDetectionTap() {
  const activeTrial = gameRuntime.activeTrial;
  if (!activeTrial || activeTrial.stage == null) {
    return;
  }

  const now = performance.now();
  const reactionTime = Math.round(now - activeTrial.trialStart);
  const trialMetrics = activeTrial.metrics;

  if (reactionTime < SIGNAL_MIN_VALID_RT_MS) {
    if (trialMetrics.responded) {
      return;
    }
    trialMetrics.responded = true;
    trialMetrics.reactionTime = reactionTime;
    trialMetrics.responseType = "anticipatory";
    gameRuntime.metrics.anticipatoryCount += 1;
    renderGameUi({ signalFeedbackState: "fail" });
    return;
  }

  if (reactionTime <= activeTrial.responseDeadline - activeTrial.trialStart) {
    if (trialMetrics.responded) {
      return;
    }

    trialMetrics.responded = true;
    trialMetrics.reactionTime = reactionTime;

    if (activeTrial.stimulusType === "target") {
      trialMetrics.responseType = "tap";
      gameRuntime.metrics.hitCount += 1;
      gameRuntime.metrics.reactionTimes.push(reactionTime);
      renderGameUi({ signalFeedbackState: "success" });
      const isFirstHalf = activeTrial.trialIndex < Math.ceil((state.gameUi?.totalTrials || 1) / 2);
      if (isFirstHalf) {
        gameRuntime.metrics.firstHalfHits += 1;
      } else {
        gameRuntime.metrics.secondHalfHits += 1;
      }
    } else {
      trialMetrics.responseType = "false_alarm";
      gameRuntime.metrics.falseAlarmCount += 1;
      renderGameUi({ signalFeedbackState: "fail" });
    }
  } else if (reactionTime <= activeTrial.nextTrialAt - activeTrial.trialStart) {
    if (!trialMetrics.responded) {
      trialMetrics.responded = true;
      trialMetrics.responseType = "late";
      gameRuntime.metrics.lateResponseCount += 1;
      renderGameUi({ signalFeedbackState: "fail" });
    }
  }
}

function startGoNoGoPractice() {
  const practiceTrials = buildGoNoGoPracticeTrials();
  runGoNoGoTrials(practiceTrials, "practice");
}

function startGoNoGoMain() {
  const mainTrials = buildGoNoGoTrials(GAME_META.go_nogo.mainTrials, 0.75);
  runGoNoGoTrials(mainTrials, "main");
}

function runGoNoGoTrials(trials, stage) {
  cleanupGameRuntime();
  const isAppleTouchDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent || "")
    || (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1);
  const touchGraceMs = Number(navigator.maxTouchPoints || 0) > 0 ? GO_NOGO_TOUCH_GRACE_MS : 0;
  const visualOffsetMs = isAppleTouchDevice ? GO_NOGO_APPLE_TOUCH_VISUAL_OFFSET_MS : 0;
  const responseWindowMs = GO_NOGO_STIMULUS_DURATION_MS + visualOffsetMs + GO_NOGO_RESPONSE_WINDOW_EXTENSION_MS + touchGraceMs;
  const metrics = {
    goCount: trials.filter((trial) => trial.stimulusType === "go").length,
    nogoCount: trials.filter((trial) => trial.stimulusType === "nogo").length,
    goHitCount: 0,
    goOmissionCount: 0,
    commissionErrors: 0,
    prematureResponseCount: 0,
    falseStopCount: 0,
    successfulStopCount: 0,
    lateStopCount: 0,
    goReactionTimes: [],
    stopLatencies: [],
    postErrorDiffs: [],
    anticipatoryCount: 0,
    rawTrials: [],
    sessionStartAt: performance.now()
  };
  let trialIndex = 0;

  const nextTrial = () => {
    if (trialIndex >= trials.length) {
      if (stage === "practice") {
        renderGameUi({
          phase: "result",
          activeTestKey: "go_nogo",
          stage: "practice-complete",
          result: {
            title: "연습 완료",
            interpretation: "눌러야 할 자극과 멈춰야 할 자극 구분을 확인했습니다."
          },
          progressPercent: (getGameState().currentTestIndex / GAME_ORDER.length) * 100
        });
        return;
      }

      const meanGoReactionTime = Math.round(mean(metrics.goReactionTimes));
      const inhibitionFailureRate = roundTo(metrics.commissionErrors / Math.max(metrics.nogoCount, 1), 3);
      const goAccuracy = metrics.goHitCount / Math.max(metrics.goCount, 1);
      const holdSuccessRate = roundTo(metrics.successfulStopCount / Math.max(metrics.nogoCount, 1), 3);
      const allResponses = metrics.rawTrials.filter((trial) => trial.response_ms !== null);
      const fastErrorRate = roundTo(
        allResponses.filter((trial) => Number.isFinite(trial.reaction_time_ms) && trial.reaction_time_ms < GO_NOGO_FAST_RESPONSE_MS).length
          / Math.max(allResponses.length, 1),
        3
      );
      const score = Math.round(clamp(100 - inhibitionFailureRate * 55 - metrics.prematureResponseCount * 4 - metrics.lateStopCount * 3 - (1 - goAccuracy) * 22, 5, 100));
      const commissionLevel = inhibitionFailureRate > 0.4 ? "high" : inhibitionFailureRate > 0.2 ? "moderate" : "low";
      const fastErrorLevel = fastErrorRate > 0.15 ? "high" : fastErrorRate > 0.05 ? "moderate" : "low";
      const pattern = inhibitionFailureRate > 0.3 && meanGoReactionTime < 400
        ? "impulsive"
        : inhibitionFailureRate > 0.3 && meanGoReactionTime > 600
          ? "mixed"
          : "balanced";
      const goHitRateLow = metrics.goCount ? (metrics.goHitCount / metrics.goCount) < 0.5 : true;
      const interpretation = commissionLevel === "high"
        ? "멈춰야 할 자극에서 반응하는 비율이 높아 억제 조절 어려움이 비교적 뚜렷합니다."
        : commissionLevel === "moderate"
          ? "참아야 할 자극에 가끔 반응하는 패턴이 있어 반응 억제를 함께 볼 필요가 있습니다."
          : "전반적인 억제 조절은 비교적 안정적인 편입니다.";

      completeCurrentGameTest({
        test_type: "go_nogo",
        mode: "assessment",
        go_count: metrics.goCount,
        nogo_count: metrics.nogoCount,
        go_hit_count: metrics.goHitCount,
        go_omission_count: metrics.goOmissionCount,
        commission_errors: metrics.commissionErrors,
        successful_stop_count: metrics.successfulStopCount,
        false_stop_count: metrics.falseStopCount,
        late_stop_count: metrics.lateStopCount,
        mean_go_reaction_time: meanGoReactionTime || 0,
        mean_stop_latency: 0,
        premature_response_count: metrics.prematureResponseCount,
        post_error_slowing: 0,
        inhibition_failure_rate: inhibitionFailureRate,
        hold_success_rate: holdSuccessRate,
        commission_rate: inhibitionFailureRate,
        fast_error_rate: fastErrorRate,
        anticipatory_count: metrics.anticipatoryCount,
        validity: {
          valid: !goHitRateLow,
          reason: goHitRateLow ? "go_hit_rate_below_threshold" : null
        },
        level_summary: {
          commission: commissionLevel,
          fast_error: fastErrorLevel,
          overall: commissionLevel,
          pattern
        },
        raw_trials: metrics.rawTrials,
        score,
        interpretation
      });
      return;
    }

    const trial = trials[trialIndex];
    const trialStart = performance.now();
    const isiDuration = stage === "practice"
      ? GO_NOGO_ISI_OPTIONS_MS[trialIndex % GO_NOGO_ISI_OPTIONS_MS.length]
      : GO_NOGO_ISI_OPTIONS_MS[Math.floor(Math.random() * GO_NOGO_ISI_OPTIONS_MS.length)];
    const trialMetrics = {
      reactionTime: null,
      responseType: "none",
      eventLogged: false
    };
    const activeTrial = {
      ...trial,
      stage,
      trialIndex,
      trialStart,
      responseDeadline: trialStart + responseWindowMs,
      nextTrialAt: trialStart + responseWindowMs + isiDuration,
      onsetMs: Math.round(trialStart - metrics.sessionStartAt),
      metrics: trialMetrics
    };
    gameRuntime.activeTrial = activeTrial;

    renderGameUi({
      phase: "running",
      activeTestKey: "go_nogo",
      stage,
      prompt: "",
      progressPercent: (trialIndex / trials.length) * 100,
      trialIndex: trialIndex + 1,
      totalTrials: trials.length,
      stimulus: trial,
      stimulusVisible: true,
      responseWindowState: "visible",
      goNoGoFeedbackState: "idle",
      stimulusReplayToken: `go-nogo-${stage}-${trialIndex}-${Date.now()}`
    });

    scheduleTimeout(() => {
      if (state.gameUi?.activeTestKey === "go_nogo") {
        renderGameUi({
          stimulusVisible: false,
          goNoGoFeedbackState: trialMetrics.responseType === "none" ? "idle" : state.gameUi?.goNoGoFeedbackState || "idle",
          responseWindowState: "pending"
        });
      }
    }, GO_NOGO_STIMULUS_DURATION_MS + visualOffsetMs);

    scheduleTimeout(() => {
      if (trial.stimulusType === "go") {
        if (trialMetrics.responseType !== "hit") {
          metrics.goOmissionCount += 1;
          if (trialMetrics.responseType === "premature") {
            metrics.falseStopCount += 1;
          }
        }
      } else if (trialMetrics.responseType === "none") {
        metrics.successfulStopCount += 1;
      }

      if (!trialMetrics.eventLogged) {
        trialMetrics.eventLogged = true;
        metrics.rawTrials.push({
          trial_number: trialIndex + 1,
          trial_type: trial.stimulusType,
          stimulus_shape: trial.stimulusType,
          stimulus_onset_ms: activeTrial.onsetMs,
          response_ms: trialMetrics.responseType === "none" ? null : activeTrial.onsetMs + (trialMetrics.reactionTime || 0),
          reaction_time_ms: trialMetrics.reactionTime,
          is_correct: (trial.stimulusType === "go" && trialMetrics.responseType === "hit")
            || (trial.stimulusType === "nogo" && trialMetrics.responseType === "none"),
          is_anticipatory: trialMetrics.responseType === "anticipatory"
        });
        pushGameEvent({
          trial_index: trialIndex,
          stimulus_type: trial.stimulusType,
          user_action: trialMetrics.responseType,
          reaction_time: trialMetrics.reactionTime || null
        });
      }
      if (state.gameUi?.activeTestKey === "go_nogo") {
        renderGameUi({
          goNoGoFeedbackState: trialMetrics.responseType === "none" ? "idle" : state.gameUi?.goNoGoFeedbackState || "idle",
          responseWindowState: "closing"
        });
      }
    }, responseWindowMs);

    scheduleTimeout(() => {
      trialIndex += 1;
      nextTrial();
    }, responseWindowMs + isiDuration);
  };

  gameRuntime.currentPhase = "go_nogo";
  nextTrial();

  gameRuntime.tapHandler = () => {
    const activeTrial = gameRuntime.activeTrial;
    const now = performance.now();
    if (!activeTrial) {
      return;
    }
    if (activeTrial.metrics.responseType !== "none" || now > activeTrial.responseDeadline) {
      return;
    }
    activeTrial.metrics.reactionTime = Math.round(now - activeTrial.trialStart);

    if (activeTrial.metrics.reactionTime < GO_NOGO_MIN_VALID_RT_MS) {
      activeTrial.metrics.responseType = "anticipatory";
      metrics.anticipatoryCount += 1;
      renderGameUi({ goNoGoFeedbackState: "fail" });
      return;
    }

    if (activeTrial.stimulusType === "nogo") {
      activeTrial.metrics.responseType = "false_alarm";
      metrics.commissionErrors += 1;
      renderGameUi({ goNoGoFeedbackState: "fail" });
      return;
    }

    if (activeTrial.metrics.reactionTime < GO_NOGO_SUCCESS_MIN_RT_MS + visualOffsetMs) {
      activeTrial.metrics.responseType = "premature";
      metrics.prematureResponseCount += 1;
      renderGameUi({ goNoGoFeedbackState: "fail" });
      return;
    }

    if (now <= activeTrial.responseDeadline) {
      activeTrial.metrics.responseType = "hit";
      metrics.goHitCount += 1;
      metrics.goReactionTimes.push(activeTrial.metrics.reactionTime);
      renderGameUi({ goNoGoFeedbackState: "success" });
      return;
    }

    activeTrial.metrics.responseType = "late";
    metrics.lateStopCount += 1;
    renderGameUi({ goNoGoFeedbackState: "fail" });
  };
}

function handleGoNoGoTap() {
  if (typeof gameRuntime.tapHandler === "function") {
    gameRuntime.tapHandler();
  }
}

function attachLongTouchBalanceListeners() {
  const getLongTouchPosition = (touch) => {
    const target = document.querySelector(".balance-target");
    if (!target || !touch) {
      return { x: 1.1, y: 1.1, inside: false };
    }
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    const radius = Math.min(rect.width, rect.height) / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const normalizedX = clamp(dx / radius, -1.4, 1.4);
    const normalizedY = clamp(dy / radius, -1.4, 1.4);
    return {
      x: normalizedX,
      y: normalizedY,
      inside: Math.sqrt(dx ** 2 + dy ** 2) <= radius
    };
  };

  const setLongTouchState = (position) => {
    gameRuntime.balanceTouchActive = Boolean(position?.inside);
    gameRuntime.pointerControl = position
      ? { x: position.x, y: position.y }
      : { x: 1.1, y: 1.1 };
  };

  addGameListener(window, "touchstart", (event) => {
    const arena = document.querySelector(".balance-arena");
    const target = event.target;
    if (!(target instanceof Element) || !arena || !arena.contains(target)) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    setLongTouchState(getLongTouchPosition(event.touches?.[0]));
  }, { passive: false });

  addGameListener(window, "touchmove", (event) => {
    const touch = event.touches?.[0];
    if (!touch) {
      setLongTouchState(null);
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    setLongTouchState(getLongTouchPosition(touch));
  }, { passive: false });

  addGameListener(window, "touchend", () => {
    setLongTouchState(null);
  }, { passive: false });

  addGameListener(window, "touchcancel", () => {
    setLongTouchState(null);
  }, { passive: false });
}

async function startBalanceCalibration(mode = "practice", requestedInputSource = "") {
  cleanupGameRuntime();
  const options = detectBalanceInputOptions();
  let inputSource = requestedInputSource || state.preferredBalanceInputSource || options.defaultSource;

  if (inputSource === "sensor" && !options.supportsDeviceMotion) {
    inputSource = options.supportsTouchFallback ? "long_touch" : "pointer";
  }
  if (inputSource === "long_touch" && !options.supportsTouchFallback) {
    inputSource = "pointer";
  }

  if (inputSource === "sensor" && typeof DeviceMotionEvent?.requestPermission === "function") {
    const permission = await DeviceMotionEvent.requestPermission().catch(() => "denied");
    if (permission !== "granted") {
      inputSource = options.supportsTouchFallback ? "long_touch" : "pointer";
      setStatus(inputSource === "long_touch"
        ? "모션 센서를 사용할 수 없어 롱터치 방식으로 진행합니다."
        : "모션 센서를 사용할 수 없어 마우스/터치 방식으로 진행합니다.");
    }
  }

  state.preferredBalanceInputSource = inputSource;

  gameRuntime.pointerControl = inputSource === "long_touch" ? { x: 1.1, y: 1.1 } : { x: 0, y: 0 };
  gameRuntime.balanceTouchActive = false;
  gameRuntime.balanceSamples = [];
  renderGameUi({
    phase: "countdown",
    activeTestKey: "balance_hold",
    stage: mode === "practice" ? "practice-calibration" : "calibration",
    countdown: 2,
    message: inputSource === "sensor"
      ? "기기를 편안하게 잡고 2초간 기준점을 맞춥니다."
      : inputSource === "long_touch"
        ? "센서를 쓰지 않고 중앙 원을 길게 누르는 방식으로 진행합니다."
        : "센서를 쓰지 않고 마우스/터치 위치로 진행합니다."
  });

  const handleOrientation = (event) => {
    const gamma = clamp((event.gamma || 0) / 20, -1.2, 1.2);
    const beta = clamp((event.beta || 0) / 20, -1.2, 1.2);
    gameRuntime.pointerControl = { x: gamma, y: beta };
  };

  const handlePointer = (event) => {
    const arena = document.querySelector(".balance-arena");
    if (!arena) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    const rect = arena.getBoundingClientRect();
    const point = event.touches?.[0] || event;
    const x = ((point.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((point.clientY - rect.top) / rect.height) * 2 - 1;
    gameRuntime.pointerControl = {
      x: clamp(x, -1.3, 1.3),
      y: clamp(y, -1.3, 1.3)
    };
  };

  if (inputSource === "pointer") {
    addGameListener(window, "mousemove", handlePointer);
    addGameListener(window, "touchmove", handlePointer, { passive: false });
  } else if (inputSource === "sensor") {
    addGameListener(window, "deviceorientation", handleOrientation);
  } else if (inputSource === "long_touch") {
    attachLongTouchBalanceListeners();
  }

  await new Promise((resolve) => scheduleTimeout(resolve, 2000));
  startBalanceHold(inputSource, mode);
}

function startBalanceHold(inputSource, mode = "main") {
  const startAt = performance.now();
  let stableHoldTime = 0;
  let largeMotionCount = 0;
  let driftDistance = 0;
  let correctionCount = 0;
  let previousDistance = 0;
  let previousInside = true;
  let previousLarge = false;
  const rawSamples = [];
  const isPointerMode = inputSource === "pointer";
  const isLongTouchMode = inputSource === "long_touch";
  const pointerTarget = {
    currentX: 0,
    currentY: 0,
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    moveStartAt: startAt,
    moveDurationMs: 1600
  };

  const pickNextPointerTarget = (now) => {
    pointerTarget.fromX = pointerTarget.currentX;
    pointerTarget.fromY = pointerTarget.currentY;
    pointerTarget.toX = randomBetween(-0.52, 0.52);
    pointerTarget.toY = randomBetween(-0.52, 0.52);
    pointerTarget.moveStartAt = now;
    pointerTarget.moveDurationMs = randomBetween(1300, 2200);
  };

  const updatePointerTarget = (now) => {
    if (!isPointerMode) {
      return { x: 0, y: 0 };
    }
    const progress = clamp((now - pointerTarget.moveStartAt) / pointerTarget.moveDurationMs, 0, 1);
    const eased = 0.5 - (Math.cos(Math.PI * progress) / 2);
    pointerTarget.currentX = pointerTarget.fromX + ((pointerTarget.toX - pointerTarget.fromX) * eased);
    pointerTarget.currentY = pointerTarget.fromY + ((pointerTarget.toY - pointerTarget.fromY) * eased);
    if (progress >= 1) {
      pickNextPointerTarget(now);
    }
    return { x: pointerTarget.currentX, y: pointerTarget.currentY };
  };

  if (isPointerMode) {
    pickNextPointerTarget(startAt);
  }

  const durationMs = mode === "practice" ? BALANCE_PRACTICE_DURATION_MS : GAME_META.balance_hold.durationMs;
  const prompt = isPointerMode
    ? "움직이는 원을 따라가며 공을 안쪽에 유지하세요."
    : isLongTouchMode
      ? "중앙 원을 길게 눌러 공을 안쪽에 유지하세요."
      : "기기를 기울여 공을 중앙 원 안에 오래 유지하세요.";
  const initialX = isLongTouchMode ? gameRuntime.pointerControl.x : 0;
  const initialY = isLongTouchMode ? gameRuntime.pointerControl.y : 0;
  const initialDistance = Math.sqrt(initialX ** 2 + initialY ** 2);

  renderGameUi({
    phase: "running",
    activeTestKey: "balance_hold",
    stage: mode,
    prompt,
    progressPercent: 0,
    balance: {
      x: initialX,
      y: initialY,
      targetX: 0,
      targetY: 0,
      distance: initialDistance,
      inside: isLongTouchMode ? gameRuntime.balanceTouchActive : true,
      inputSource
    }
  });
  gameRuntime.liveDomUpdater = updateLiveGameDom;

  gameRuntime.intervalId = window.setInterval(() => {
    const now = performance.now();
    const elapsed = now - startAt;
    const targetPosition = updatePointerTarget(now);
    const x = clamp(gameRuntime.pointerControl.x, -1.4, 1.4);
    const y = clamp(gameRuntime.pointerControl.y, -1.4, 1.4);
    const relativeX = x - targetPosition.x;
    const relativeY = y - targetPosition.y;
    const distance = Math.sqrt(relativeX ** 2 + relativeY ** 2);
    const stableRadius = isLongTouchMode ? 0.24 : 0.48;
    const softRadius = isLongTouchMode ? 0.42 : 0.62;
    const inside = distance <= softRadius;
    const isLarge = distance >= (isLongTouchMode ? 0.75 : 0.9);
    const magnitude = Math.sqrt(relativeX ** 2 + relativeY ** 2);
    const stabilityCredit = distance <= stableRadius ? 0.1 : distance <= softRadius ? 0.04 : 0;

    if (stabilityCredit > 0) {
      stableHoldTime += stabilityCredit;
    }
    if (isLarge && !previousLarge) {
      largeMotionCount += 1;
    }
    if (inside && !previousInside) {
      correctionCount += 1;
    }

    driftDistance += Math.abs(distance - previousDistance);
    previousDistance = distance;
    previousInside = inside;
    previousLarge = isLarge;

    gameRuntime.balanceSamples.push(distance);
    rawSamples.push({
      timestamp_ms: Math.round(elapsed),
      gyro_x: roundTo(relativeX, 4),
      gyro_y: roundTo(relativeY, 4),
      gyro_z: 0,
      magnitude: roundTo(magnitude, 4)
    });
    pushGameEvent({
      trial_index: Math.floor(elapsed / 100),
      stimulus_type: "balance",
      user_action: inside ? "hold" : "drift",
      reaction_time: null
    });

    renderGameUi({
      phase: "running",
      activeTestKey: "balance_hold",
      stage: mode,
      prompt,
      progressPercent: (elapsed / durationMs) * 100,
      balance: {
        x: relativeX,
        y: relativeY,
        targetX: targetPosition.x,
        targetY: targetPosition.y,
        distance,
        inside,
        inputSource,
        remainingMs: Math.max(durationMs - elapsed, 0)
      }
    });

    if (elapsed >= durationMs) {
      const movementAmplitude = Number(mean(gameRuntime.balanceSamples).toFixed(2));
      const movementVariability = Number(standardDeviation(gameRuntime.balanceSamples).toFixed(2));
      const stableHoldSeconds = Number(stableHoldTime.toFixed(1));
      const drift = Number(driftDistance.toFixed(1));
      const stableDurationPct = roundTo((stableHoldTime / (durationMs / 1000)) * 100, 1);
      const totalMovement = roundTo(rawSamples.reduce((sum, sample) => sum + sample.magnitude, 0), 2);
      const spikeCount = largeMotionCount;
      const score = Math.round(clamp((stableHoldSeconds / (durationMs / 1000)) * 100 - movementAmplitude * 20 - movementVariability * 25 - largeMotionCount * 2, 5, 100));
      const stableLevel = stableDurationPct < 40 ? "high" : stableDurationPct < 70 ? "moderate" : "low";
      const spikeLevel = spikeCount >= 9 ? "high" : spikeCount >= 4 ? "moderate" : "low";
      const interpretation = stableLevel === "high" || spikeLevel === "high"
        ? "기기 유지 중 큰 흔들림이 자주 관찰되어 자기조절 지표를 보조적으로 참고할 필요가 있습니다."
        : stableLevel === "moderate" || spikeLevel === "moderate"
          ? "기기를 유지하는 동안 간헐적 흔들림이 있어 보조 참고 지표로 함께 볼 수 있습니다."
          : "기기 유지 패턴은 비교적 안정적인 편입니다.";

      cleanupGameRuntime();
      if (mode === "practice") {
        renderGameUi({
          phase: "result",
          activeTestKey: "balance_hold",
          stage: "practice-complete",
          result: {
            title: "연습 완료",
            interpretation: `이제 본 과제 30초를 시작합니다. ${getBalanceInputDescription(inputSource, false)}`
          },
          progressPercent: (getGameState().currentTestIndex / GAME_ORDER.length) * 100
        });
        return;
      }
      completeCurrentGameTest({
        test_type: "balance_hold",
        mode: "assessment",
        input_source: inputSource,
        movement_amplitude: movementAmplitude,
        movement_variability: movementVariability,
        stable_hold_time: stableHoldSeconds,
        large_motion_count: largeMotionCount,
        drift_distance: drift,
        correction_count: correctionCount,
        stable_duration_pct: stableDurationPct,
        spike_count: spikeCount,
        total_movement: totalMovement,
        validity: {
          valid: rawSamples.length >= 200,
          reason: rawSamples.length < 200 ? "insufficient_sensor_data" : null
        },
        level_summary: {
          stable_duration: stableLevel,
          spikes: spikeLevel,
          overall: stableLevel === "high" || spikeLevel === "high"
            ? "high"
            : stableLevel === "moderate" || spikeLevel === "moderate"
              ? "moderate"
              : "low"
        },
        raw_samples: rawSamples,
        score,
        interpretation
      });
    }
  }, 100);
}

async function answerAsrs(value) {
  if (state.isAdvancingAsrs) {
    return;
  }
  const question = state.configs.asrs.questions[state.asrsIndex];
  if (!Array.isArray(state.currentRecord.tests.asrs)) {
    state.currentRecord.tests.asrs = getAsrsAnswers(state.currentRecord);
  }
  state.currentRecord.tests.asrs[state.asrsIndex] = {
    prompt: question.prompt,
    examples: question.examples,
    answer: value
  };
  state.currentRecord.currentStep = "asrs";
  state.isAdvancingAsrs = true;
  await persistRecord();
  render();
  queueSurveyAdvance("asrs");
}

async function goToNextAsrsQuestion() {
  const currentAnswer = getAsrsAnswers()?.[state.asrsIndex]?.answer;
  if (!Number.isFinite(Number(currentAnswer))) {
    setStatus("척도를 선택한 뒤 다음으로 진행해 주세요.");
    return;
  }

  if (state.asrsIndex < state.configs.asrs.questions.length - 1) {
    state.asrsIndex += 1;
    state.showAsrsExamples = false;
    state.currentRecord.currentStep = "asrs";
    await persistRecord();
  } else {
    state.showAsrsExamples = false;
    state.currentRecord.currentStep = "asrs-result";
    await persistRecord();
    state.route = "asrs-result";
    await ensureAsrsAnalysis();
  }
  state.isAdvancingAsrs = false;
  render();
}

function toggleAsrsExamples() {
  state.showAsrsExamples = !state.showAsrsExamples;
  render();
}

async function answerDsm(value) {
  if (state.isAdvancingDsm) {
    return;
  }
  const current = state.configs.dsm.questions[state.dsmIndex];
  if (!Array.isArray(state.currentRecord.tests.dsm5)) {
    state.currentRecord.tests.dsm5 = getDsmAnswers(state.currentRecord);
  }
  state.currentRecord.tests.dsm5[state.dsmIndex] = {
    section: current.section,
    prompt: current.prompt,
    answer: value
  };
  state.currentRecord.dsm5Analysis = analyzeDsm(state.currentRecord);
  state.currentRecord.currentStep = "dsm";
  state.isAdvancingDsm = true;
  await persistRecord();
  render();
  queueSurveyAdvance("dsm");
}

async function goToNextDsmQuestion() {
  if (state.dsmIndex < state.configs.dsm.questions.length - 1) {
    state.dsmIndex += 1;
  } else {
    state.currentRecord.currentStep = "dsm-result";
    await persistRecord();
    state.route = "dsm-result";
    await ensureDsmAnalysis();
  }
  state.isAdvancingDsm = false;
  render();
}

function queueSurveyAdvance(type) {
  if (state.surveyAdvanceTimerId) {
    window.clearTimeout(state.surveyAdvanceTimerId);
  }
  state.surveyAdvanceTimerId = window.setTimeout(() => {
    state.surveyAdvanceTimerId = null;
    const advance = type === "asrs" ? goToNextAsrsQuestion : goToNextDsmQuestion;
    advance().catch((error) => {
      if (type === "asrs") {
        state.isAdvancingAsrs = false;
      } else {
        state.isAdvancingDsm = false;
      }
      setStatus(error.message);
      render();
    });
  }, 220);
}

async function generateReportAndPlan() {
  if (!state.currentRecord) {
    return;
  }

  state.isGeneratingInsights = true;
  render();

  try {
    const insights = await api("/api/ai/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: state.currentRecord
      })
    });

    state.currentRecord.report = insights.report;
    state.currentRecord.plan = insights.plan;
    state.currentRecord.currentStep = "report";
    await persistRecord();
  } finally {
    state.isGeneratingInsights = false;
    render();
  }
}

async function generateAsrsAnalysis() {
  if (!state.currentRecord) {
    return;
  }

  state.isGeneratingAsrsAnalysis = true;
  render();

  try {
    const analysis = analyzeAsrs();
    const result = await api("/api/ai/asrs-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: state.currentRecord,
        analysis
      })
    });

    state.currentRecord.asrsAnalysis = result;
    await persistRecord();
  } finally {
    state.isGeneratingAsrsAnalysis = false;
    render();
  }
}

async function ensureAsrsAnalysis() {
  if (!state.currentRecord?.asrsAnalysis?.summary && !state.isGeneratingAsrsAnalysis) {
    await generateAsrsAnalysis();
  }
}

async function generateDsmAnalysis() {
  if (!state.currentRecord) {
    return;
  }

  state.isGeneratingDsmAnalysis = true;
  render();

  try {
    const analysis = analyzeDsm();
    if (!state.aiStatus?.configured) {
      state.currentRecord.dsm5QuickAnalysis = buildLocalDsmQuickAnalysis(state.currentRecord);
      await persistRecord();
      return;
    }

    const result = await api("/api/ai/dsm-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: state.currentRecord,
        analysis
      })
    });

    state.currentRecord.dsm5QuickAnalysis = result;
    await persistRecord();
  } finally {
    state.isGeneratingDsmAnalysis = false;
    render();
  }
}

async function ensureDsmAnalysis() {
  if (!state.currentRecord?.dsm5QuickAnalysis?.summary && !state.isGeneratingDsmAnalysis) {
    await generateDsmAnalysis();
  }
}

async function generateReactivityAnalysis() {
  if (!state.currentRecord) {
    return;
  }

  state.isGeneratingReactivityAnalysis = true;
  render();

  try {
    if (!state.aiStatus?.configured) {
      state.currentRecord.reactivityAnalysis = buildLocalReactivityAnalysis(state.currentRecord);
      await persistRecord();
      return;
    }

    const analysis = buildLocalReactivityAnalysis(state.currentRecord);
    const result = await api("/api/ai/react-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: state.currentRecord,
        analysis
      })
    });

    state.currentRecord.reactivityAnalysis = {
      ...result,
      source: "ai"
    };
    await persistRecord();
  } finally {
    state.isGeneratingReactivityAnalysis = false;
    render();
  }
}

async function ensureReactivityAnalysis() {
  if (state.currentRecord?.reactivityAnalysis?.source !== "ai" && !state.isGeneratingReactivityAnalysis) {
    await generateReactivityAnalysis();
  }
}

async function ensureInsights() {
  if (state.currentRecord && state.aiStatus?.configured) {
    const game = getGameState(state.currentRecord);
    if (game?.status === "completed" && state.currentRecord?.reactivityAnalysis?.source !== "ai") {
      await ensureReactivityAnalysis();
    }
  }
  if (!state.currentRecord?.report || state.currentRecord.report.schemaVersion !== 2 || !state.currentRecord?.plan?.suggestions?.length) {
    setStatus("Gemini로 리포트와 계획을 생성하는 중입니다.");
    await generateReportAndPlan();
  }
}

function hasCompletedReactivity(record = state.currentRecord) {
  return getGameState(record)?.status === "completed";
}

function getPostSurveyAction(record = state.currentRecord) {
  if (hasCompletedReactivity(record)) {
    return {
      route: "report",
      label: "다시 분석하기"
    };
  }
  return {
    route: "game",
          label: "반응성 과제 진행하기"
  };
}

async function forceRegenerateInsights() {
  if (!state.currentRecord) {
    return;
  }
  state.currentRecord.report = null;
  state.currentRecord.plan = { suggestions: [], chat: [] };
  state.currentRecord.currentStep = "report";
  await persistRecord();
  state.route = "report";
  await generateReportAndPlan();
}

async function retakeAssessment(type) {
  if (!state.currentRecord) {
    return;
  }

  state.currentRecord.completedPlanOnce = Boolean(
    state.currentRecord.completedPlanOnce
      || state.currentRecord.currentStep === "plan"
      || state.currentRecord.plan?.suggestions?.length
  );
  state.currentRecord.report = null;
  state.currentRecord.plan = { suggestions: [], chat: [] };

  if (type === "asrs") {
    state.currentRecord.tests.asrs = [];
    state.currentRecord.asrsAnalysis = null;
    state.asrsIndex = 0;
    state.showAsrsExamples = false;
    state.currentRecord.currentStep = "asrs";
    await persistRecord();
    navTo("asrs");
    return;
  }

  if (type === "dsm") {
    state.currentRecord.tests.dsm5 = [];
    state.currentRecord.dsm5Analysis = null;
    state.currentRecord.dsm5QuickAnalysis = null;
    state.dsmIndex = 0;
    state.currentRecord.currentStep = "dsm";
    await persistRecord();
    navTo("dsm");
    return;
  }

  if (type === "game") {
    state.currentRecord.tests.game = createEmptyGameState();
    state.currentRecord.reactivityAnalysis = null;
    resetGameUi();
    state.currentRecord.currentStep = "game";
    await persistRecord();
    navTo("game");
  }
}

function toPercent(value, total) {
  if (!total) {
    return 0;
  }
  return Math.round((value / total) * 100);
}

function hasStoredNumber(value) {
  return Number.isFinite(Number(value));
}

function displayMetric(value, suffix = "") {
  return hasStoredNumber(value) ? `${value}${suffix}` : "정보 없음";
}

function normalizePlanSuggestion(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function canReviewCompletedFlow(record = state.currentRecord) {
  return Boolean(record?.report?.schemaVersion === 2 && record?.plan?.suggestions?.length);
}

function buildCompletedGameUi(record = state.currentRecord) {
  const game = getGameState(record);
  if (!game?.summary || game.status !== "completed") {
    return createOverviewUi();
  }

  return {
    ...createOverviewUi(),
    phase: "completed",
    activeTestKey: game.currentTestKey || GAME_ORDER[GAME_ORDER.length - 1],
    stage: "completed-review",
    result: game.tests?.[game.currentTestKey] || game.tests?.[GAME_ORDER[GAME_ORDER.length - 1]] || {},
    progressPercent: 100
  };
}

async function openReviewRoute(routeKey) {
  if (!state.currentRecord) {
    return;
  }

  const targetRoute = routeKey === "asrs"
    ? "asrs-result"
    : routeKey === "dsm"
      ? "dsm-result"
      : routeKey === "hub"
        ? "hub"
      : routeKey === "report"
        ? "report"
        : routeKey === "plan"
          ? "plan"
          : "game";

  if (routeKey === "game") {
    state.gameUi = buildCompletedGameUi(state.currentRecord);
  } else {
    resetGameUi();
  }

  if (targetRoute === "report" || targetRoute === "plan") {
    await ensureInsights();
  }
  await syncCurrentStep(targetRoute);
  navTo(targetRoute);
}

function getDsmImageSrc(index) {
  return `/newimages/d${index + 1}.png?v=${IMAGE_ASSET_VERSION}`;
}

function getAsrsImageSrc(index) {
  return `/newimages/a${index + 1}.png?v=${IMAGE_ASSET_VERSION}`;
}

function getRandomIntroImageSrc() {
  const imagePool = [
    ...Array.from({ length: 6 }, (_, index) => `/newimages/a${index + 1}.png?v=${IMAGE_ASSET_VERSION}`),
    ...Array.from({ length: 23 }, (_, index) => `/newimages/d${index + 1}.png?v=${IMAGE_ASSET_VERSION}`)
  ];
  return imagePool[Math.floor(Math.random() * imagePool.length)] || getAsrsImageSrc(0);
}

function renderAddGuide(text, options = {}) {
  const tone = options.tone || "차분하게 안내할게요.";
  return `
    <div class="add-guide ${options.compact ? "add-guide-compact" : ""}">
      <img class="add-sticker" src="/newimages/basic.png?v=${IMAGE_ASSET_VERSION}" alt="안내 캐릭터 애드" />
      <div class="add-bubble">
        <span>${tone}</span>
        <strong>${text}</strong>
      </div>
    </div>
  `;
}

function buildHubSummary(record = state.currentRecord) {
  if (!record) {
    return "아직 진행 기록이 없어요. 먼저 ID를 만들고 간단한 점검을 시작해 주세요.";
  }
  const report = record.report ? computeLocalReportViewModel(record) : null;
  const game = getGameState(record);
  if (report?.hero?.summary) {
    return report.hero.summary;
  }
  if (game?.status === "completed") {
    return "자기점검과 반응성 과제가 완료됐어요. 패턴 리포트에서 현재 흐름을 다시 살펴볼 수 있어요.";
  }
  return "자가점검을 시작했어요. 설문과 반응성 과제를 마치면 현재 주의·집중 패턴을 더 구체적으로 볼 수 있어요.";
}

function getDtxEmbedSrc(record = state.currentRecord) {
  const id = encodeURIComponent(record?.id || "guest");
  const fileName = encodeURIComponent(record?.fileName || "");
  return `/dtx?id=${id}&file=${fileName}&embed=1`;
}

function getHubDtxStatus(record = state.currentRecord) {
  const dtx = record?.dtx || {};
  const scores = dtx.scores || {};
  const derivedScore = Object.values(scores).reduce((sum, value) => sum + Number(value || 0), 0);
  const totalScore = Number(dtx.totalScore ?? derivedScore);
  const stageSpec = typeof window.DtxCommon?.computeStageByScore === "function"
    ? window.DtxCommon.computeStageByScore(totalScore)
    : { stage: dtx.stage || "stage1", image: "/game/images/stage1.png" };
  return {
    level: stageSpec.stage || dtx.stage || "stage1",
    score: totalScore,
    image: stageSpec.image || "/game/images/stage1.png"
  };
}

function renderHubActionButton({ label, icon, statusLabel, hasData, attrs, extraClass = "" }) {
  return `
    <button class="hub-test-button ${extraClass}" type="button" ${attrs}>
      <span class="hub-action-main">
        <span class="material-symbols-outlined hub-action-icon">${icon}</span>
        <span>${label}</span>
      </span>
      <span class="hub-action-status ${hasData ? "has-data" : ""}" aria-label="${statusLabel}">
        <span class="material-symbols-outlined">${hasData ? "check_circle" : "radio_button_unchecked"}</span>
      </span>
    </button>
  `;
}

function getHubTrendMetas(record = state.currentRecord) {
  const id = record?.id || "";
  if (!id) {
    return [];
  }
  const byFileName = new Map();
  state.records
    .filter((item) => item.id === id && item.fileName)
    .forEach((item) => byFileName.set(item.fileName, item));
  if (record?.fileName) {
    byFileName.set(record.fileName, {
      fileName: record.fileName,
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      currentStep: record.currentStep
    });
  }
  return [...byFileName.values()]
    .filter((item) => item.createdAt || item.updatedAt)
    .sort((a, b) => String(b.createdAt || b.updatedAt).localeCompare(String(a.createdAt || a.updatedAt)))
    .slice(0, 5);
}

async function ensureHubTrendData(record = state.currentRecord) {
  const id = record?.id || "";
  if (!id || state.hubTrend.loading) {
    return;
  }
  const metas = getHubTrendMetas(record);
  const key = `${id}:${metas.map((item) => item.fileName).join("|")}`;
  if (state.hubTrend.id === key) {
    return;
  }

  state.hubTrend = {
    id: key,
    loading: true,
    records: [],
    error: ""
  };
  render();

  try {
    const records = await Promise.all(metas.map(async (item) => {
      if (item.fileName === record?.fileName) {
        return record;
      }
      return api(`/api/records/${encodeURIComponent(item.fileName)}`);
    }));
    state.hubTrend = {
      id: key,
      loading: false,
      records,
      error: ""
    };
  } catch (error) {
    state.hubTrend = {
      id: key,
      loading: false,
      records: [],
      error: error.message || "기록을 불러오지 못했습니다."
    };
  }
  render();
}

function averageFinite(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) {
    return null;
  }
  return Math.round(finite.reduce((sum, value) => sum + value, 0) / finite.length);
}

function computeHubTrendScores(record) {
  const report = computeLocalReportViewModel(record);
  const inattention = report.metrics.inattention;
  const impulsivity = report.metrics.impulsivity;
  const hasSurveyData = getAsrsAnswers(record).length > 0 || getDsmAnswers(record).length > 0;
  const inattentionSubjective = hasSurveyData && inattention.asrsMax ? toPercent(inattention.asrsScore, inattention.asrsMax) : null;
  const impulsivitySubjective = hasSurveyData && impulsivity.asrsMax ? toPercent(impulsivity.asrsScore, impulsivity.asrsMax) : null;
  return {
    date: record.tests?.game?.completedAt || record.updatedAt || record.createdAt,
    inattention: averageFinite([
      inattentionSubjective,
      inattention.signalScore,
      inattention.omissionPercent,
      inattention.variabilityPercent,
      inattention.tauPercent
    ]),
    impulsivity: averageFinite([
      impulsivitySubjective,
      impulsivity.goNoGoScore,
      impulsivity.commissionPercent,
      impulsivity.fastErrorPercent
    ])
  };
}

function formatTrendDate(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function renderHubTrendChart() {
  const currentId = state.currentRecord?.id || "";
  const metas = getHubTrendMetas(state.currentRecord);
  const expectedKey = `${currentId}:${metas.map((item) => item.fileName).join("|")}`;
  const isLoading = state.hubTrend.loading || state.hubTrend.id !== expectedKey;
  const records = state.hubTrend.id === expectedKey ? state.hubTrend.records : [];
  const points = records
    .map((record) => computeHubTrendScores(record))
    .filter((point) => point.date && (Number.isFinite(point.inattention) || Number.isFinite(point.impulsivity)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-5);

  const width = 320;
  const height = 86;
  const padX = 28;
  const padY = 10;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2 - 14;
  const xFor = (index) => points.length <= 1 ? width / 2 : padX + (plotWidth * index) / (points.length - 1);
  const yFor = (value) => padY + plotHeight - (plotHeight * Math.max(0, Math.min(100, value))) / 100;
  const makePolyline = (key) => points
    .map((point, index) => Number.isFinite(point[key]) ? `${xFor(index)},${yFor(point[key])}` : "")
    .filter(Boolean)
    .join(" ");
  const inattentionLine = makePolyline("inattention");
  const impulsivityLine = makePolyline("impulsivity");
  const latest = points[points.length - 1] || {};

  return `
    <div class="hub-trend-card">
      <div class="hub-trend-header">
        <div>
          <strong>최근 지표 변화</strong>
          <p class="muted">최근 5개 자기점검 기준</p>
        </div>
        <div class="hub-trend-legend">
          <span><i class="legend-dot inattention"></i>집중 유지</span>
          <span><i class="legend-dot impulsivity"></i>반응 조절</span>
        </div>
      </div>
      ${isLoading ? `
        <div class="hub-trend-empty">지표 변화를 불러오는 중입니다.</div>
      ` : state.hubTrend.error ? `
        <div class="hub-trend-empty">${escapeHtml(state.hubTrend.error)}</div>
      ` : points.length ? `
        <svg class="hub-trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="최근 자기점검 지표 변화">
          <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${padY + plotHeight}" class="chart-axis"></line>
          <line x1="${padX}" y1="${padY + plotHeight}" x2="${width - padX}" y2="${padY + plotHeight}" class="chart-axis"></line>
          <line x1="${padX}" y1="${yFor(50)}" x2="${width - padX}" y2="${yFor(50)}" class="chart-grid"></line>
          ${inattentionLine ? `<polyline points="${inattentionLine}" class="chart-line inattention"></polyline>` : ""}
          ${impulsivityLine ? `<polyline points="${impulsivityLine}" class="chart-line impulsivity"></polyline>` : ""}
          ${points.map((point, index) => `
            ${Number.isFinite(point.inattention) ? `<circle cx="${xFor(index)}" cy="${yFor(point.inattention)}" r="4" class="chart-point inattention"></circle>` : ""}
            ${Number.isFinite(point.impulsivity) ? `<circle cx="${xFor(index)}" cy="${yFor(point.impulsivity)}" r="4" class="chart-point impulsivity"></circle>` : ""}
            <text x="${xFor(index)}" y="${height - 5}" text-anchor="middle" class="chart-label">${formatTrendDate(point.date)}</text>
          `).join("")}
        </svg>
        <div class="hub-trend-latest">
          <span>최근 집중 유지 ${Number.isFinite(latest.inattention) ? latest.inattention : "-"}점</span>
          <span>최근 반응 조절 ${Number.isFinite(latest.impulsivity) ? latest.impulsivity : "-"}점</span>
        </div>
      ` : `
        <div class="hub-trend-empty">아직 표시할 자기점검 기록이 없어요.</div>
      `}
    </div>
  `;
}

function computeLocalReportViewModel(record = state.currentRecord) {
  const report = record?.report || {};
  const asrs = analyzeAsrs(record);
  const dsm = analyzeDsm(record);
  const game = getGameState(record);
  const signal = game?.tests?.signal_detection || {};
  const goNogo = game?.tests?.go_nogo || {};
  const reactionSummary = summarizeReactivity(record);
  const asrsAnswers = getAsrsAnswers(record)
    .map((item) => Number(item.answer))
    .filter((value) => Number.isFinite(value));
  const hasAsrsSurvey = asrsAnswers.length > 0;
  const hasDsmSurvey = getDsmAnswers(record).length > 0;
  const surveyLabel = hasDsmSurvey && !hasAsrsSurvey ? "23문항 세부 설문" : "6문항 간단 설문";
  const asrsAttentionScore = asrsAnswers.slice(0, 4).reduce((sum, value) => sum + value, 0);
  const asrsImpulseScore = asrsAnswers.slice(4, 6).reduce((sum, value) => sum + value, 0);
  const signalHasDetail = hasStoredNumber(signal.omission_rate) || (hasStoredNumber(signal.omission_errors) && hasStoredNumber(signal.target_count));
  const goNogoHasDetail = hasStoredNumber(goNogo.commission_rate) || hasStoredNumber(goNogo.inhibition_failure_rate) || (hasStoredNumber(goNogo.commission_errors) && hasStoredNumber(goNogo.nogo_count));
  const omissionRate = signalHasDetail
    ? Number((signal.omission_rate ?? (Number(signal.omission_errors || 0) / Math.max(Number(signal.target_count || 0), 1))).toFixed(2))
    : null;
  const commissionRate = goNogoHasDetail
    ? Number((goNogo.commission_rate ?? goNogo.inhibition_failure_rate ?? (Number(goNogo.commission_errors || 0) / Math.max(Number(goNogo.nogo_count || 0), 1))).toFixed(2))
    : null;
  const reactionVariability = hasStoredNumber(signal.reaction_time_variability) ? Number(signal.reaction_time_variability) : null;
  const tau = hasStoredNumber(signal.tau) ? Number(signal.tau) : null;
  const latePhaseDrop = hasStoredNumber(signal.late_phase_drop) ? Number(signal.late_phase_drop) : null;
  const fastErrorRate = hasStoredNumber(goNogo.fast_error_rate) ? Number(goNogo.fast_error_rate) : null;
  const meanGoReactionTime = hasStoredNumber(goNogo.mean_go_reaction_time) ? Number(goNogo.mean_go_reaction_time) : null;
  const impulsePattern = goNogo.level_summary?.pattern || null;
  const subjectiveDomain = hasAsrsSurvey
    ? (asrs.attentionPositive >= asrs.hyperPositive ? "부주의" : "충동성")
    : hasDsmSurvey
      ? (dsm.inattentionYes >= dsm.hyperactivityYes ? "부주의" : "충동성")
      : "부주의";
  const objectiveDomain = signalHasDetail || goNogoHasDetail
    ? ((omissionRate || 0) >= (commissionRate || 0) ? "부주의" : "충동성")
    : ((signal.score || 0) <= (goNogo.score || 0) ? "부주의" : "충동성");
  const subjectiveDomainLabel = subjectiveDomain === "부주의" ? "집중 유지" : "반응 조절";
  const objectiveDomainLabel = objectiveDomain === "부주의" ? "집중 유지" : "반응 조절";
  const alignment = subjectiveDomain === objectiveDomain ? "일치" : "불일치";
  const dailyImpactLevel = report.dailyImpact?.level
    || Math.max(1, Math.min(5, Math.ceil((dsm.inattentionYes + dsm.hyperactivityYes + dsm.contextualYes * 2) / 4) || 1));
  const defaultBadges = [];

  if (asrs.attentionPositive >= 2 || omissionRate >= 0.18) {
    defaultBadges.push("#주의력충전필요");
  }
  if (asrs.hyperPositive >= 1 || commissionRate >= 0.18) {
    defaultBadges.push("#반응조절연습중");
  }
  if ((reactionSummary?.activity_signal?.score || 0) >= 60) {
    defaultBadges.push("#움직임에너지높음");
  }
  if (!defaultBadges.length) {
    defaultBadges.push("#기본안정패턴");
  }

  const heroSummary = report.hero?.summary
    || report.sections?.summary
    || (alignment === "일치"
      ? `설문과 반응성 과제 모두 ${subjectiveDomainLabel} 쪽 패턴이 비슷하게 나타났어요. 현재 패턴을 이해하고 생활 리듬에 맞는 조절 전략을 더해보면 도움이 될 수 있어요.`
      : "설문에서 느끼는 어려움과 게임 기반 반응 패턴이 조금 다르게 보였어요. 상황과 환경에 따라 수행 모습이 달라질 수 있다는 참고 신호로 볼 수 있어요.");

  return {
    severity: report.severity || (asrs.totalPositive >= 4 || dsm.inattentionYes >= 6 || dsm.hyperactivityYes >= 6 ? "높음" : asrs.totalPositive >= 2 ? "중간" : "낮음"),
    hero: {
      badges: Array.isArray(report.hero?.badges) && report.hero.badges.length ? report.hero.badges : defaultBadges.slice(0, 3),
      summary: heroSummary
    },
    crossCheck: {
      subjectiveTitle: report.crossCheck?.subjectiveTitle || `${surveyLabel}에서는 ${subjectiveDomainLabel} 쪽 부담이 더 보여요`,
      subjectiveText: report.crossCheck?.subjectiveText || (subjectiveDomain === "부주의"
        ? `${surveyLabel} 응답에서는 집중 유지, 시작 지연, 마감 관리와 같은 어려움이 조금 더 강조됐어요.`
        : `${surveyLabel} 응답에서는 즉각 반응, 기다리기 어려움 같은 패턴이 조금 더 강조됐어요.`),
      objectiveTitle: report.crossCheck?.objectiveTitle || `수행 과제에서는 ${objectiveDomainLabel} 쪽 패턴이 더 보여요`,
      objectiveText: report.crossCheck?.objectiveText || (objectiveDomain === "부주의"
        ? "반응성 과제에서는 목표를 놓치거나 반응시간이 흔들리는 패턴이 상대적으로 더 보였어요."
        : "반응성 과제에서는 누르면 안 되는 자극에 반응하는 패턴이 상대적으로 더 보였어요."),
      alignmentLabel: report.crossCheck?.alignmentLabel || (alignment === "일치" ? "두 결과가 비슷해요" : "두 결과가 조금 달라요"),
      alignmentSummary: report.crossCheck?.alignmentSummary || (alignment === "일치"
        ? "스스로 느끼는 어려움과 과제에서 보인 패턴이 같은 방향을 가리켜요."
        : "평소 체감과 과제 상황의 반응이 다르게 나타나서 환경 영향까지 함께 볼 필요가 있어요.")
    },
    profile: {
      inattentionSummary: report.profile?.inattentionSummary || `집중 유지 영역은 ${surveyLabel} 응답과 목표 놓침, 반응시간 변동성을 함께 봤을 때 현재 집중 유지의 일관성을 점검해 볼 필요가 있어 보여요.`,
      impulsivitySummary: report.profile?.impulsivitySummary || `반응 조절 영역은 ${surveyLabel} 응답과 잘못된 반응 비율, 성급 반응 비율을 함께 봤을 때 속도보다 멈추는 조절을 연습하는 것이 도움이 될 수 있어요.`
    },
    dailyImpact: {
      level: dailyImpactLevel,
      label: report.dailyImpact?.label || ["가벼운 피로", "조금 누적된 피로", "중간 수준의 부담", "지속적 소모가 큰 편", "상당한 에너지 소모"][dailyImpactLevel - 1],
      empathy: report.dailyImpact?.empathy || dsm.detail
    },
    sections: {
      strength: report.sections?.strength || "구조를 만들면 수행이 좋아질 여지가 있고, 관심이 생기는 과제에서는 몰입이 보호 요인으로 작동할 수 있어요.",
      watchout: report.sections?.watchout || "이 리포트는 의학적 진단이 아니라 자기점검 참고 자료예요. 수면, 스트레스, 불안·우울 같은 다른 요인도 함께 살펴보는 것이 좋아요."
    },
    metrics: {
      inattention: {
        asrsScore: hasAsrsSurvey ? asrsAttentionScore : dsm.inattentionYes,
        asrsMax: hasAsrsSurvey ? 16 : 9,
        omissionRate,
        omissionPercent: omissionRate === null ? null : toPercent(omissionRate, 1),
        reactionVariability,
        variabilityPercent: reactionVariability === null ? null : Math.min(100, Math.round((reactionVariability / 300) * 100)),
        tau,
        tauPercent: tau === null ? null : Math.min(100, Math.round((tau / 450) * 100)),
        latePhaseDrop,
        latePhasePercent: latePhaseDrop === null ? null : toPercent(latePhaseDrop, 1),
        signalScore: hasStoredNumber(signal.score) ? Number(signal.score) : null
      },
      impulsivity: {
        asrsScore: hasAsrsSurvey ? asrsImpulseScore : dsm.hyperactivityYes,
        asrsMax: hasAsrsSurvey ? 8 : 9,
        commissionRate,
        commissionPercent: commissionRate === null ? null : toPercent(commissionRate, 1),
        fastErrorRate,
        fastErrorPercent: fastErrorRate === null ? null : toPercent(fastErrorRate, 1),
        meanGoReactionTime,
        meanGoPercent: meanGoReactionTime === null ? null : Math.min(100, Math.round((meanGoReactionTime / 800) * 100)),
        patternLabel: impulsePattern === "impulsive"
          ? "충동적 반응 패턴"
          : impulsePattern === "mixed"
            ? "주의 저하 혼합 패턴"
            : impulsePattern === "balanced"
              ? "비교적 균형된 패턴"
              : null,
        goNoGoScore: hasStoredNumber(goNogo.score) ? Number(goNogo.score) : null
      }
    },
    bridge: {
      cta: report.bridge?.cta || "나만의 맞춤 훈련 설계하기"
    }
  };
}

async function sendPlanChat(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = new FormData(form).get("message");
  const text = String(message || "").trim();
  if (!text) {
    return;
  }

  await ensureInsights();
  state.currentRecord.plan.chat.push({ role: "user", text });

  const result = await api("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      record: state.currentRecord,
      message: text
    })
  });

  state.currentRecord.plan.chat.push({
    role: "assistant",
    text: result.reply
  });

  if (result.additionalSuggestion) {
    const nextSuggestions = [...state.currentRecord.plan.suggestions, result.additionalSuggestion];
    state.currentRecord.plan.suggestions = nextSuggestions
      .map((item) => normalizePlanSuggestion(item))
      .filter(Boolean)
      .slice(-3);
  }

  state.currentRecord.currentStep = "plan";
  await persistRecord();
  form.reset();
  render();
}

function render() {
  if (state.route !== "game") {
    cleanupGameRuntime();
  }
  renderTopbarActions();
  renderNav();
  const page = pages[state.route] ? pages[state.route]() : pages.intro();
  app.classList.toggle("app-dtx-embed", state.route === "dtx");
  app.innerHTML = page
    + renderAiPendingModal()
    + (state.showJsonModal ? renderJsonModal() : "")
    + (state.showThemeModal ? renderThemeModal() : "");
  updateBodyScrollLock();
  bindPageEvents();

  if (state.route === "game") {
    gameRuntime.liveDomUpdater = updateLiveGameDom;
  }
}

function isAiAnswerPending() {
  const route = state.route;
  const asrsPending = route === "asrs-result"
    && Boolean(state.aiStatus?.configured)
    && !state.currentRecord?.asrsAnalysis?.summary;
  const dsmPending = route === "dsm-result"
    && Boolean(state.aiStatus?.configured)
    && !state.currentRecord?.dsm5QuickAnalysis?.summary;
  const reactivityPending = route === "game"
    && state.gameUi?.phase === "completed"
    && Boolean(state.aiStatus?.configured)
    && state.currentRecord?.reactivityAnalysis?.source !== "ai";
  const insightsPending = state.isGeneratingInsights
    || ((route === "report" || route === "plan")
      && (!state.currentRecord?.report
        || state.currentRecord.report.schemaVersion !== 2
        || !state.currentRecord?.plan?.suggestions?.length));

  return state.isGeneratingAsrsAnalysis
    || state.isGeneratingDsmAnalysis
    || state.isGeneratingReactivityAnalysis
    || asrsPending
    || dsmPending
    || reactivityPending
    || insightsPending;
}

function renderAiPendingModal() {
  if (!isAiAnswerPending()) {
    return "";
  }

  return `
    <div class="overlay-modal ai-pending-modal" role="status" aria-live="polite">
      <div class="panel stack-md overlay-dialog ai-pending-dialog">
        <div class="ai-pending-spinner" aria-hidden="true"></div>
        <h3 class="title-lg">AI가 답변을 생성하고 있어요, 잠시만 기다려 주세요</h3>
      </div>
    </div>
  `;
}

function updateBodyScrollLock() {
  const isProtectedGamePhase = state.route === "game"
    && (state.gameUi?.phase === "countdown" || state.gameUi?.phase === "running")
    && ["go_nogo", "balance_hold"].includes(state.gameUi?.activeTestKey);
  const shouldLockScroll = Boolean(isProtectedGamePhase || isAiAnswerPending());
  document.body.classList.toggle("body-scroll-lock", shouldLockScroll);
}

function renderNav() {
  const activeRoute = state.route === "asrs-result"
    ? "asrs"
    : state.route === "dsm-result"
      ? "dsm"
      : state.route;
  const inlineNav = state.route === "intro"
    || state.route === "id"
    || state.route === "report"
    || (state.route === "game" && state.gameUi?.phase === "completed");
  const reviewEnabled = Boolean(state.currentRecord);
  bottomNav.className = `bottom-nav top-nav${inlineNav ? " bottom-nav-inline" : ""}`;
  app.classList.toggle("app-inline-nav", inlineNav);
  bottomNav.innerHTML = routes
    .map((route) => {
      const active = activeRoute === route.key ? "active" : "";
      const interactive = reviewEnabled && ["hub", "asrs", "dsm", "game", "report", "plan"].includes(route.key);
      return `
        <button
          class="nav-item ${active} ${interactive ? "is-interactive" : ""}"
          aria-current="${active ? "page" : "false"}"
          ${interactive ? `data-nav-route="${route.key}"` : "disabled"}
          type="button"
        >
          <span class="material-symbols-outlined">${route.icon}</span>
          <span class="label">${route.label}</span>
        </button>
      `;
    })
    .join("");
}

function renderSignalStimulus(stimulus, visible) {
  const imageSrc = withReplayToken(stimulus?.imageSrc || SIGNAL_TARGET_IMAGE, state.gameUi?.stimulusReplayToken);
  const feedbackState = state.gameUi?.signalFeedbackState || "idle";
  const feedbackSrc = SIGNAL_FEEDBACK_IMAGES[feedbackState] || SIGNAL_FEEDBACK_IMAGES.idle;
  const responseWindowState = state.gameUi?.responseWindowState || "visible";
  const isPending = !visible && responseWindowState === "pending";
  return `
    <button class="stimulus-stage ${visible ? "active" : "ghost"} ${isPending ? "pending-window" : ""}" data-game-tap="signal_detection" type="button">
      <div class="stimulus-stage-backdrop" aria-hidden="true"></div>
      <div class="stimulus-asset-shell">
        ${visible
          ? `<img class="stimulus-image" src="${imageSrc}" alt="" draggable="false">`
          : `<div class="stimulus-placeholder ${isPending ? "pending-window" : ""}" aria-hidden="true">${isPending ? "..." : "?"}</div>`
        }
      </div>
      ${isPending ? `<div class="response-window-indicator">아직 입력 가능</div>` : ""}
      <img class="stimulus-feedback-layer" src="${feedbackSrc}" alt="" aria-hidden="true" draggable="false">
    </button>
  `;
}

function renderGoNoGoStimulus(stimulus, visible) {
  const imageSrc = withReplayToken(stimulus?.imageSrc || GO_NOGO_STIMULUS_IMAGES.go, state.gameUi?.stimulusReplayToken);
  const feedbackState = state.gameUi?.stage === "practice" ? (state.gameUi?.goNoGoFeedbackState || "idle") : null;
  const feedbackSrc = feedbackState ? (GO_NOGO_FEEDBACK_IMAGES[feedbackState] || GO_NOGO_FEEDBACK_IMAGES.idle) : "";
  const responseWindowState = state.gameUi?.responseWindowState || "visible";
  const isPending = !visible && responseWindowState === "pending";
  return `
    <div class="go-nogo-interaction-surface" data-go-nogo-surface>
      <div class="go-nogo-scene ${isPending ? "pending-window" : ""}" data-go-nogo-scene role="button" tabindex="0" aria-label="멈춤 버튼 과제 영역">
        <div class="go-nogo-stage-backdrop" aria-hidden="true"></div>
        ${feedbackState ? `<img class="go-nogo-feedback-layer visible is-${feedbackState}" src="${feedbackSrc}" alt="" aria-hidden="true" draggable="false">` : ""}
        <div class="go-nogo-stimulus-shell">
          <img class="go-nogo-stimulus-image" src="${imageSrc}" alt="" draggable="false">
        </div>
      </div>
    </div>
  `;
}

function renderBalanceArena(balance = {}) {
  const x = ((balance.x || 0) * 34).toFixed(1);
  const y = ((balance.y || 0) * 34).toFixed(1);
  const targetX = ((balance.targetX || 0) * 34).toFixed(1);
  const targetY = ((balance.targetY || 0) * 34).toFixed(1);
  const shouldHideBall = balance.inputSource === "long_touch" && balance.inside === false;
  return `
    <div class="balance-arena">
      <div data-live-balance-target class="balance-target ${balance.inside === false ? "outside" : ""}" style="transform:translate(${targetX}px, ${targetY}px)">
        <div data-live-balance-ball class="balance-ball ${shouldHideBall ? "is-hidden" : ""}" style="transform:translate(${x}px, ${y}px)"></div>
      </div>
    </div>
  `;
}

function renderGameMetrics(result) {
  const entries = Object.entries(result || {})
    .filter(([key]) => !["test_type", "mode", "interpretation", "title", "score", "input_source"].includes(key))
    .slice(0, 6);
  return `
    <div class="game-metrics">
      ${entries.map(([key, value]) => `
        <div class="metric-card stack-sm">
          <span class="eyebrow">${key.replaceAll("_", " ")}</span>
          <strong>${value}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderReactivityHighlights(summary) {
  const highlights = summary?.highlights || [];
  if (!highlights.length) {
    return "";
  }
  return `
    <div class="game-metrics">
      ${highlights.map((item) => `
        <div class="metric-card stack-sm">
          <div class="flex items-center justify-between gap-3">
            <span class="eyebrow">${item.label}</span>
            ${item.sourceTests?.length ? `<span class="muted" style="font-size:0.74rem;white-space:nowrap">${item.sourceTests.join(", ")}</span>` : ""}
          </div>
          <strong>${item.value}</strong>
          <span class="muted">${item.note}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function updateLiveGameDom(ui) {
  if (ui.activeTestKey === "balance_hold") {
    const fill = document.querySelector("[data-live-progress='balance']");
    const countdown = document.querySelector("[data-live-countdown='balance']");
    const ball = document.querySelector("[data-live-balance-ball]");
    const target = document.querySelector("[data-live-balance-target]");

    if (fill) {
      fill.style.width = `${clamp(ui.progressPercent || 0, 0, 100)}%`;
    }
    if (countdown) {
      countdown.textContent = `${ui.balance?.remainingMs ? Math.ceil(ui.balance.remainingMs / 1000) : 0}s`;
    }
    if (ball) {
      const x = ((ui.balance?.x || 0) * 34).toFixed(1);
      const y = ((ui.balance?.y || 0) * 34).toFixed(1);
      ball.style.transform = `translate(${x}px, ${y}px)`;
      ball.classList.toggle("is-hidden", ui.balance?.inputSource === "long_touch" && ui.balance?.inside === false);
    }
    if (target) {
      const targetX = ((ui.balance?.targetX || 0) * 34).toFixed(1);
      const targetY = ((ui.balance?.targetY || 0) * 34).toFixed(1);
      target.style.transform = `translate(${targetX}px, ${targetY}px)`;
      target.classList.toggle("outside", ui.balance?.inside === false);
    }
    return;
  }

  if (ui.activeTestKey === "go_nogo") {
    const fill = document.querySelector("[data-live-progress='go_nogo']");
    if (fill) {
      fill.style.width = `${clamp(ui.progressPercent || 0, 0, 100)}%`;
    }
    return;
  }

  if (ui.activeTestKey === "signal_detection") {
    const fill = document.querySelector(`[data-live-progress='${ui.activeTestKey}']`);
    if (fill) {
      fill.style.width = `${clamp(ui.progressPercent || 0, 0, 100)}%`;
    }
  }
}

function renderGamePage() {
  ensureGuestGameRecord();
  const game = getGameState();
  const ui = state.gameUi || createOverviewUi();
  const meta = GAME_META[ui.activeTestKey || game.currentTestKey];
  const completedCount = GAME_ORDER.filter((key) => game.tests[key]).length;
  const progressPercent = clamp(ui.progressPercent ?? ((completedCount / GAME_ORDER.length) * 100), 0, 100);
  const fallbackReactivityAnalysis = ui.phase === "completed"
    ? buildLocalReactivityAnalysis(state.currentRecord)
    : null;
  const reactivityAnalysis = ui.phase === "completed"
    ? (state.currentRecord?.reactivityAnalysis || fallbackReactivityAnalysis)
    : null;
  const hasReactivityAiResult = state.currentRecord?.reactivityAnalysis?.source === "ai";

  if (ui.phase === "completed" && state.aiStatus?.configured && !hasReactivityAiResult && !state.isGeneratingReactivityAnalysis) {
    window.setTimeout(() => {
      ensureReactivityAnalysis().catch((error) => setStatus(error.message));
    }, 0);
  }

  if (ui.phase === "instruction" && ui.activeTestKey === "signal_detection") {
    return `
      <section class="page game-page">
        <div class="panel stack-md game-status-panel">
          <div class="signal-instruction-header">
            <div class="signal-instruction-guide">
              <img class="signal-instruction-character" src="/newimages/basic.png?v=${IMAGE_ASSET_VERSION}" alt="안내 캐릭터 애드" />
              <p class="signal-instruction-copy">
                파란색 별이 나올 때만 클릭하세요. 다음 이미지가 나오기 전까지 클릭 가능합니다.
              </p>
            </div>
            <span class="chip">1 / ${GAME_ORDER.length}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" data-live-progress="signal_detection" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="hero-card stack-lg game-stage-card">
          ${renderSignalStimulus(ui.stimulus, true)}
          <button class="button-secondary safe-bottom-actions" id="signal-detection-begin-button">시작하기</button>
        </div>
      </section>
    `;
  }

  if (ui.phase === "running" && ui.activeTestKey === "signal_detection") {
    return `
      <section class="page game-page">
        <div class="panel stack-md game-status-panel">
          <div class="flex items-end justify-between gap-4">
            <div></div>
            <span class="chip">${ui.trialIndex} / ${ui.totalTrials}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" data-live-progress="signal_detection" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="hero-card stack-lg game-stage-card">
          ${renderSignalStimulus(ui.stimulus, ui.stimulusVisible)}
        </div>
      </section>
    `;
  }

  if (ui.phase === "running" && ui.activeTestKey === "go_nogo") {
    const title = ui.stage === "practice" ? `${meta.title}(연습)` : meta.title;
    return `
      <section class="page game-page">
        <div class="panel stack-md game-status-panel">
          <div class="flex items-end justify-between gap-4">
            <div>
              <h2 class="title-lg">${title}</h2>
            </div>
            <span class="chip">${ui.trialIndex} / ${ui.totalTrials}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" data-live-progress="go_nogo" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="hero-card stack-lg game-stage-card">
          ${renderGoNoGoStimulus(ui.stimulus, ui.stimulusVisible)}
          ${ui.stage === "practice" ? `<p class="muted">동그라미는 누르고, 엑스는 누르지 않습니다.</p>` : ""}
        </div>
      </section>
    `;
  }

  if (ui.phase === "input-select" && ui.activeTestKey === "balance_hold") {
    const options = ui.balanceInputOptions || detectBalanceInputOptions();
    return `
      <section class="page game-page">
        <div class="panel stack-md game-status-panel">
          <div class="flex items-end justify-between gap-4">
            <div>
              <h2 class="title-lg">${meta.title}(연습)</h2>
              <p class="muted">연습 전에 입력 방식을 먼저 확인합니다.</p>
            </div>
            <span class="chip">3 / ${GAME_ORDER.length}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" data-live-progress="balance" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="hero-card stack-lg game-stage-card">
          <div class="panel stack-md">
            <strong>${options.supportsDeviceMotion ? "자이로 센서를 사용할 수 있습니다." : "자이로 센서를 사용할 수 없습니다."}</strong>
            <p class="muted">${options.supportsDeviceMotion
              ? "센서로 진행하면 기기를 기울여 공을 맞춥니다. 원하면 터치/마우스 방식으로 바꿔 연습할 수도 있습니다."
              : options.supportsTouchFallback
                ? "이 기기에서는 터치 방식으로 진행합니다. 중앙 원을 길게 누르면 공이 안쪽에 유지됩니다."
                : "이 환경에서는 마우스나 터치 위치를 따라 공이 움직이는 방식으로 진행합니다."
            }</p>
          </div>
          <div class="two-actions balance-input-actions">
            ${options.supportsDeviceMotion ? `<button class="button-secondary" type="button" data-balance-input-source="sensor">센서로 진행</button>` : ""}
            <button class="button-ghost" type="button" data-balance-input-source="${options.supportsTouchFallback ? "long_touch" : "pointer"}">
              ${options.supportsTouchFallback ? "터치로 진행" : "마우스로 진행"}
            </button>
          </div>
        </div>
      </section>
    `;
  }

  if (ui.activeTestKey === "balance_hold" && (ui.phase === "countdown" || ui.phase === "running")) {
    const balanceTitle = ui.stage === "practice" || ui.stage === "practice-calibration"
      ? `${meta.title}(연습)`
      : meta.title;
    return `
      <section class="page game-page">
        <div class="panel stack-md game-status-panel">
          <div class="flex items-end justify-between gap-4">
            <div>
              <h2 class="title-lg">${balanceTitle}</h2>
              <p class="muted">${ui.message || ui.prompt}</p>
            </div>
            <span class="chip" data-live-countdown="balance">${ui.balance?.remainingMs ? Math.ceil(ui.balance.remainingMs / 1000) : ui.countdown || 30}s</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" data-live-progress="balance" style="width:${progressPercent}%"></div></div>
        </div>
        <div class="hero-card stack-lg game-stage-card">
          ${renderBalanceArena(ui.balance)}
          <p class="muted">${ui.phase === "running" ? getBalanceInputDescription(ui.balance?.inputSource, ui.stage === "practice") : ""}</p>
        </div>
      </section>
    `;
  }

  if (ui.phase === "result" || ui.phase === "completed") {
    const result = ui.result || {};
    const isPractice = ui.stage === "practice-complete";
    const nextLabel = ui.phase === "completed" ? "패턴 리포트로 이동" : isPractice ? "본 과제 시작" : "다음 과제";
    return `
      <section class="page game-page ${ui.phase === "completed" ? "game-page-completed" : ""}">
        <div class="hero-card stack-lg">
          <div class="stack-sm">
            <h2 class="title-lg">${ui.phase === "completed" ? "반응성 과제 요약" : result.title || meta.title}</h2>
            <p class="muted">${ui.phase === "completed"
              ? reactivityAnalysis?.summary || game.summary?.summary || ""
              : result.interpretation || ""}</p>
          </div>
          ${ui.phase === "completed"
            ? `<div class="game-metrics">
                <div class="metric-card stack-sm"><span class="eyebrow">집중 유지</span><strong>${game.summary?.inattention_signal?.score ?? "-"}</strong></div>
                <div class="metric-card stack-sm"><span class="eyebrow">반응 조절</span><strong>${game.summary?.impulsivity_signal?.score ?? "-"}</strong></div>
                <div class="metric-card stack-sm"><span class="eyebrow">움직임 조절</span><strong>${game.summary?.activity_signal?.score ?? "-"}</strong></div>
              </div>`
            : Number.isFinite(result.score) ? `<div class="panel stack-sm"><span class="eyebrow">score</span><strong style="font-size:2rem">${result.score}</strong></div>` : ""}
        </div>
        ${ui.phase === "completed" && game.summary ? renderReactivityHighlights(game.summary) : isPractice ? "" : renderGameMetrics(result)}
        ${ui.phase === "completed" ? `
          <div class="panel stack-md">
            <div class="eyebrow">summary</div>
            <p class="muted">${reactivityAnalysis?.inattention || fallbackReactivityAnalysis?.inattention || ""}</p>
            <p class="muted">${reactivityAnalysis?.impulsivity || fallbackReactivityAnalysis?.impulsivity || ""}</p>
            <p class="muted">${reactivityAnalysis?.hyperactivity || fallbackReactivityAnalysis?.hyperactivity || ""}</p>
            <p class="muted">${reactivityAnalysis?.guidance || fallbackReactivityAnalysis?.guidance || ""}</p>
          </div>
        ` : ""}
        <button class="button-secondary safe-bottom-actions ${ui.phase === "completed" ? "reactivity-start-button" : ""}" id="game-next-button">${nextLabel}</button>
      </section>
    `;
  }

  return `
    <section class="page game-page">
      <div class="hero-card stack-lg">
        <div class="stack-sm">
          <h2 class="title-lg">반응성 과제 3종을 시작합니다.</h2>
        </div>
      </div>

      <div class="stack-md">
        ${GAME_ORDER.map((key, index) => {
          const item = GAME_META[key];
          const completed = Boolean(game.tests[key]);
          return `
            <div class="panel stack-sm">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <h3 class="title-lg" style="font-size:1.2rem">${index + 1}. ${item.title}</h3>
                </div>
                <span class="chip ${completed ? "chip-success" : ""}">${completed ? "완료" : "대기"}</span>
              </div>
              <p class="muted">${item.description}</p>
            </div>
          `;
        }).join("")}
      </div>

      <button class="button-secondary safe-bottom-actions reactivity-start-button" id="game-start-button">${game.status === "completed" ? "패턴 리포트 보기" : completedCount ? "이어하기" : "과제 시작"}</button>
    </section>
  `;
}

const pages = {
  intro() {
    return `
      <section class="page intro-page mobile-entry">
        <div class="entry-hero">
          <div class="entry-copy">
            <span class="eyebrow">focus self check</span>
            <h2 class="title-xl">ADDFCS.COM</h2>
            <p class="muted">애드와 함께 주의·집중·실행 기능 패턴을 정리하는 자기점검 도구</p>
          </div>
          <img class="entry-sticker" src="${state.introImageSrc}" alt="자가점검 예시 이미지" />
        </div>

        <div class="entry-actions intro-actions">
          <button class="button-secondary" type="button" id="intro-start-button">내 패턴 확인하기</button>
          <button class="button-ghost" type="button" id="intro-continue-button">이어서 하기</button>
          <p class="muted">의학적 진단이 아니라 일상 패턴을 이해하기 위한 참고용 안내로만 사용해 주세요.</p>
        </div>
      </section>
    `;
  },

  id() {
    if (state.showExistingIdForm) {
      return `
        <section class="page mobile-entry id-onboarding-page resume-load-page">
          <div class="id-onboarding-card">
            <img class="id-onboarding-character" src="/newimages/d1.png?v=${IMAGE_ASSET_VERSION}" alt="기록 이어하기 안내 이미지" />
            <div class="id-onboarding-copy">
              <h2 class="title-lg">다시 와서 반가워요.</h2>
              <p class="muted">이전에 만든 ID를 입력하면 저장된 위치에서 이어서 진행할 수 있어요.</p>
            </div>
          </div>
          <div class="panel stack-md resume-load-panel">
            <form id="manual-load-form" class="stack-sm">
              <div class="field">
                <label for="existing-user-id">기존 ID</label>
                <input id="existing-user-id" name="userId" class="text-input" value="${escapeHtml(state.loadUserId)}" placeholder="예: add01" />
              </div>
              <button class="button-secondary" type="submit">이어서 진행하기</button>
            </form>
            <button class="button-ghost" type="button" id="id-new-flow-button">새 ID 만들기</button>
          </div>
        </section>
      `;
    }

    if (state.idOnboardingStep === "resume-confirm") {
      return `
        <section class="page mobile-entry id-onboarding-page resume-load-page">
          <div class="id-onboarding-card">
            <img class="id-onboarding-character" src="/newimages/d18.png?v=${IMAGE_ASSET_VERSION}" alt="중단 기록 이어하기 안내 이미지" />
            <div class="id-onboarding-copy">
              <h2 class="title-lg">전에 하던 점검이 중간에 멈춰 있었어요.</h2>
              <p class="muted">저장된 위치부터 이어서 진행할게요. 이어하기를 누르면 지난번에 멈춘 화면으로 이동해요.</p>
            </div>
          </div>
          <button class="button-secondary safe-bottom-actions" type="button" id="resume-confirm-button">이어하기</button>
        </section>
      `;
    }

    if (state.idOnboardingStep === "app-intro") {
      return `
        <section class="page mobile-entry id-onboarding-page">
          <div class="id-onboarding-card">
            <img class="id-onboarding-character" src="/newimages/a1.png?v=${IMAGE_ASSET_VERSION}" alt="자가점검 소개 이미지" />
            <div class="id-onboarding-copy">
              <h2 class="title-lg">이 앱은 주의·집중 패턴을 함께 정리하는 자기점검 도구예요.</h2>
              <p class="muted">짧은 설문과 세부 설문, 반응성 과제 내용을 모아 지금 느끼는 일상 어려움과 실제 수행 패턴을 참고 리포트로 보여줘요.</p>
            </div>
          </div>
          <button class="button-secondary safe-bottom-actions" type="button" id="id-onboarding-understand-button">잘 알겠어요</button>
        </section>
      `;
    }

    if (state.idOnboardingStep === "create-id") {
      return `
        <section class="page mobile-entry id-onboarding-page">
          <div class="id-onboarding-card">
            <img class="id-onboarding-character" src="/newimages/a4.png?v=${IMAGE_ASSET_VERSION}" alt="ID 생성 안내 이미지" />
            <div class="id-onboarding-copy">
              <h2 class="title-lg">먼저 기록을 저장할 ID를 만들게요.</h2>
              <p class="muted">아직은 베타 테스트 기간이라 비밀번호는 입력하지 않아도 돼요. 나중에 이어서 보려면 만든 ID만 기억해 주세요.</p>
            </div>
          </div>
          <form id="create-id-form" class="entry-form id-create-form">
            <div class="field">
              <label for="user-id">아이디</label>
              <input id="user-id" name="userId" class="text-input" placeholder="예: add01" required />
            </div>
            <button class="button-secondary" type="submit">ID 만들기</button>
          </form>
        </section>
      `;
    }

    if (state.idOnboardingStep === "survey-choice" && state.currentRecord) {
      return `
        <section class="page mobile-entry id-onboarding-page">
          <div class="id-onboarding-card">
            <img class="id-onboarding-character" src="/newimages/d10.png?v=${IMAGE_ASSET_VERSION}" alt="설문 선택 안내 이미지" />
            <div class="id-onboarding-copy">
              <h2 class="title-lg">${escapeHtml(state.currentRecord.id)}님, 만나서 반가워요.</h2>
              <p class="muted">이제 주의·집중과 실행 기능에 대한 자기점검을 진행할게요. 6문항 간단 점검과 23문항 세부 점검 중 선택할 수 있어요.</p>
            </div>
          </div>

          <div class="panel stack-md survey-choice-panel">
            <button class="button-ghost" type="button" id="survey-difference-button">무엇이 다른가요?</button>
            ${state.showSurveyDifference ? `
              <div class="survey-difference-box">
                <p class="muted"><strong>6문항 간단 점검</strong>은 5점 척도로 답하면서 짧고 빠르게 현재 경향을 볼 수 있어요.</p>
                <p class="muted"><strong>23문항 세부 점검</strong>은 네/아니오로 답해서 시간이 조금 더 걸리지만, 과거 사례와 상황까지 포함해 더 자세히 살펴볼 수 있어요.</p>
              </div>
            ` : ""}
            <div class="two-actions">
              <button class="button-secondary" type="button" data-onboarding-survey="asrs">간단 점검</button>
              <button class="button-secondary" type="button" data-onboarding-survey="dsm">세부 점검</button>
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="page mobile-entry id-onboarding-page">
        <div class="id-onboarding-card">
          <img class="id-onboarding-character" src="/newimages/basic.png?v=${IMAGE_ASSET_VERSION}" alt="안내 캐릭터 애드" />
          <div class="id-onboarding-copy">
            <h2 class="title-lg">저는 애드예요. 만나서 반가워요.</h2>
            <p class="muted">지금부터 어렵지 않게 하나씩 안내해 드릴게요.</p>
          </div>
        </div>
        <button class="button-secondary safe-bottom-actions" type="button" id="id-onboarding-greet-button">저도 반가워요!</button>
      </section>
    `;
  },

  hub() {
    const id = state.currentRecord?.id || "나";
    const summary = buildHubSummary(state.currentRecord);
    const dtxStatus = getHubDtxStatus(state.currentRecord);
    const hasAsrsData = getAsrsAnswers(state.currentRecord).length > 0;
    const hasDsmData = getDsmAnswers(state.currentRecord).length > 0;
    const hasReactivityData = hasCompletedReactivity(state.currentRecord);
    const hasReportData = Boolean(state.currentRecord?.report?.schemaVersion === 2 && state.currentRecord?.plan?.suggestions?.length);
    window.setTimeout(() => {
      ensureHubTrendData(state.currentRecord).catch((error) => setStatus(error.message));
    }, 0);
    return `
      <section class="page hub-page">
        <div class="hub-summary">
          <img class="hub-summary-image" src="/newimages/basic.png?v=${IMAGE_ASSET_VERSION}" alt="안내 캐릭터 애드" />
          <div class="hub-summary-copy">
            <span class="eyebrow">hub</span>
            <h2 class="title-lg">${escapeHtml(id)}님의 현재 상황</h2>
            <p class="muted">${escapeHtml(summary)}</p>
          </div>
        </div>

        <button class="hub-dtx-button" type="button" data-route-next="dtx" style="--hub-dtx-bg:url('${dtxStatus.image}')">
          <span class="hub-dtx-title">실천 숲으로 이동</span>
          <span class="hub-dtx-meta">
            <span>Level ${escapeHtml(dtxStatus.level)}</span>
            <span>${dtxStatus.score}점</span>
          </span>
        </button>

        <div class="hub-test-grid">
          ${renderHubActionButton({
            label: "간단 점검 다시하기",
            icon: "quiz",
            statusLabel: hasAsrsData ? "간단 점검 기록 있음" : "간단 점검 기록 없음",
            hasData: hasAsrsData,
            attrs: 'data-retake-test="asrs"'
          })}
          ${renderHubActionButton({
            label: "세부 점검 다시하기",
            icon: "checklist",
            statusLabel: hasDsmData ? "세부 점검 기록 있음" : "세부 점검 기록 없음",
            hasData: hasDsmData,
            attrs: 'data-retake-test="dsm"'
          })}
          ${renderHubActionButton({
            label: "반응성 과제 다시하기",
            icon: "neurology",
            statusLabel: hasReactivityData ? "반응성 과제 기록 있음" : "반응성 과제 기록 없음",
            hasData: hasReactivityData,
            attrs: 'data-retake-test="game"'
          })}
          ${renderHubActionButton({
            label: "리포트 다시 보기",
            icon: "analytics",
            statusLabel: hasReportData ? "패턴 리포트 있음" : "패턴 리포트 없음",
            hasData: hasReportData,
            attrs: 'id="reanalyze-button"',
            extraClass: "hub-reanalyze-button"
          })}
        </div>
        ${renderHubTrendChart()}
        <p class="muted hub-note">리포트 다시 보기를 누르면 현재 저장된 자기점검과 반응성 과제 기록을 바탕으로 참고 리포트를 새로 정리합니다.</p>
      </section>
    `;
  },

  dtx() {
    return `
      <section class="page dtx-embed-page">
        <iframe class="dtx-embed-frame" src="${getDtxEmbedSrc(state.currentRecord)}" title="실천 숲"></iframe>
      </section>
    `;
  },

  asrs() {
    const config = state.configs.asrs;
    const progress = ((state.asrsIndex + 1) / config.questions.length) * 100;
    const currentQuestion = config.questions[state.asrsIndex];
    const currentAnswer = getAsrsAnswers()?.[state.asrsIndex]?.answer;
    const currentImage = getAsrsImageSrc(state.asrsIndex);
    return `
      <section class="page">
        ${renderAddGuide("문항을 하나씩 보고 가장 가까운 빈도를 골라주세요.", { compact: true, tone: "6문항 간단 점검" })}
        <div class="panel stack-md">
          <div class="stack-sm">
            <div class="survey-header-row">
              <div class="survey-header-main">
                <h2 class="title-lg asrs-title">${config.title}</h2>
                <p class="muted">최근 6개월을 떠올려 가볍게 자가점검해요.</p>
              </div>
              <div class="eyebrow survey-header-counter">${state.asrsIndex + 1} / ${config.questions.length}</div>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <div class="hero-card stack-lg asrs-survey-card">
          <div class="panel asrs-image-panel">
            <img class="asrs-image" src="${currentImage}" alt="간단 자기점검 문항 ${state.asrsIndex + 1}" />
          </div>
          <p class="asrs-question">${currentQuestion.prompt}</p>
          <div class="panel stack-sm">
            <button
              class="asrs-example-toggle"
              type="button"
              data-asrs-example-toggle
              aria-expanded="${state.showAsrsExamples ? "true" : "false"}"
            >
              <span class="eyebrow">예시</span>
              <span class="asrs-example-caret ${state.showAsrsExamples ? "expanded" : ""}" aria-hidden="true">▾</span>
            </button>
            <ul class="stack-sm asrs-example-list ${state.showAsrsExamples ? "expanded" : "collapsed"}">
              ${currentQuestion.examples.map((example) => `<li class="muted">- ${example}</li>`).join("")}
            </ul>
          </div>
          <div class="question-scale continuous">
            ${config.scale.map((item) => `
              <button class="choice-button ${currentAnswer === item.value ? "selected" : ""}" type="button" data-asrs-answer="${item.value}" ${state.isAdvancingAsrs ? "disabled" : ""}>
                <div class="choice-dot"><strong>${item.value}</strong></div>
                <span class="choice-label">${item.label}</span>
              </button>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  },

  "asrs-result"() {
    const analysis = analyzeAsrs();
    const postSurveyAction = getPostSurveyAction(state.currentRecord);
    if (!state.currentRecord?.asrsAnalysis?.summary && !state.isGeneratingAsrsAnalysis && state.aiStatus?.configured) {
      window.setTimeout(() => {
        ensureAsrsAnalysis().catch((error) => setStatus(error.message));
      }, 0);
    }
    return `
      <section class="page">
        <div class="hero-card stack-lg">
          <div class="eyebrow">간단 점검 요약</div>
          <p class="muted">${
            state.currentRecord?.asrsAnalysis?.summary
              ? state.currentRecord.asrsAnalysis.summary
              : analysis.isComplete
                ? analysis.summary
                : "아직 6문항이 모두 입력되지는 않았어요. 지금까지의 응답만 기준으로 가볍게 보여드릴게요."
          }</p>
        </div>

        <div class="grid-2">
          <div class="panel stack-md">
            <div class="eyebrow">일상 어려움 지표</div>
            <div class="flex items-end justify-between gap-4">
              <strong style="font-size:1.8rem">${analysis.totalPositive} / 6</strong>
              <span class="chip">${analysis.severity}</span>
            </div>
            <p class="muted">6문항 중 부담이 표시된 문항 수예요. 숫자가 높을수록 집중이나 조절의 어려움을 더 자주 느꼈을 수 있어요.</p>
          </div>
          <div class="panel stack-md">
            <div class="eyebrow">어느 쪽 부담인가요?</div>
            <div class="report-item">
              <div class="flex items-center justify-between gap-4">
                <strong>집중 유지</strong>
                <span class="chip">${analysis.attentionPositive} / 4</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${analysis.attentionPositive * 25}%"></div></div>
            </div>
            <div class="report-item">
              <div class="flex items-center justify-between gap-4">
                <strong>반응 조절</strong>
                <span class="chip">${analysis.hyperPositive} / 2</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${analysis.hyperPositive * 50}%"></div></div>
            </div>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="eyebrow">쉽게 풀어보면</div>
          <p class="muted">${state.currentRecord?.asrsAnalysis?.attention || analysis.attentionMessage}</p>
          <p class="muted">${state.currentRecord?.asrsAnalysis?.hyperactivity || analysis.hyperMessage}</p>
          <p class="muted">${state.currentRecord?.asrsAnalysis?.guidance || analysis.guidance}</p>
        </div>

        <div class="result-next-actions safe-bottom-actions">
          <button class="button-secondary" data-route-next="${postSurveyAction.route}">${postSurveyAction.label}</button>
        </div>
      </section>
    `;
  },

  "dsm-result"() {
    const analysis = analyzeDsm();
    const postSurveyAction = getPostSurveyAction(state.currentRecord);
    const quickAnalysis = state.currentRecord?.dsm5QuickAnalysis || buildLocalDsmQuickAnalysis(state.currentRecord);
    if (!state.currentRecord?.dsm5QuickAnalysis?.summary && !state.isGeneratingDsmAnalysis && state.aiStatus?.configured) {
      window.setTimeout(() => {
        ensureDsmAnalysis().catch((error) => setStatus(error.message));
      }, 0);
    }
    return `
      <section class="page">
        <div class="hero-card stack-lg">
          <div class="eyebrow">세부 점검 요약</div>
          <p class="muted">${quickAnalysis.summary}</p>
        </div>

        <div class="grid-2">
          <div class="panel stack-md">
            <div class="eyebrow">현재 가장 가까운 패턴</div>
            <div class="flex items-end justify-between gap-4">
              <strong style="font-size:1.6rem">${analysis.subtype}</strong>
              <span class="chip">${analysis.inattentionYes + analysis.hyperactivityYes} yes</span>
            </div>
            <p class="muted">${quickAnalysis.guidance}</p>
          </div>
          <div class="panel stack-md">
            <div class="eyebrow">영역별 부담</div>
            <div class="report-item">
              <div class="flex items-center justify-between gap-4">
                <strong>집중 유지</strong>
                <span class="chip">${analysis.inattentionYes} / 9</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${analysis.inattentionYes * (100 / 9)}%"></div></div>
            </div>
            <div class="report-item">
              <div class="flex items-center justify-between gap-4">
                <strong>반응 조절</strong>
                <span class="chip">${analysis.hyperactivityYes} / 9</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${analysis.hyperactivityYes * (100 / 9)}%"></div></div>
            </div>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="eyebrow">쉽게 풀어보면</div>
          <p class="muted">${quickAnalysis.subtype || analysis.subtype}</p>
          <p class="muted">${quickAnalysis.inattention}</p>
          <p class="muted">${quickAnalysis.hyperactivity}</p>
        </div>

        <div class="result-next-actions safe-bottom-actions">
          <button class="button-secondary" data-route-next="${postSurveyAction.route}">${postSurveyAction.label}</button>
        </div>
      </section>
    `;
  },

  dsm() {
    const config = state.configs.dsm;
    const progress = ((state.dsmIndex + 1) / config.questions.length) * 100;
    const question = config.questions[state.dsmIndex];
    const currentAnswer = getDsmAnswers()?.[state.dsmIndex]?.answer;
    return `
      <section class="page">
        ${renderAddGuide("맞다/아니다 중 더 가까운 쪽을 선택하면 다음 문항으로 넘어가요.", { compact: true, tone: "23문항 심층 점검" })}
        <div class="panel stack-md">
          <div class="stack-sm">
            <div class="survey-header-row">
              <div class="survey-header-main">
                <h2 class="title-lg asrs-title">${config.title}</h2>
                <p class="muted">의학적 진단이 아니라 주의·집중·실행 기능 패턴을 나눠 보는 참고용 점검이에요.</p>
              </div>
              <div class="eyebrow survey-header-counter">${state.dsmIndex + 1} / ${config.questions.length}</div>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <div class="hero-card stack-lg dsm-survey-card">
          <div class="panel dsm-image-panel">
            <img class="dsm-image" src="${getDsmImageSrc(state.dsmIndex)}" alt="실행 기능 세부 점검 문항 ${state.dsmIndex + 1}" />
          </div>
          <p class="asrs-question">${question.prompt}</p>
          <p class="muted">${question.hint}</p>
          <div class="binary-grid">
            <button class="binary-button ${currentAnswer === false ? "selected-no" : ""}" type="button" data-dsm-answer="false" ${state.isAdvancingDsm ? "disabled" : ""}>아니다</button>
            <button class="binary-button ${currentAnswer === true ? "selected-yes" : ""}" type="button" data-dsm-answer="true" ${state.isAdvancingDsm ? "disabled" : ""}>그렇다</button>
          </div>
        </div>
      </section>
    `;
  },

  game() {
    return renderGamePage();
  },

  report() {
    const hasReport = Boolean(state.currentRecord?.report) && state.currentRecord.report.schemaVersion === 2;
    if (!hasReport && !state.isGeneratingInsights) {
      window.setTimeout(() => {
        ensureInsights().catch((error) => setStatus(error.message));
      }, 0);
    }
    if (state.isGeneratingInsights || !hasReport) {
      return `
        <section class="page">
        </section>
      `;
    }
    const report = computeLocalReportViewModel();
    const activeTab = state.reportProfileTab === "impulsivity" ? "impulsivity" : "inattention";
    const profileMetric = activeTab === "inattention" ? report.metrics.inattention : report.metrics.impulsivity;
    return `
      <section class="page">
        <div class="hero-card stack-lg report-hero-card">
          <div class="eyebrow">pattern report</div>
          <div class="stack-sm">
            <div class="report-badge-row">
              ${report.hero.badges.map((badge) => `<span class="chip">${badge}</span>`).join("")}
            </div>
            <h2 class="title-lg">${state.currentRecord.id}님의 현재 주의·집중 패턴은 <span class="theme-accent-text">${report.severity}</span> 흐름으로 정리돼요.</h2>
            <p class="muted">${report.hero.summary}</p>
            <p class="muted">이 리포트는 의학적 진단이 아니라 자기점검 참고 자료이며, 어려움이 지속되면 정확한 이해를 위해 전문가 상담을 함께 고려해볼 수 있습니다.</p>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="eyebrow">subjective vs objective</div>
          <div class="grid-2">
            <div class="metric-card stack-sm">
              <span class="eyebrow">카드 A · 내가 느끼는 일상</span>
              <strong>${report.crossCheck.subjectiveTitle}</strong>
              <p class="muted">${report.crossCheck.subjectiveText}</p>
            </div>
            <div class="metric-card stack-sm">
              <span class="eyebrow">카드 B · 과제에서 보인 수행</span>
              <strong>${report.crossCheck.objectiveTitle}</strong>
              <p class="muted">${report.crossCheck.objectiveText}</p>
            </div>
          </div>
          <div class="report-alignment-row">
            <span class="chip chip-success">${report.crossCheck.alignmentLabel}</span>
            <p class="muted">${report.crossCheck.alignmentSummary}</p>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="eyebrow">executive function profile</div>
          <div class="report-tab-row">
            <button class="button-ghost ${activeTab === "inattention" ? "report-tab-active" : ""}" type="button" data-report-tab="inattention">집중 유지</button>
            <button class="button-ghost ${activeTab === "impulsivity" ? "report-tab-active" : ""}" type="button" data-report-tab="impulsivity">반응 조절</button>
          </div>
          ${activeTab === "inattention" ? `
            <div class="stack-md">
              <p class="muted">${report.profile.inattentionSummary}</p>
              <div class="report-metric-grid">
                <div class="report-item">
                  <div class="flex items-center justify-between gap-4">
                    <strong>집중 유지 응답 지표</strong>
                    <span class="chip">${profileMetric.asrsScore} / ${profileMetric.asrsMax}</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${toPercent(profileMetric.asrsScore, profileMetric.asrsMax)}%"></div></div>
                </div>
                <div class="report-item">
                  <div class="flex items-center justify-between gap-4">
                    <strong>목표 놓침 비율</strong>
                    <span class="chip">${displayMetric(profileMetric.omissionRate === null ? null : Math.round(profileMetric.omissionRate * 100), "%")}</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${profileMetric.omissionPercent ?? 0}%"></div></div>
                </div>
                <div class="report-item">
                  <div class="flex items-center justify-between gap-4">
                    <strong>반응시간 변동성</strong>
                    <span class="chip">${displayMetric(profileMetric.reactionVariability, "ms")}</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${profileMetric.variabilityPercent ?? 0}%"></div></div>
                </div>
                <div class="report-item">
                  <div class="flex items-center justify-between gap-4">
                    <strong>Tau</strong>
                    <span class="chip">${displayMetric(profileMetric.tau, "ms")}</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${profileMetric.tauPercent ?? 0}%"></div></div>
                </div>
                <div class="report-item">
                  <div class="flex items-center justify-between gap-4">
                    <strong>후반부 정확도 저하</strong>
                    <span class="chip">${displayMetric(profileMetric.latePhaseDrop === null ? null : Math.round(profileMetric.latePhaseDrop * 100), "%")}</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${profileMetric.latePhasePercent ?? 0}%"></div></div>
                </div>
              </div>
            </div>
          ` : `
            <div class="stack-md">
              <p class="muted">${report.profile.impulsivitySummary}</p>
              <div class="report-metric-grid">
                <div class="report-item">
                  <div class="flex items-center justify-between gap-4">
                    <strong>반응 조절 응답 지표</strong>
                    <span class="chip">${profileMetric.asrsScore} / ${profileMetric.asrsMax}</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${toPercent(profileMetric.asrsScore, profileMetric.asrsMax)}%"></div></div>
                </div>
                <div class="report-item">
                  <div class="flex items-center justify-between gap-4">
                    <strong>잘못된 반응 비율</strong>
                    <span class="chip">${displayMetric(profileMetric.commissionRate === null ? null : Math.round(profileMetric.commissionRate * 100), "%")}</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${profileMetric.commissionPercent ?? 0}%"></div></div>
                </div>
                <div class="report-item">
                  <div class="flex items-center justify-between gap-4">
                    <strong>성급 반응 비율</strong>
                    <span class="chip">${displayMetric(profileMetric.fastErrorRate === null ? null : Math.round(profileMetric.fastErrorRate * 100), "%")}</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${profileMetric.fastErrorPercent ?? 0}%"></div></div>
                </div>
                <div class="report-item">
                  <div class="flex items-center justify-between gap-4">
                    <strong>Go 반응시간</strong>
                    <span class="chip">${displayMetric(profileMetric.meanGoReactionTime, "ms")}</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${profileMetric.meanGoPercent ?? 0}%"></div></div>
                </div>
                <div class="report-item">
                  <div class="flex items-center justify-between gap-4">
                    <strong>반응 패턴</strong>
                    <span class="chip">${profileMetric.patternLabel || "정보 없음"}</span>
                  </div>
                </div>
              </div>
            </div>
          `}
        </div>

        <div class="panel stack-md">
          <div class="eyebrow">daily impact</div>
          <div class="flex items-center justify-between gap-4">
            <strong>일상 피로도 ${report.dailyImpact.level} / 5</strong>
            <span class="chip">${report.dailyImpact.label}</span>
          </div>
          <div class="daily-impact-gauge" aria-hidden="true">
            ${Array.from({ length: 5 }, (_, index) => `
              <span class="daily-impact-step ${index < report.dailyImpact.level ? "active" : ""}"></span>
            `).join("")}
          </div>
          <p class="muted">${report.dailyImpact.empathy}</p>
        </div>

        <div class="panel stack-md">
          <div class="eyebrow">bridge</div>
          <div class="metric-card stack-sm">
            <strong>다음 단계로 바로 연결해 볼까요?</strong>
            <p class="muted">${report.sections.strength}</p>
            <p class="muted">${report.sections.watchout}</p>
          </div>
        </div>

        <button class="button-secondary safe-bottom-actions" data-route-next="plan">${report.bridge.cta}</button>
      </section>
    `;
  },

  plan() {
    const plan = state.currentRecord?.plan;
    const planSuggestions = Array.isArray(plan?.suggestions)
      ? plan.suggestions.map((item) => normalizePlanSuggestion(item)).filter(Boolean).slice(0, 3)
      : [];
    const hasPlan = planSuggestions.length > 0;
    if (!hasPlan && !state.isGeneratingInsights) {
      window.setTimeout(() => {
        ensureInsights().catch((error) => setStatus(error.message));
      }, 0);
    }
    if (state.isGeneratingInsights || !hasPlan) {
      return `
        <section class="page">
        </section>
      `;
    }
    return `
      <section class="page">
        <div class="hero-card stack-lg">
          <div class="eyebrow">action plan</div>
          <div class="stack-sm">
            <h2 class="title-lg">${state.currentRecord.id}에게 맞춘 3가지 제안</h2>
            <p class="muted">패턴 리포트를 바탕으로 바로 실행 가능한 작은 조정 방향을 정리했습니다.</p>
          </div>
        </div>

        <div class="tips-list">
          ${planSuggestions.map((suggestion, index) => `
            <div class="tip-item">
              <strong>${index + 1}. 실행 제안</strong>
              <p class="muted">${suggestion}</p>
            </div>
          `).join("")}
        </div>

        <div class="plan-hub-actions safe-bottom-actions">
          <button class="button-secondary" type="button" data-route-next="hub">허브로 가기</button>
        </div>
      </section>
    `;
  }
};

function scoreLabel(key) {
  const map = {
    attention: "집중 유지",
    executive: "실행 기능",
    impulse: "충동 조절",
    emotion: "정서 안정",
    structure: "일상 구조화"
  };
  return map[key] || key;
}

function renderAdminModal() {
  return `
    <div class="overlay-modal">
      <div class="panel stack-md overlay-dialog">
        <div class="flex items-center justify-between gap-4">
          <div class="stack-sm">
            <div class="eyebrow">admin</div>
            <h3 class="title-lg">저장된 사용자 목록</h3>
          </div>
          <button class="button-ghost" type="button" id="close-admin-modal">닫기</button>
        </div>
        <div class="stack-sm">
          ${state.records.length
            ? state.records.map((record) => `
              <div class="record-item">
                <div class="stack-sm">
                  <strong>${record.id}</strong>
                  <span class="muted">${record.fileName}</span>
                  <span class="muted">생성 ${formatDate(record.createdAt)} · 현재 단계 ${normalizeCurrentStep(record.currentStep)}</span>
                </div>
                <button class="button-ghost load-record" data-file="${record.fileName}">불러오기</button>
              </div>
            `).join("")
            : `<div class="list-card"><span class="muted">아직 저장된 기록이 없습니다.</span></div>`}
        </div>
      </div>
    </div>
  `;
}

function renderJsonModal() {
  return `
    <div class="overlay-modal">
      <div class="panel stack-md overlay-dialog overlay-dialog-wide">
        <div class="flex items-center justify-between gap-4">
          <div class="stack-sm">
            <div class="eyebrow">live json</div>
            <h3 class="title-lg">진행 중 기록 JSON</h3>
          </div>
          <button class="button-ghost" type="button" id="close-json-modal">닫기</button>
        </div>
        <div class="panel json-meta-panel">
          <span class="muted">파일: ${escapeHtml(state.currentRecord?.fileName || "없음")}</span>
        </div>
        <pre class="json-viewer">${escapeHtml(state.jsonModalContent || "{}")}</pre>
      </div>
    </div>
  `;
}

function renderThemeModal() {
  return `
    <div class="overlay-modal">
      <div class="panel stack-md overlay-dialog overlay-dialog-wide">
        <div class="flex items-center justify-between gap-4">
          <div class="stack-sm">
            <div class="eyebrow">design theme</div>
            <h3 class="title-lg">디자인 템플릿 선택</h3>
          </div>
          <button class="button-ghost" type="button" id="close-theme-modal">닫기</button>
        </div>
        <p class="muted"><code>designmd</code> 폴더의 템플릿을 읽어 현재 앱에 적용합니다.</p>
        <label class="theme-toggle-row" for="theme-font-scale-toggle">
          <span class="stack-sm">
            <strong>폰트 크기 템플릿 반영</strong>
            <span class="muted">끄면 현재 앱 기본 레이아웃 크기를 유지하고, 켜면 템플릿의 타이포 크기/행간/자간을 적용합니다.</span>
          </span>
          <input id="theme-font-scale-toggle" type="checkbox" ${state.themeFontScaleEnabled ? "checked" : ""} />
        </label>
        <div class="theme-grid">
          ${state.designThemes.length
            ? state.designThemes.map((theme) => `
              <button
                class="theme-card ${theme.slug === state.activeThemeSlug ? "active" : ""}"
                type="button"
                data-theme-slug="${escapeHtml(theme.slug)}"
              >
                <span class="theme-card-name">${escapeHtml(theme.name || theme.slug)}</span>
                <div class="theme-card-meta">
                  <span class="chip">${escapeHtml(theme.slug)}</span>
                  <span class="chip">${escapeHtml(theme.version || "unknown")}</span>
                </div>
                <span class="muted">${escapeHtml(theme.description || "설명이 없습니다.")}</span>
              </button>
            `).join("")
            : `<div class="list-card"><span class="muted">사용 가능한 디자인 템플릿이 없습니다.</span></div>`}
        </div>
      </div>
    </div>
  `;
}

function renderRadar(scores, labels) {
  const values = [
    scores.attention,
    scores.executive,
    scores.impulse,
    scores.emotion,
    scores.structure
  ];
  const center = 110;
  const radius = 84;
  const points = values.map((value, index) => {
    const angle = (-90 + index * (360 / values.length)) * (Math.PI / 180);
    const pointRadius = (radius * value) / 100;
    const x = center + pointRadius * Math.cos(angle);
    const y = center + pointRadius * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  const labelNodes = labels.map((label, index) => {
    const angle = (-90 + index * (360 / labels.length)) * (Math.PI / 180);
    const labelRadius = radius + 22;
    const x = center + labelRadius * Math.cos(angle);
    const y = center + labelRadius * Math.sin(angle);
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" fill="var(--theme-muted)" font-size="10" text-anchor="middle">${label}</text>`;
  }).join("");

  return `
    <svg class="radar-svg" viewBox="0 0 220 240" aria-label="radar graph">
      <polygon points="110,26 189.87,84.02 159.39,177.98 60.61,177.98 30.13,84.02" fill="none" stroke="color-mix(in srgb, var(--theme-muted) 15%, transparent)" />
      <polygon points="110,48 168.08,90.19 145.9,158.31 74.1,158.31 51.92,90.19" fill="none" stroke="color-mix(in srgb, var(--theme-muted) 10%, transparent)" />
      <polygon points="110,68 152.32,98.76 136.16,148.49 83.84,148.49 67.68,98.76" fill="none" stroke="color-mix(in srgb, var(--theme-muted) 8%, transparent)" />
      <polygon points="${points}" fill="color-mix(in srgb, var(--theme-accent) 16%, transparent)" stroke="var(--theme-accent)" stroke-width="2"></polygon>
      ${values.map((value, index) => {
        const angle = (-90 + index * (360 / values.length)) * (Math.PI / 180);
        const pointRadius = (radius * value) / 100;
        const x = center + pointRadius * Math.cos(angle);
        const y = center + pointRadius * Math.sin(angle);
        return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="var(--theme-accent)"></circle>`;
      }).join("")}
      ${labelNodes}
    </svg>
  `;
}

function bindPageEvents() {
  document.querySelectorAll("[data-route-next]").forEach((node) => {
    node.addEventListener("click", async (event) => {
      const route = event.currentTarget.getAttribute("data-route-next");
      if (route === "report" || route === "plan") {
        await ensureInsights();
      }
      await syncCurrentStep(route);
      navTo(route);
    });
  });

  document.querySelectorAll("[data-nav-route]").forEach((node) => {
    node.addEventListener("click", (event) => {
      const routeKey = event.currentTarget.getAttribute("data-nav-route");
      openReviewRoute(routeKey).catch((error) => setStatus(error.message));
    });
  });

  document.querySelector("#create-id-form")?.addEventListener("submit", (event) => {
    handleCreateId(event).catch((error) => setStatus(error.message));
  });

  document.querySelector("#intro-start-button")?.addEventListener("click", () => {
    state.showExistingIdForm = false;
    state.idOnboardingStep = "greeting";
    state.showSurveyDifference = false;
    state.route = "id";
    render();
  });

  document.querySelector("#intro-continue-button")?.addEventListener("click", () => {
    state.showExistingIdForm = true;
    state.pendingResumeFileName = "";
    state.pendingResumeRoute = "";
    state.showSurveyDifference = false;
    state.route = "id";
    render();
  });

  document.querySelector("#id-new-flow-button")?.addEventListener("click", () => {
    state.showExistingIdForm = false;
    state.idOnboardingStep = "greeting";
    state.pendingResumeFileName = "";
    state.pendingResumeRoute = "";
    state.showSurveyDifference = false;
    render();
  });

  document.querySelector("#id-onboarding-greet-button")?.addEventListener("click", () => {
    state.idOnboardingStep = "app-intro";
    render();
  });

  document.querySelector("#id-onboarding-understand-button")?.addEventListener("click", () => {
    state.idOnboardingStep = "create-id";
    render();
  });

  document.querySelector("#survey-difference-button")?.addEventListener("click", () => {
    state.showSurveyDifference = !state.showSurveyDifference;
    render();
  });

  document.querySelector("#resume-confirm-button")?.addEventListener("click", () => {
    continuePendingResume().catch((error) => setStatus(error.message));
  });

  document.querySelectorAll("[data-onboarding-survey]").forEach((node) => {
    node.addEventListener("click", async (event) => {
      const route = event.currentTarget.getAttribute("data-onboarding-survey");
      await syncCurrentStep(route);
      navTo(route);
    });
  });

  document.querySelector("#manual-load-form")?.addEventListener("submit", (event) => {
    state.loadUserId = new FormData(event.currentTarget).get("userId");
    submitManualLoad(event).catch((error) => setStatus(error.message));
  });

  document.querySelector("#toggle-existing-id-form")?.addEventListener("click", () => {
    toggleExistingIdForm();
  });

  document.querySelector("#open-admin-modal")?.addEventListener("click", () => {
    openAdminModal();
  });

  document.querySelector("#close-admin-modal")?.addEventListener("click", () => {
    closeAdminModal();
  });

  document.querySelector("#close-json-modal")?.addEventListener("click", () => {
    closeJsonModal();
  });

  document.querySelector("#close-theme-modal")?.addEventListener("click", () => {
    closeThemeModal();
  });

  document.querySelector("#theme-font-scale-toggle")?.addEventListener("change", (event) => {
    updateThemeFontScalePreference(event.currentTarget.checked);
  });

  document.querySelectorAll("[data-theme-slug]").forEach((node) => {
    node.addEventListener("click", async () => {
      await selectDesignTheme(node.getAttribute("data-theme-slug"));
      closeThemeModal();
    });
  });

  document.querySelectorAll(".load-record").forEach((node) => {
    node.addEventListener("click", () => {
      closeAdminModal();
      handleLoadRecord(node.getAttribute("data-file")).catch((error) => setStatus(error.message));
    });
  });

  document.querySelectorAll("[data-asrs-answer]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      answerAsrs(Number(node.getAttribute("data-asrs-answer"))).catch((error) => setStatus(error.message));
    });
  });

  document.querySelector("[data-asrs-example-toggle]")?.addEventListener("click", (event) => {
    event.preventDefault();
    toggleAsrsExamples();
  });

  document.querySelectorAll("[data-dsm-answer]").forEach((node) => {
    node.addEventListener("click", () => {
      answerDsm(node.getAttribute("data-dsm-answer") === "true").catch((error) => setStatus(error.message));
    });
  });

  document.querySelector("#game-start-button")?.addEventListener("click", () => {
    startGameFlow().catch((error) => setStatus(error.message));
  });

  document.querySelector("#signal-detection-begin-button")?.addEventListener("click", () => {
    startSignalDetectionMain();
  });

  document.querySelectorAll("[data-balance-input-source]").forEach((node) => {
    node.addEventListener("click", () => {
      const source = node.getAttribute("data-balance-input-source") || "";
      state.preferredBalanceInputSource = source;
      startBalanceCalibration("practice", source).catch((error) => setStatus(error.message));
    });
  });

  document.querySelectorAll("[data-game-select]").forEach((node) => {
    node.addEventListener("click", () => {
      selectGameTest(node.getAttribute("data-game-select")).catch((error) => setStatus(error.message));
    });
  });

  document.querySelector("#game-next-button")?.addEventListener("click", () => {
    if (state.gameUi?.stage === "practice-complete" && state.gameUi?.activeTestKey === "signal_detection") {
      startSignalDetectionMain();
      return;
    }
    if (state.gameUi?.stage === "practice-complete" && state.gameUi?.activeTestKey === "go_nogo") {
      startGoNoGoMain();
      return;
    }
    if (state.gameUi?.stage === "practice-complete" && state.gameUi?.activeTestKey === "balance_hold") {
      startBalanceCalibration("main", state.preferredBalanceInputSource || "").catch((error) => setStatus(error.message));
      return;
    }
    goToNextGameTest().catch((error) => setStatus(error.message));
  });

  document.querySelector("[data-game-tap='signal_detection']")?.addEventListener("click", () => {
    handleSignalDetectionTap();
  });

  const goNoGoScene = document.querySelector("[data-go-nogo-scene]");
  if (goNoGoScene && state.route === "game" && state.gameUi?.activeTestKey === "go_nogo") {
    addGameListener(goNoGoScene, "click", (event) => {
      event.preventDefault();
      handleGoNoGoTap();
    });
    addGameListener(goNoGoScene, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      handleGoNoGoTap();
    });
    addGameListener(goNoGoScene, "touchstart", (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      handleGoNoGoTap();
    }, { passive: false });
    addGameListener(goNoGoScene, "touchmove", (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
    }, { passive: false });
  }

  const balanceArena = document.querySelector(".balance-arena");
  if (balanceArena && state.route === "game" && state.gameUi?.activeTestKey === "balance_hold") {
    addGameListener(balanceArena, "touchstart", (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
    }, { passive: false });
    addGameListener(balanceArena, "touchmove", (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
    }, { passive: false });
  }

  document.querySelectorAll("[data-report-tab]").forEach((node) => {
    node.addEventListener("click", () => {
      state.reportProfileTab = node.getAttribute("data-report-tab") || "inattention";
      render();
    });
  });

  document.querySelector("#reanalyze-button")?.addEventListener("click", () => {
    forceRegenerateInsights().catch((error) => setStatus(error.message));
  });

  document.querySelectorAll("[data-retake-test]").forEach((node) => {
    node.addEventListener("click", () => {
      retakeAssessment(node.getAttribute("data-retake-test")).catch((error) => setStatus(error.message));
    });
  });

  document.querySelector("#plan-chat-form")?.addEventListener("submit", (event) => {
    sendPlanChat(event).catch((error) => setStatus(error.message));
  });
}


function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
