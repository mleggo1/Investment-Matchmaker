/**
 * Canonical ETF metric helpers shared by the ETF Dashboard and Investment Educator.
 * Storage convention: percent points (0.04 means 0.04%, 12.96 means 12.96%).
 * Missing values are null. Never coerce missing/unavailable metrics to 0.
 */

export const PERCENT_POINTS_UNIT = "percent_points";
export const UNAVAILABLE_DISPLAY = "—";

export const METRIC_DEFINITIONS = {
  managementFee: {
    id: "management_fee_or_management_fees_and_costs",
    unit: PERCENT_POINTS_UNIT,
    displayDecimals: 2,
    missingPolicy: "null_not_zero",
  },
  return5y: {
    id: "annualised_nav_total_return",
    periodYears: 5,
    includesReinvestedDistributions: true,
    netOfFundFees: true,
    basis: "NAV",
    unit: PERCENT_POINTS_UNIT,
    displayDecimals: 2,
    missingPolicy: "null_not_zero",
  },
  yield: {
    id: "trailing_12_month_distribution_yield",
    unit: PERCENT_POINTS_UNIT,
    displayDecimals: 2,
    missingPolicy: "null_not_zero",
  },
};

export const FRESHNESS_RULES = {
  managementFeeMaxAgeDays: 90,
  returnMaxAgeDays: 45,
  yieldMaxAgeDays: 45,
  datasetRetrievedMaxAgeDays: 45,
};

export const LOG_CODES = {
  VALIDATION_FAILURE: "etf-canonical-validation-failure",
  STALE_METRIC: "etf-canonical-stale-metric",
  REFRESH_REJECTED: "etf-canonical-refresh-rejected",
  SOURCE_CONFLICT: "etf-canonical-source-conflict",
  IDENTITY_MISMATCH: "etf-canonical-identity-mismatch",
};

export function logCanonicalIssue(code, details) {
  const payload = { code, ...details, at: new Date().toISOString() };
  console.warn(`[${code}]`, payload);
  return payload;
}

export function percentPointsToDecimal(percentPoints) {
  if (percentPoints == null) return null;
  if (typeof percentPoints !== "number" || !Number.isFinite(percentPoints)) {
    throw new Error("percentPointsToDecimal requires a finite number or null");
  }
  return percentPoints / 100;
}

export function decimalToPercentPoints(decimal) {
  if (decimal == null) return null;
  if (typeof decimal !== "number" || !Number.isFinite(decimal)) {
    throw new Error("decimalToPercentPoints requires a finite number or null");
  }
  return decimal * 100;
}

export function formatPercentPoints(percentPoints, decimals = 2) {
  if (percentPoints == null) return UNAVAILABLE_DISPLAY;
  if (typeof percentPoints !== "number" || !Number.isFinite(percentPoints)) {
    return UNAVAILABLE_DISPLAY;
  }
  return `${percentPoints.toFixed(decimals)}%`;
}

export function canonicalIdentityKey({ exchange, ticker }) {
  if (!exchange || !ticker) {
    throw new Error("canonicalIdentityKey requires exchange and ticker");
  }
  return `${String(exchange).toUpperCase()}:${String(ticker).toUpperCase()}`;
}

