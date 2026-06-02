const numberFormat = new Intl.NumberFormat("ko-KR");

function $(selector) {
  return document.querySelector(selector);
}

function pct(value) {
  return `${Number(value || 0).toFixed(1).replace(".0", "")}%`;
}

function count(value) {
  return numberFormat.format(Number(value || 0));
}

function formatDate(iso) {
  if (!iso) {
    return "-";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderBars(target, rows, options = {}) {
  const maxPercent = Math.max(1, ...rows.map((row) => Number(row.percent || 0)));
  target.innerHTML = rows.map((row) => {
    const value = options.useRawValue ? Number(row.value || 0) : Number(row.percent || 0);
    const width = options.scaleToMax ? (value / maxPercent) * 100 : value;
    const subValue = options.completedLabel && Number.isFinite(Number(row.completed))
      ? ` · 완료 ${count(row.completed)}`
      : "";
    const valueLabel = options.valueSuffix
      ? `${row.displayValue ?? value}${options.valueSuffix}`
      : `${count(row.count)}명 · ${pct(row.percent)}${subValue}`;
    return `
      <div class="bar-row">
        <span class="bar-label">${row.label}</span>
        <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="--value:${Math.max(0, Math.min(100, width))}%"></span></span>
        <span class="bar-value">${valueLabel}</span>
      </div>
    `;
  }).join("");
}

function renderMethod(data) {
  $("#analysis-method").innerHTML = data.reactivity.analysisMethod
    .map((item) => `<li>${item}</li>`)
    .join("");
  $("#cross-summary").textContent = data.reactivity.interpretation.summary;
}

function renderCorrelation(correlation) {
  const formatValue = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(3) : "-";
  const termTooltip = (term) => {
    const content = {
      pearson: {
        label: "Pearson r",
        title: "Pearson r",
        description: "두 점수가 직선처럼 같이 움직이는지 보는 숫자예요. 한쪽이 높아질 때 다른 쪽도 높아지면 +, 반대로 움직이면 -가 됩니다.",
        formula: "r = cov(X,Y) / (sd(X) x sd(Y))"
      },
      spearman: {
        label: "Spearman rho",
        title: "Spearman rho",
        description: "점수 자체보다 순위를 비교해요. 자기보고 순위가 높은 사람이 반응성 순위도 높은지 보는 방법입니다.",
        formula: "rho = Pearson r(rank X, rank Y)"
      },
      kendall: {
        label: "Kendall tau-b",
        title: "Kendall tau-b",
        description: "두 사람씩 짝지어 비교해요. 두 점수의 순서가 같은 방향인 짝이 많은지, 반대 방향인 짝이 많은지 봅니다.",
        formula: "tau-b = (C - D) / sqrt((C + D + Tx)(C + D + Ty))"
      }
    }[term];
    return `
      <button class="term-tooltip" type="button" aria-label="${content.title} 설명">
        ${content.label}
        <span class="tooltip-panel" role="tooltip">
          <strong>${content.title}</strong>
          ${content.description}
          <code>${content.formula}</code>
        </span>
      </button>
    `;
  };
  const strongestLabel = correlation?.strongest?.label || "";
  const rows = correlation?.domainMatrix || [];
  $("#correlation-matrix").innerHTML = rows.map((row) => `
    <div class="correlation-card ${row.label === strongestLabel ? "highlight" : ""}">
      <span>${row.label}</span>
      <strong>${row.interpretation || "계산 불가"}</strong>
      <div class="correlation-values">
        <div>${termTooltip("pearson")}<b>${formatValue(row.pearson?.r)}</b></div>
        <div>${termTooltip("spearman")}<b>${formatValue(row.spearman?.rho)}</b></div>
        <div>${termTooltip("kendall")}<b>${formatValue(row.kendall?.tau)}</b></div>
      </div>
      <p>n=${count(row.n)} · ${row.label === strongestLabel ? "현재 데이터에서 가장 큰 순위상관" : "탐색적 참고 지표"}</p>
    </div>
  `).join("") + `
    <div class="correlation-card">
      <span>해석 주의</span>
      <strong>탐색적</strong>
      <p>${correlation?.note || "표본 수가 작아 참고 지표로만 해석해야 합니다."}</p>
    </div>
  `;
}

function renderDonut(alignment) {
  const rows = [
    { key: "일치", label: "일치", color: "", count: alignment["일치"] || 0 },
    { key: "불일치", label: "불일치", color: "amber", count: alignment["불일치"] || 0 },
    { key: "혼합", label: "혼합", color: "green", count: alignment["혼합"] || 0 }
  ];
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  const first = (rows[0].count / total) * 360;
  const second = first + (rows[1].count / total) * 360;

  $("#alignment-chart").innerHTML = `
    <div class="donut" style="--a:${first}deg;--b:${second}deg" aria-hidden="true"></div>
    <div class="legend">
      ${rows.map((row) => `
        <div class="legend-row">
          <span class="legend-key"><span class="swatch ${row.color}"></span>${row.label}</span>
          <strong>${count(row.count)}명 · ${pct((row.count / total) * 100)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCrossTable(crossTable) {
  const subjective = ["부주의", "충동성"];
  const objective = ["부주의", "충동성"];
  const cells = [
    `<div class="cross-cell header">자가보고 \\ 반응성</div>`,
    ...objective.map((label) => `<div class="cross-cell header">${label}</div>`)
  ];
  for (const row of subjective) {
    cells.push(`<div class="cross-cell header">${row}</div>`);
    for (const col of objective) {
      cells.push(`
        <div class="cross-cell">
          <span>${row} -> ${col}</span>
          <strong>${count(crossTable?.[row]?.[col] || 0)}명</strong>
        </div>
      `);
    }
  }
  $("#cross-table").innerHTML = cells.join("");
}

function renderScatterSvg(points, xKey, yKey, xLabel, yLabel) {
  const left = 54;
  const right = 20;
  const top = 20;
  const bottom = 48;
  const width = 520;
  const height = 320;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (value) => left + (Number(value || 0) / 100) * plotWidth;
  const y = (value) => top + plotHeight - (Number(value || 0) / 100) * plotHeight;

  const grid = [0, 25, 50, 75, 100].map((tick) => `
    <line class="grid-line" x1="${x(tick)}" y1="${top}" x2="${x(tick)}" y2="${top + plotHeight}"></line>
    <line class="grid-line" x1="${left}" y1="${y(tick)}" x2="${left + plotWidth}" y2="${y(tick)}"></line>
    <text class="axis-label" x="${x(tick)}" y="${height - 20}" text-anchor="middle">${tick}</text>
    <text class="axis-label" x="42" y="${y(tick) + 4}" text-anchor="end">${tick}</text>
  `).join("");

  const circles = points.map((point) => {
    const cx = x(point[xKey]);
    const cy = y(point[yKey]);
    const rawObjectiveDetail = Number.isFinite(Number(point.rawObjectiveBurden))
      ? `, 원래 수행과제 부담 점수 ${point.rawObjectiveBurden}`
      : "";
    return `
      <g class="scatter-point-group">
        <circle class="scatter-point" cx="${cx}" cy="${cy}" r="7">
          <title>${point.label}번: ${xLabel} ${point[xKey]}, ${yLabel} ${point[yKey]}${rawObjectiveDetail}</title>
        </circle>
        <text class="scatter-point-label" x="${cx}" y="${cy + 4}" text-anchor="middle">${point.label}</text>
      </g>
    `;
  }).join("");

  return `
    ${grid}
    <line class="axis" x1="${left}" y1="${top + plotHeight}" x2="${left + plotWidth}" y2="${top + plotHeight}"></line>
    <line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}"></line>
    <text class="axis-label" x="${left + plotWidth / 2}" y="${height - 2}" text-anchor="middle">${xLabel}</text>
    <text class="axis-label" x="14" y="${top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 14 ${top + plotHeight / 2})">${yLabel}</text>
    ${circles}
  `;
}

function renderPatternScatter(points) {
  const target = $("#pattern-scatter");
  if (!points?.length) {
    target.innerHTML = `
      <text class="empty-chart-label" x="260" y="160" text-anchor="middle">수행과제까지 완료한 데이터가 아직 없습니다.</text>
    `;
    return;
  }

  const objectiveValues = points
    .map((point) => Number(point.objectiveBurden))
    .filter(Number.isFinite);
  const minObjective = Math.min(...objectiveValues);
  const maxObjective = Math.max(...objectiveValues);
  const objectiveRange = maxObjective - minObjective;
  const spreadPoints = points.map((point) => {
    const rawObjectiveBurden = Number(point.rawObjectiveBurden ?? point.objectiveBurden);
    return {
      ...point,
      rawObjectiveBurden,
      objectiveBurden: objectiveRange
        ? Number((((Number(point.objectiveBurden) - minObjective) / objectiveRange) * 100).toFixed(1))
        : 50
    };
  });

  target.innerHTML = renderScatterSvg(
    spreadPoints,
    "objectiveBurden",
    "subjectiveBurden",
    "수행과제 부담 점수",
    "설문조사 부담 점수"
  );
}

function renderDomainScatters(points, correlations) {
  const configs = correlations?.domainMatrix || [];
  const labelMap = {
    subjectiveInattention: "자가보고 부주의 부담",
    subjectiveImpulsivity: "자가보고 충동성 부담",
    reactivityInattention: "신호탐지 안정 점수",
    reactivityImpulsivity: "Go/No-Go 안정 점수"
  };
  $("#domain-scatter-grid").innerHTML = configs.map((config) => `
    <div class="mini-scatter">
      <h4>${config.label}</h4>
      <p class="mini-meta">Pearson ${Number(config.pearson?.r).toFixed(3)} · Spearman ${Number(config.spearman?.rho).toFixed(3)}</p>
      <svg viewBox="0 0 520 320" role="img" aria-label="${config.label} 산점도">
        ${renderScatterSvg(points, config.xKey, config.yKey, labelMap[config.xKey] || config.xKey, labelMap[config.yKey] || config.yKey)}
      </svg>
    </div>
  `).join("");
}

function render(data) {
  $("#generated-at").textContent = `생성 ${formatDate(data.generatedAt)}`;
  $("#total-users").textContent = `${count(data.totals.totalUsers)}명`;
  $("#total-records").textContent = `old 제외 기록 ${count(data.totals.totalRecords)}건`;
  $("#returning-rate").textContent = pct(data.totals.returningRate);
  $("#returning-users").textContent = `재방문 이용자 ${count(data.totals.returningUsers)}명`;
  $("#completed-users").textContent = `${count(data.reactivity.completedUsers)}명`;

  renderBars($("#stage-bars"), data.progress.stages);
  renderBars($("#reactivity-progress-bars"), data.progress.reactivityInProgress || []);
  renderBars($("#survey-bars"), data.progress.surveySelection, { completedLabel: true });
  renderPatternScatter(data.reactivity.scatter);
  renderMethod(data);
  renderCorrelation(data.reactivity.correlation);
  renderDonut(data.reactivity.interpretation.alignment);
  renderCrossTable(data.reactivity.interpretation.crossTable);
  renderDomainScatters(data.reactivity.domainPoints, data.reactivity.correlation);

  $("#filter-note").textContent = `필터: ${data.filters.oldCutoff} 이전 생성 기록 및 old 표시 기록 ${count(data.filters.oldExcludedRecords)}건 제외. 반응성 교차분석에서는 ${data.filters.reactivityExcludedIds.join(", ")} 자료를 추가 제외했습니다.`;
}

async function load() {
  try {
    const response = await fetch("/api/analysis", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`분석 API 오류: ${response.status}`);
    }
    render(await response.json());
  } catch (error) {
    document.querySelector(".analysis-shell").innerHTML = `<div class="error">${error.message}</div>`;
  }
}

load();