function parseISODateOnly(value) {
  if (!value || typeof value !== "string") return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function ageInDays(asOfDate, relativeTo = new Date()) {
  const asOf = parseISODateOnly(asOfDate);
  if (!asOf) return Number.POSITIVE_INFINITY;
  const rel = relativeTo instanceof Date ? relativeTo : parseISODateOnly(relativeTo);
  if (!rel || Number.isNaN(rel.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((rel.getTime() - asOf.getTime()) / 86_400_000);
}

export function isStale(asOfDate, maxAgeDays, relativeTo = new Date()) {
  if (asOfDate == null) return true;
  return ageInDays(asOfDate, relativeTo) > maxAgeDays;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function assertPercentPoints(value, label, { allowNull, min, max, allowZero }) {
  if (value == null) {
    if (allowNull) return;
    throw new Error(`${label} is missing`);
  }
  if (!isFiniteNumber(value)) {
    throw new Error(`${label} is not a finite number`);
  }
  if (!allowZero && value === 0) {
    throw new Error(`${label} is zero without verifiedZero`);
  }
  if (value < min || value > max) {
    throw new Error(`${label} ${value} is outside ${min}–${max} percent points`);
  }
}

export function validateInstrument(instrument, { datasetVersion } = {}) {
  const errors = [];
  const push = (message) => errors.push(message);

  if (!instrument || typeof instrument !== "object") {
    return { ok: false, errors: ["instrument is not an object"] };
  }

  if (!instrument.id || !instrument.exchange || !instrument.ticker) {
    push("identity requires id, exchange and ticker");
  } else {
    const expectedId = canonicalIdentityKey(instrument);
    if (instrument.id !== expectedId) {
      push(`id ${instrument.id} does not match ${expectedId}`);
    }
  }

  if (!instrument.fundName) push("fundName is required");
  if (!instrument.currency) push("currency is required");
  if (!instrument.issuer) push("issuer is required");
  if (!instrument.domicile) push("domicile is required");
  if (typeof instrument.hedged !== "boolean") push("hedged must be boolean");
  if (!instrument.distributionPolicy) push("distributionPolicy is required");

  const fee = instrument.managementFee;
  if (!fee) {
    push("managementFee block is required");
  } else {
    try {
      assertPercentPoints(fee.percentPoints, "managementFee.percentPoints", {
        allowNull: fee.status === "not_applicable" || fee.status === "unavailable",
        min: 0.01,
        max: 3,
        allowZero: Boolean(fee.verifiedZero),
      });
    } catch (err) {
      push(err.message);
    }
    if (fee.percentPoints != null && fee.unit !== PERCENT_POINTS_UNIT) {
      push("managementFee.unit must be percent_points");
    }
    if (fee.status === "verified" && !fee.sourceUrl) {
      push("verified managementFee requires sourceUrl");
    }
  }

  const ret = instrument.return5y;
  if (!ret) {
    push("return5y block is required");
  } else {
    try {
      assertPercentPoints(ret.percentPoints, "return5y.percentPoints", {
        allowNull: ret.status === "unavailable" || ret.status === "insufficient_history",
        min: -50,
        max: 50,
        allowZero: Boolean(ret.verifiedZero),
      });
    } catch (err) {
      push(err.message);
    }
    if (ret.percentPoints != null) {
      if (ret.methodology !== METRIC_DEFINITIONS.return5y.id) {
        push("return5y.methodology must be annualised_nav_total_return");
      }
      if (ret.annualised !== true) push("return5y.annualised must be true when a value is present");
      if (ret.includesReinvestedDistributions !== true) {
        push("return5y must include reinvested distributions");
      }
      if (ret.netOfFundFees !== true) push("return5y must be net of fund fees");
    }
    if (ret.status === "insufficient_history" && ret.percentPoints != null) {
      push("insufficient_history return5y must be null");
    }
  }

  const yld = instrument.yield;
  if (!yld) {
    push("yield block is required");
  } else {
    try {
      assertPercentPoints(yld.percentPoints, "yield.percentPoints", {
        allowNull: yld.status === "unavailable" || yld.status === "not_applicable",
        min: 0,
        max: 20,
        allowZero: Boolean(yld.verifiedZero),
      });
    } catch (err) {
      push(err.message);
    }
    if (yld.percentPoints === 0 && !yld.verifiedZero) {
      push("yield of 0 requires verifiedZero");
    }
  }

  if (datasetVersion && instrument.datasetVersion && instrument.datasetVersion !== datasetVersion) {
    push(`instrument datasetVersion ${instrument.datasetVersion} != dataset ${datasetVersion}`);
  }

  if (errors.length) {
    logCanonicalIssue(LOG_CODES.VALIDATION_FAILURE, {
      id: instrument.id,
      errors,
    });
  }

  return { ok: errors.length === 0, errors };
}

export function validateDataset(dataset, { now } = {}) {
  const errors = [];
  if (!dataset?.datasetVersion) errors.push("datasetVersion is required");
  if (!dataset?.retrievedAt) errors.push("retrievedAt is required");
  if (!Array.isArray(dataset?.instruments) || dataset.instruments.length === 0) {
    errors.push("instruments[] is required");
  }

  const ids = new Set();
  const tickerExchange = new Set();
  for (const instrument of dataset?.instruments || []) {
    const result = validateInstrument(instrument, { datasetVersion: dataset.datasetVersion });
    if (!result.ok) errors.push(`${instrument?.id || "?"}: ${result.errors.join("; ")}`);
    if (instrument?.id) {
      if (ids.has(instrument.id)) errors.push(`duplicate id ${instrument.id}`);
      ids.add(instrument.id);
    }
    if (instrument?.exchange && instrument?.ticker) {
      const key = canonicalIdentityKey(instrument);
      if (tickerExchange.has(key)) errors.push(`duplicate exchange+ticker ${key}`);
      tickerExchange.add(key);
    }
  }

  if (dataset?.retrievedAt && isStale(dataset.retrievedAt, FRESHNESS_RULES.datasetRetrievedMaxAgeDays, now)) {
    const message = `dataset retrievedAt ${dataset.retrievedAt} is stale`;
    errors.push(message);
    logCanonicalIssue(LOG_CODES.STALE_METRIC, { field: "retrievedAt", asOf: dataset.retrievedAt });
  }

  for (const instrument of dataset?.instruments || []) {
    const fee = instrument.managementFee;
    if (fee?.status === "verified") {
      const feeAsOf = fee.retrievedAt || fee.asOf;
      if (isStale(feeAsOf, FRESHNESS_RULES.managementFeeMaxAgeDays, now)) {
        errors.push(`${instrument.id} managementFee is stale (${feeAsOf})`);
        logCanonicalIssue(LOG_CODES.STALE_METRIC, { id: instrument.id, field: "managementFee", asOf: feeAsOf });
      }
    }
    if (instrument.return5y?.status === "verified") {
      if (isStale(instrument.return5y.asOf, FRESHNESS_RULES.returnMaxAgeDays, now)) {
        errors.push(`${instrument.id} return5y is stale (${instrument.return5y.asOf})`);
        logCanonicalIssue(LOG_CODES.STALE_METRIC, {
          id: instrument.id,
          field: "return5y",
          asOf: instrument.return5y.asOf,
        });
      }
    }
    if (instrument.yield?.status === "verified") {
      if (isStale(instrument.yield.asOf, FRESHNESS_RULES.yieldMaxAgeDays, now)) {
        errors.push(`${instrument.id} yield is stale (${instrument.yield.asOf})`);
        logCanonicalIssue(LOG_CODES.STALE_METRIC, { id: instrument.id, field: "yield", asOf: instrument.yield.asOf });
      }
    }
  }

  if (errors.length) {
    logCanonicalIssue(LOG_CODES.VALIDATION_FAILURE, { errors });
  }

  return { ok: errors.length === 0, errors };
}

export function rejectBrokenRefresh(previous, incoming, fieldPath) {
  const prevVal = previous?.percentPoints;
  const nextVal = incoming?.percentPoints;
  const reasons = [];

  if (incoming == null) reasons.push("incoming metric block is null");
  if (nextVal == null && prevVal != null && previous?.status === "verified") {
    reasons.push("refusing to overwrite verified value with null");
  }
  if (nextVal === 0 && !incoming?.verifiedZero && prevVal != null && prevVal !== 0) {
    reasons.push("refusing to overwrite verified non-zero with unverified zero");
  }
  if (typeof nextVal === "number" && !Number.isFinite(nextVal)) {
    reasons.push("incoming value is not finite");
  }

  if (reasons.length) {
    logCanonicalIssue(LOG_CODES.REFRESH_REJECTED, { fieldPath, reasons, previous: prevVal, incoming: nextVal });
    return { accepted: false, value: previous, reasons };
  }
  return { accepted: true, value: incoming, reasons: [] };
}

export function mergeInstrumentRefresh(previous, incoming) {
  if (!previous) return { instrument: incoming, rejected: [] };
  if (!incoming) {
    logCanonicalIssue(LOG_CODES.REFRESH_REJECTED, { id: previous.id, reasons: ["incoming instrument missing"] });
    return { instrument: previous, rejected: ["incoming instrument missing"] };
  }
  if (previous.id !== incoming.id) {
    logCanonicalIssue(LOG_CODES.IDENTITY_MISMATCH, { previous: previous.id, incoming: incoming.id });
    throw new Error(`Cannot merge ${incoming.id} onto ${previous.id}`);
  }

  const rejected = [];
  const next = { ...previous, ...incoming };
  for (const field of ["managementFee", "return5y", "yield"]) {
    const result = rejectBrokenRefresh(previous[field], incoming[field], `${previous.id}.${field}`);
    if (!result.accepted) {
      next[field] = previous[field];
      rejected.push(...result.reasons.map((reason) => `${field}: ${reason}`));
    } else {
      next[field] = incoming[field];
    }
  }
  return { instrument: next, rejected };
}

export function getInstrumentById(dataset, id) {
  return dataset.instruments.find((item) => item.id === id) || null;
}

export function getInstrumentByExchangeTicker(dataset, exchange, ticker) {
  const id = canonicalIdentityKey({ exchange, ticker });
  return getInstrumentById(dataset, id);
}

export function listSharedInstruments(dataset) {
  return dataset.instruments.filter((item) => (item.apps || []).includes("dashboard") && (item.apps || []).includes("educator"));
}

export function getDashboardEtfConfig(dataset) {
  return dataset.instruments
    .filter((item) => (item.apps || []).includes("dashboard"))
    .map((item) => ({
      symbol: item.dashboardSymbol,
      name: item.fundName,
      group: item.group,
    }));
}

function formatPeriod(percentPoints) {
  return formatPercentPoints(percentPoints, METRIC_DEFINITIONS.return5y.displayDecimals);
}

export function getDashboardMetadataMap(dataset) {
  const map = {};
  dataset.instruments
    .filter((item) => (item.apps || []).includes("dashboard"))
    .forEach((item) => {
      const feeDisplay =
        item.managementFee.status === "not_applicable"
          ? "N/A"
          : formatPercentPoints(item.managementFee.percentPoints, 2);
      const yieldDisplay =
        item.yield.displayOverride ||
        (item.yield.status === "not_applicable"
          ? "N/A"
          : formatPercentPoints(item.yield.percentPoints, 2));

      map[item.dashboardSymbol] = {
        description: item.description,
        category: item.category,
        indexTracked: item.indexTracked,
        strategy: item.strategy,
        holdings: item.holdings || [],
        mer: feeDisplay,
        dividendYield: yieldDisplay,
        distributionFrequency: item.distributionFrequency,
        performance: {
          "1Y": formatPeriod(item.return1y?.percentPoints),
          "3Y": formatPeriod(item.return3y?.percentPoints),
          "5Y": formatPeriod(item.return5y?.percentPoints),
          "10Y": formatPeriod(item.return10y?.percentPoints),
        },
        performanceRaw: {
          y1: item.return1y?.percentPoints ?? null,
          y3: item.return3y?.percentPoints ?? null,
          y5: item.return5y?.percentPoints ?? null,
          y10: item.return10y?.percentPoints ?? null,
        },
        goodFor: item.goodFor,
        holdingsAsOf: item.holdingsAsOf,
        holdingsSource: item.holdingsSource,
        canonicalId: item.id,
        datasetVersion: dataset.datasetVersion,
        metricDefinitions: dataset.metricDefinitions,
        asOf: {
          managementFee: item.managementFee.asOf,
          return5y: item.return5y.asOf,
          yield: item.yield.asOf,
        },
      };
    });
  return map;
}

export function getEducatorEtfs(dataset) {
  return dataset.instruments
    .filter((item) => (item.apps || []).includes("educator"))
    .map((item) => ({
      ticker: item.ticker,
      canonicalId: item.id,
      exchange: item.exchange,
      name: item.fundName,
      sector: item.educatorSector,
      mer: item.managementFee.percentPoints,
      return_5y: percentPointsToDecimal(item.return5y.percentPoints),
      yield: percentPointsToDecimal(item.yield.percentPoints),
      volatility: item.educatorVolatility,
      risk_band: item.educatorRiskBand,
      datasetVersion: dataset.datasetVersion,
      currency: item.currency,
      isin: item.isin,
    }));
}

export function formatMerDisplay(merPercentPoints) {
  return formatPercentPoints(merPercentPoints, 2);
}

export function formatReturnDisplay(returnDecimalOrNull) {
  if (returnDecimalOrNull == null) return UNAVAILABLE_DISPLAY;
  return formatPercentPoints(decimalToPercentPoints(returnDecimalOrNull), 2);
}

export function formatYieldDisplay(yieldDecimalOrNull) {
  if (yieldDecimalOrNull == null) return UNAVAILABLE_DISPLAY;
  return formatPercentPoints(decimalToPercentPoints(yieldDecimalOrNull), 2);
}

export function educatorViewOfInstrument(instrument, datasetVersion) {
  return {
    canonicalId: instrument.id,
    exchange: instrument.exchange,
    ticker: instrument.ticker,
    isin: instrument.isin ?? null,
    fundName: instrument.fundName,
    currency: instrument.currency,
    managementFeePercentPoints: instrument.managementFee.percentPoints,
    return5yPercentPoints: instrument.return5y.percentPoints,
    yieldPercentPoints: instrument.yield.percentPoints,
    managementFeeDisplay: formatMerDisplay(instrument.managementFee.percentPoints),
    return5yDisplay: formatPercentPoints(instrument.return5y.percentPoints, 2),
    yieldDisplay:
      instrument.yield.status === "not_applicable"
        ? "N/A"
        : formatPercentPoints(instrument.yield.percentPoints, 2),
    metricDefinitions: METRIC_DEFINITIONS,
    asOf: {
      managementFee: instrument.managementFee.asOf ?? null,
      return5y: instrument.return5y.asOf ?? null,
      yield: instrument.yield.asOf ?? null,
    },
    datasetVersion,
  };
}

export function dashboardViewOfInstrument(instrument, datasetVersion) {
  const metadata = getDashboardMetadataMap({ datasetVersion, instruments: [instrument] })[
    instrument.dashboardSymbol
  ];
  return {
    canonicalId: instrument.id,
    exchange: instrument.exchange,
    ticker: instrument.ticker,
    isin: instrument.isin ?? null,
    fundName: instrument.fundName,
    currency: instrument.currency,
    managementFeePercentPoints: instrument.managementFee.percentPoints,
    return5yPercentPoints: instrument.return5y.percentPoints,
    yieldPercentPoints: instrument.yield.percentPoints,
    managementFeeDisplay: metadata.mer,
    return5yDisplay: metadata.performance["5Y"],
    yieldDisplay: metadata.dividendYield,
    metricDefinitions: METRIC_DEFINITIONS,
    asOf: metadata.asOf,
    datasetVersion,
    raw: {
      mer: instrument.managementFee.percentPoints,
      return5y: instrument.return5y.percentPoints,
      yield: instrument.yield.percentPoints,
    },
    calculated: {
      return5y: instrument.return5y.percentPoints,
    },
    formatted: {
      mer: metadata.mer,
      return5y: metadata.performance["5Y"],
      yield: metadata.dividendYield,
    },
  };
}

export function reconcileSharedInstruments(dataset) {
  const mismatches = [];
  for (const instrument of listSharedInstruments(dataset)) {
    const educator = educatorViewOfInstrument(instrument, dataset.datasetVersion);
    const dashboard = dashboardViewOfInstrument(instrument, dataset.datasetVersion);
    const fields = [
      "canonicalId",
      "exchange",
      "ticker",
      "isin",
      "fundName",
      "currency",
      "managementFeePercentPoints",
      "return5yPercentPoints",
      "yieldPercentPoints",
      "managementFeeDisplay",
      "return5yDisplay",
      "yieldDisplay",
      "datasetVersion",
    ];
    for (const field of fields) {
      if (educator[field] !== dashboard[field]) {
        mismatches.push({
          id: instrument.id,
          field,
          educator: educator[field],
          dashboard: dashboard[field],
        });
      }
    }
    if (educator.asOf.managementFee !== dashboard.asOf.managementFee) {
      mismatches.push({
        id: instrument.id,
        field: "asOf.managementFee",
        educator: educator.asOf.managementFee,
        dashboard: dashboard.asOf.managementFee,
      });
    }
    if (educator.asOf.return5y !== dashboard.asOf.return5y) {
      mismatches.push({
        id: instrument.id,
        field: "asOf.return5y",
        educator: educator.asOf.return5y,
        dashboard: dashboard.asOf.return5y,
      });
    }
    if (educator.asOf.yield !== dashboard.asOf.yield) {
      mismatches.push({
        id: instrument.id,
        field: "asOf.yield",
        educator: educator.asOf.yield,
        dashboard: dashboard.asOf.yield,
      });
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}
