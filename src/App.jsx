import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import "./App.css";

// ---------------------------------------------
// Investment Educator — educational examples only (not advice)
// ---------------------------------------------

const REQUIRED_DISCLAIMER =
  "This tool provides factual information and education only. It does not provide financial advice, personal advice, general advice, or product recommendations. It does not consider your personal objectives, financial situation, or needs. You should make your own decisions and consider seeking advice from a licensed financial adviser before acting.";

const SURVEY_DISCLAIMER =
  "This tool is for educational purposes only. It does not provide financial advice, personal advice, general advice, or product recommendations.";

const ETF_ILLUSTRATIVE_DISCLAIMER =
  "Any ETF mix shown is an illustrative education example only. It is not a recommendation and should not be treated as financial advice.";

const PATHWAY_LABEL = {
  Aggressive: "Illustrative growth-oriented ETF example",
  Balanced: "Illustrative balanced ETF example",
  Conservative: "Illustrative stability-oriented ETF example",
};

function pathwayLabel(internalName) {
  return PATHWAY_LABEL[internalName] || internalName;
}

// ---------- Helpers: currency & parsing (robust) ----------
function toNumberSafe(n, fallback = 0) {
  const num = typeof n === "number" ? n : Number(n);
  return Number.isFinite(num) ? num : fallback;
}

function currency(n) {
  const val = toNumberSafe(n, 0);
  try {
    return val.toLocaleString(undefined, {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    });
  } catch {
    return `$${Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  }
}

function parseCurrency(input) {
  const raw = (input || "").toString().replace(/[^0-9.]/g, "");
  const num = parseFloat(raw);
  return Number.isFinite(num) ? num : 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
const percent = (n, dp = 1) => `${(n * 100).toFixed(dp)}%`;

// ---------- Static ETF dataset ----------
const ETFs = [
  { ticker: "IVV", name: "iShares S&P 500 ETF", sector: "US Equities", mer: 0.04, return_5y: 0.108, volatility: 0.14, yield: 0.013, risk_band: "growth" },
  { ticker: "NDQ", name: "BetaShares NASDAQ 100 ETF", sector: "Tech Growth", mer: 0.48, return_5y: 0.135, volatility: 0.18, yield: 0.009, risk_band: "high" },
  { ticker: "RBTZ", name: "BetaShares Global Robotics ETF", sector: "Automation", mer: 0.57, return_5y: 0.125, volatility: 0.19, yield: 0.006, risk_band: "high" },
  { ticker: "CRYP", name: "BetaShares Crypto Innovators ETF", sector: "Crypto & Blockchain", mer: 0.99, return_5y: 0.23, volatility: 0.42, yield: 0.0, risk_band: "speculative" },
  { ticker: "VHY", name: "Vanguard High Yield ETF", sector: "Aussie Dividends", mer: 0.25, return_5y: 0.085, volatility: 0.12, yield: 0.045, risk_band: "income" },
  { ticker: "VAP", name: "Vanguard Australian Property ETF", sector: "A-REITs", mer: 0.23, return_5y: 0.063, volatility: 0.16, yield: 0.045, risk_band: "income" },
  { ticker: "IOO", name: "iShares Global 100 ETF", sector: "Global Blue-Chip", mer: 0.40, return_5y: 0.095, volatility: 0.13, yield: 0.021, risk_band: "core" },
  { ticker: "VAF", name: "Vanguard Aus Fixed Interest", sector: "Bonds (AU)", mer: 0.20, return_5y: 0.02, volatility: 0.05, yield: 0.028, risk_band: "defensive" },
];

// ---------- Model Portfolios ----------
const MODELS = {
  Aggressive: {
    IVV: 35, NDQ: 25, CRYP: 15, RBTZ: 15, VHY: 10,
    notes: "General educational example only: a sample mix illustrating diversification and how different asset types can fit together. This may be worth learning more about — it is not a suggestion to buy, sell, or hold anything. Consider speaking with a licensed financial adviser before making investment decisions.",
  },
  Balanced: {
    IVV: 30, NDQ: 20, VHY: 20, VAP: 10, IOO: 10, CRYP: 10,
    notes: "General educational example only: a sample mix illustrating diversification and how different asset types can fit together. This may be worth learning more about — it is not a suggestion to buy, sell, or hold anything. Consider speaking with a licensed financial adviser before making investment decisions.",
  },
  Conservative: {
    VHY: 25, VAP: 20, IOO: 20, VAF: 15, IVV: 10, NDQ: 10,
    notes: "General educational example only: a sample mix illustrating diversification and how different asset types can fit together. This may be worth learning more about — it is not a suggestion to buy, sell, or hold anything. Consider speaking with a licensed financial adviser before making investment decisions.",
  },
};

// ---------- Quiz (original intake questions — shapes education pathway only) ----------
const QUIZ = [
  { id: 1, q: "What’s your primary learning goal?", options: [
    { label: "Grow wealth", value: 15, tags: ["growth"] },
    { label: "Build income", value: -5, tags: ["income"] },
    { label: "Protect capital", value: -10, tags: ["defensive"] },
  ]},
  { id: 2, q: "What time horizon do you want the education examples to focus on?", options: [
    { label: "10+ years", value: 15, tags: ["long"] },
    { label: "5–10 years", value: 5, tags: ["medium"] },
    { label: "<5 years", value: -10, tags: ["short"] },
  ]},
  { id: 3, q: "How do you typically react when markets drop 20%? (for learning context)", options: [
    { label: "Buy more", value: 15, tags: ["risk-on"] },
    { label: "Stay calm", value: 5, tags: ["steady"] },
    { label: "Sell", value: -15, tags: ["risk-off"] },
  ]},
  { id: 4, q: "What’s more important to learn about right now?", options: [
    { label: "High growth", value: 12, tags: ["growth"] },
    { label: "Steady returns", value: 0, tags: ["balanced"] },
    { label: "Sleep at night", value: -12, tags: ["defensive"] },
  ]},
  { id: 5, q: "How much investing experience do you have?", options: [
    { label: "Lots", value: 10, tags: ["experience"] },
    { label: "Some", value: 3, tags: ["moderate"] },
    { label: "None", value: -5, tags: ["new"] },
  ]},
  { id: 6, q: "Preferred focus?", options: [
    { label: "Global tech", value: 10, tags: ["tech"] },
    { label: "Dividend income", value: -3, tags: ["income"] },
    { label: "Balanced mix", value: 0, tags: ["balanced"] },
    { label: "Crypto exposure", value: 12, tags: ["crypto"] },
  ]},
  { id: 7, q: "Do you want exposure to property, crypto, or both in the education examples?", options: [
    { label: "Property", value: -1, tags: ["property"] },
    { label: "Crypto", value: 6, tags: ["crypto"] },
    { label: "Both", value: 5, tags: ["property", "crypto"] },
    { label: "Neither", value: 0, tags: ["exclude-property", "exclude-crypto"] },
  ]},
  { id: 8, q: "Annual contribution budget? (helps calibrate education examples only)", options: [
    { label: "50k+", value: 6, tags: ["capacity"] },
    { label: "10–50k", value: 3, tags: ["capacity"] },
    { label: "<10k", value: 0, tags: ["capacity"] },
  ]},
  { id: 9, q: "Do you prefer active tweaking or set-and-forget?", options: [
    { label: "Active tweaking", value: 4, tags: ["active"] },
    { label: "Set-and-forget", value: -2, tags: ["passive"] },
  ]},
  { id: 10, q: "Age range (optional)?", options: [
    { label: "<30", value: 8, tags: ["young"] },
    { label: "30–45", value: 3, tags: ["prime"] },
    { label: "45–60", value: -2, tags: ["mid"] },
    { label: "60+", value: -6, tags: ["senior"] },
  ]},
];

const TICKER_ASSET_GROUP = {
  CRYP: "crypto",
  VAP: "property",
  NDQ: "tech",
  RBTZ: "tech",
};

const ETF_DASHBOARD_URL = "https://etf-dashboards.vercel.app/";

const EXTERNAL_LINK_DISCLAIMER =
  "External links are provided for education and convenience only. They are not recommendations or endorsements.";

const UNANSWERED = -1;

const LEARNING_THEME_MAP = {
  growth: {
    title: "Growth & compounding",
    concepts: ["Broad market ETFs", "Higher-growth / thematic ETFs"],
    why: "You signalled interest in growth-oriented ideas — helpful for learning how markets and long-term compounding are commonly explained.",
  },
  income: {
    title: "Income & cash-flow concepts",
    concepts: ["Dividend-focused ETFs", "Yield and distributions (illustrative only)"],
    why: "Your choices touched on income themes — useful for understanding how yield and cash flow are described in education materials.",
  },
  defensive: {
    title: "Stability & volatility smoothing",
    concepts: ["Defensive assets and bonds", "Cash buffers and diversification"],
    why: "You leaned toward stability-focused narratives — a common education topic when explaining how defensive assets are discussed.",
  },
  tech: {
    title: "Innovation & global tech",
    concepts: ["Tech and innovation ETFs", "Thematic growth examples"],
    why: "You wanted to explore tech-oriented concepts — useful for learning how sector-focused ETFs are often presented in examples.",
  },
  crypto: {
    title: "Crypto & high-volatility themes",
    concepts: ["Crypto-related ETF examples", "Volatility and diversification trade-offs"],
    why: "You asked to see crypto mentioned in examples — helpful for learning how high-volatility assets are described in educational contexts.",
  },
  property: {
    title: "Property (A-REIT) examples",
    concepts: ["Property / A-REIT ETFs", "Income and sector diversification"],
    why: "You indicated interest in property-themed examples — useful for learning how real-estate exposure is often illustrated.",
  },
  long: {
    title: "Long time horizons",
    concepts: ["Compounding over decades", "Broad market exposure examples"],
    why: "You emphasised long-horizon examples — a core education theme for how time and compounding interact in illustrations.",
  },
  short: {
    title: "Shorter time horizons",
    concepts: ["Liquidity and stability concepts", "Defensive asset examples"],
    why: "You focused on shorter-horizon illustrations — helpful for learning how educators discuss liquidity and stability.",
  },
  balanced: {
    title: "Balanced, mixed approaches",
    concepts: ["Multi-asset example mixes", "Diversification across sectors"],
    why: "You preferred a balanced tour — useful for comparing how different asset types appear together in sample mixes.",
  },
  experience: {
    title: "Deeper vocabulary & mechanics",
    concepts: ["Fees (MER)", "Holdings and asset allocation"],
    why: "You are comfortable with investing vocabulary — you may benefit from drilling into holdings, fees, and composition on external education tools.",
  },
  new: {
    title: "Plain-language foundations",
    concepts: ["What ETFs are", "How diversification works"],
    why: "You asked for plain-language learning — start with foundational concepts before diving into detailed product comparisons.",
  },
  moderate: {
    title: "Building on existing knowledge",
    concepts: ["Core ETF mechanics", "Diversification concepts"],
    why: "You have some investing exposure — useful context for layering more detailed education topics.",
  },
  "risk-on": {
    title: "Volatility and long-term perspective",
    concepts: ["Market drawdowns", "Compounding over time"],
    why: "You selected a learning angle focused on downturns and opportunity — a common education theme.",
  },
  steady: {
    title: "Staying the course",
    concepts: ["Behavioural investing concepts", "Long-horizon illustrations"],
    why: "You wanted to explore neutral, steady responses to volatility in educational examples.",
  },
  "risk-off": {
    title: "Capital preservation concepts",
    concepts: ["Defensive assets", "Risk and return trade-offs"],
    why: "You leaned toward capital-preservation learning themes in the survey.",
  },
  capacity: {
    title: "Contribution pacing (education context)",
    concepts: ["Compounding illustrations", "Example portfolio sizes"],
    why: "Your contribution-range answer helps calibrate the scale of illustrative examples only — not advice.",
  },
  active: {
    title: "Hands-on learning style",
    concepts: ["What-if examples", "Comparing illustrative mixes"],
    why: "You prefer active, hands-on education examples in the materials.",
  },
  passive: {
    title: "Set-and-forget concepts",
    concepts: ["Automating contributions", "Long-term consistency"],
    why: "You prefer set-and-forget storylines for learning how consistency is often discussed.",
  },
  young: {
    title: "Early-stage wealth building",
    concepts: ["Time horizon", "Compounding basics"],
    why: "You chose an early-career education chapter for contextual examples.",
  },
  prime: {
    title: "Mid-career wealth education",
    concepts: ["Balanced growth and income themes", "Diversification"],
    why: "You chose a mid-career education chapter for contextual examples.",
  },
  mid: {
    title: "Pre-retirement concepts",
    concepts: ["Income transition themes", "Defensive asset education"],
    why: "You chose a pre-retirement education chapter for contextual examples.",
  },
  senior: {
    title: "Retirement income education",
    concepts: ["Income-focused ETFs", "Stability concepts"],
    why: "You chose a retirement-income education chapter for contextual examples.",
  },
};

function normalizeAnswerIndices(stored) {
  if (!Array.isArray(stored)) {
    return Array(QUIZ.length).fill(UNANSWERED);
  }
  return Array.from({ length: QUIZ.length }, (_, qIdx) => {
    const val = stored[qIdx];
    if (val === null || val === undefined || Number.isNaN(val) || val === UNANSWERED) return UNANSWERED;
    if (Number.isInteger(val) && val >= 0 && val < QUIZ[qIdx].options.length) {
      return val;
    }
    const legacyIdx = QUIZ[qIdx].options.findIndex((o) => o.value === val);
    return legacyIdx >= 0 ? legacyIdx : UNANSWERED;
  });
}

function scoreFromAnswerIndices(answerIndices) {
  let score = 50;
  answerIndices.forEach((optIdx, qIdx) => {
    if (Number.isInteger(optIdx) && optIdx >= 0 && optIdx < QUIZ[qIdx].options.length) {
      score += QUIZ[qIdx].options[optIdx].value;
    }
  });
  return clamp(score, 0, 100);
}

function isValidPathway(pathway) {
  return pathway === "Auto" || Boolean(MODELS[pathway]);
}

function deriveAssetExclusions(answerIndices) {
  const excludedGroups = new Set();
  const q6 = answerIndices[5];
  const q7 = answerIndices[6];

  if (Number.isInteger(q7)) {
    if (q7 === 3) {
      excludedGroups.add("crypto");
      excludedGroups.add("property");
    } else if (q7 === 0) {
      excludedGroups.add("crypto");
    } else if (q7 === 1) {
      excludedGroups.add("property");
    }
  }

  if (Number.isInteger(q6)) {
    if (q6 !== 3) {
      excludedGroups.add("crypto");
    }
    if (q6 === 1) {
      excludedGroups.add("tech");
    }
  }

  if (Number.isInteger(q6) && q6 === 3) {
    excludedGroups.delete("crypto");
  }
  if (Number.isInteger(q7) && (q7 === 1 || q7 === 2)) {
    excludedGroups.delete("crypto");
  }
  if (Number.isInteger(q7) && (q7 === 0 || q7 === 2)) {
    excludedGroups.delete("property");
  }

  const messages = [];
  if (excludedGroups.has("crypto")) {
    messages.push("Crypto excluded based on your survey response.");
  }
  if (excludedGroups.has("property")) {
    messages.push("Property (A-REIT) exposure excluded based on your survey response.");
  }
  if (excludedGroups.has("tech")) {
    messages.push("Thematic / tech ETFs excluded based on your survey response.");
  }

  return { excludedGroups, messages };
}

function applyExclusionsToModel(baseModel, excludedGroups) {
  if (!excludedGroups || excludedGroups.size === 0) {
    return { ...baseModel };
  }

  const result = { notes: baseModel.notes };
  const keepers = [];
  let removedWeight = 0;

  Object.entries(baseModel).forEach(([ticker, weight]) => {
    if (ticker === "notes") return;
    const group = TICKER_ASSET_GROUP[ticker];
    if (group && excludedGroups.has(group)) {
      removedWeight += weight;
      return;
    }
    result[ticker] = weight;
    keepers.push(ticker);
  });

  if (keepers.length === 0) {
    const fallback = { ...MODELS.Conservative, notes: baseModel.notes };
    return applyExclusionsToModel(fallback, new Set());
  }

  const keptTotal = keepers.reduce((sum, ticker) => sum + result[ticker], 0);
  keepers.forEach((ticker) => {
    result[ticker] = Math.round((result[ticker] / keptTotal) * (keptTotal + removedWeight));
  });

  const sum = keepers.reduce((s, ticker) => s + result[ticker], 0);
  if (sum !== 100) {
    result[keepers[0]] += 100 - sum;
  }

  return result;
}

const KNOWLEDGE_LEVELS = ["Experienced learner", "Developing learner", "Foundational learner"];

function buildEducationReport(answerIndices) {
  const selections = QUIZ.map((question, qIdx) => {
    const optIdx = answerIndices[qIdx];
    if (!Number.isInteger(optIdx) || optIdx < 0 || optIdx >= question.options.length) return null;
    const option = question.options[optIdx];
    return {
      question: question.q,
      answer: option.label,
      tags: option.tags,
    };
  }).filter(Boolean);

  const tagWeights = {};
  selections.forEach(({ tags }) => {
    tags.forEach((tag) => {
      if (tag.startsWith("exclude-")) return;
      tagWeights[tag] = (tagWeights[tag] || 0) + 1;
    });
  });

  const rankedTags = Object.entries(tagWeights)
    .filter(([tag]) => LEARNING_THEME_MAP[tag])
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  const themes = rankedTags.map((tag) => ({
    tag,
    ...LEARNING_THEME_MAP[tag],
  }));

  const conceptSet = new Set();
  themes.forEach((theme) => theme.concepts.forEach((c) => conceptSet.add(c)));
  if (conceptSet.size === 0) {
    ["Broad market ETFs", "Dividend-focused ETFs", "Defensive assets and bonds", "Cash buffers and diversification"].forEach((c) => conceptSet.add(c));
  }

  const score = scoreFromAnswerIndices(answerIndices);
  const pathwayHint = pathwayLabel(
    score > 80 ? "Aggressive" : score > 50 ? "Balanced" : "Conservative",
  );

  const q5 = answerIndices[4];
  const knowledgeLevel = Number.isInteger(q5) ? KNOWLEDGE_LEVELS[q5] : "Complete the survey to see your knowledge level";

  const topicsInterested = themes.map((t) => t.title);
  const { messages: topicsExcluded } = deriveAssetExclusions(answerIndices);

  const pathwaySteps = themes.length >= 3
    ? themes.slice(0, 3).map((t) => t.title)
    : [
        themes[0]?.title || "ETF basics & diversification",
        themes[1]?.title || "Asset class comparisons",
        themes[2]?.title || "Fees, holdings & historical context (illustrative)",
      ];

  const profileSummary = selections.length
    ? `Based on your selected learning preferences, this investor education profile summarises your knowledge, interests, and topics to explore — for education only.`
    : "Complete the Investor Education Survey to generate your education profile and learning pathway.";

  return {
    hasSelections: selections.length > 0,
    selections,
    themes,
    concepts: [...conceptSet],
    pathwayHint,
    knowledgeLevel,
    topicsInterested,
    topicsExcluded,
    educationPathway: {
      first: pathwaySteps[0],
      next: pathwaySteps[1],
      later: pathwaySteps[2],
    },
    profileSummary,
    intro: profileSummary,
    closing: "These are education examples only, not recommendations.",
    wealthBridge: selections.length
      ? `Your survey highlighted learning areas such as ${topicsInterested.slice(0, 3).join(", ") || "general investing concepts"}. Wealth Blueprint offers structured investor education — not financial advice.`
      : "Wealth Blueprint offers structured financial education — how wealth is built, how investing works, and how strategies are explained in plain English. Not financial advice.",
  };
}

function EtfEducationalLink({ ticker, className, children, style }) {
  return (
    <a
      href={ETF_DASHBOARD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      title={`Learn more about ${ticker} on the ETF education dashboard (external link, not a recommendation)`}
    >
      {children}
    </a>
  );
}

// ---------- Visual constants ----------
const ACCENT_GRADIENTS = [
  "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  "linear-gradient(135deg, #22C55E 0%, #14B8A6 100%)",
  "linear-gradient(135deg, #EAB308 0%, #FB923C 100%)",
  "linear-gradient(135deg, #EF4444 0%, #F97316 100%)",
  "linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)",
  "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
  "linear-gradient(135deg, #06B6D4 0%, #0EA5E9 100%)",
  "linear-gradient(135deg, #F97316 0%, #FACC15 100%)",
];

const ACCENT_SOLIDS = [
  "#6366F1",
  "#22C55E",
  "#EAB308",
  "#EF4444",
  "#0EA5E9",
  "#8B5CF6",
  "#06B6D4",
  "#F97316",
];

function toChartData(weights) {
  return Object.entries(weights)
    .filter(([key]) => key !== "notes")
    .map(([ticker, weight]) => ({
      name: ticker,
      value: weight,
    }));
}

function getETF(ticker) {
  const e = ETFs.find(e => e.ticker === ticker);
  if (!e) throw new Error(`ETF not found: ${ticker}`);
  return e;
}

function computeMetrics(weights, portfolioValue = 100000) {
  const tickers = Object.keys(weights).filter(k => k !== "notes");
  const wsum = tickers.reduce((s, t) => s + (weights[t] || 0), 0) || 1;

  let expReturn = 0; let feeDrag = 0; let yieldPct = 0; let vol = 0;
  tickers.forEach(t => {
    const w = (weights[t] || 0) / wsum;
    const e = getETF(t);
    expReturn += w * e.return_5y;
    feeDrag += w * (e.mer / 100);
    yieldPct += w * e.yield;
    vol += w * e.volatility;
  });

  const passiveIncome = portfolioValue * yieldPct;
  const tenYear = portfolioValue * Math.pow(1 + expReturn, 10);
  const sectors = new Set(tickers.map(t => getETF(t).sector));
  const diversification = sectors.size / tickers.length;
  return { expReturn, feeDrag, yieldPct, vol, passiveIncome, tenYear, diversification };
}

// ---------- Reusable: PortfolioInput ----------
function PortfolioInput({ value, onChange }) {
  const numeric = toNumberSafe(value, 0);
  const [displayValue, setDisplayValue] = useState(currency(numeric));

  useEffect(() => {
    setDisplayValue(currency(numeric));
  }, [numeric]);

  const handleChange = (e) => {
    const nextNum = parseCurrency(e.target.value);
    setDisplayValue(currency(nextNum));
    if (onChange) onChange(nextNum);
  };

  const digitCount = useMemo(() => displayValue.replace(/[^0-9]/g, "").length, [displayValue]);
  const inputFontSize = useMemo(() => {
    if (digitCount <= 10) return "1.15rem";
    const scaled = 1.15 - (digitCount - 10) * 0.05;
    return `${Math.max(0.75, scaled)}rem`;
  }, [digitCount]);

  return (
    <div className="portfolio-input">
      <input
        type="text"
        inputMode="decimal"
        className="portfolio-input__field"
        value={displayValue}
        onChange={handleChange}
        aria-label="Portfolio size in AUD"
        style={{ fontSize: inputFontSize }}
      />
      <span className="portfolio-input__suffix">AUD</span>
    </div>
  );
}

function AllocationList({ model, pathwayTitle }) {
  const entries = Object.entries(model).filter(([key]) => key !== "notes");

  return (
    <div className="allocation-list">
      {entries.map(([ticker, weight], index) => {
        const etf = getETF(ticker);
        const gradient = ACCENT_GRADIENTS[index % ACCENT_GRADIENTS.length];
        return (
          <article key={ticker} className="allocation-item">
            <header className="allocation-item__header">
              <EtfEducationalLink ticker={ticker} className="allocation-item__badge allocation-item__badge--link" style={{ backgroundImage: gradient }}>
                {ticker}
              </EtfEducationalLink>
              <div className="allocation-item__weight">
                {weight}
                <span className="allocation-item__weight-unit">%</span>
              </div>
            </header>
            <EtfEducationalLink ticker={ticker} className="allocation-item__name allocation-item__name--link">
              {etf.name}
            </EtfEducationalLink>
            <div className="allocation-item__description">
              {ticker} — commonly researched option in this general example only ({pathwayTitle}).{" "}
              <EtfEducationalLink ticker={ticker} className="inline-learn-link">
                Explore holdings &amp; fees (external)
              </EtfEducationalLink>
            </div>
            <div className="allocation-item__meta">
              <span>{etf.sector}</span>
              <span>MER {etf.mer.toFixed(2)}%</span>
            </div>
            <div className="allocation-item__bar">
              <div className="allocation-item__bar-fill" style={{ width: `${weight}%`, backgroundImage: gradient }} />
            </div>
            <footer className="allocation-item__footer">
              <div>5y CAGR {percent(etf.return_5y, 1)} (illustrative)</div>
              <div>Yield {percent(etf.yield, 1)} (illustrative)</div>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

function PortfolioDonut({ data }) {
  return (
    <div className="allocation-donut">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="65%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="transparent"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={ACCENT_SOLIDS[index % ACCENT_SOLIDS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [`${value}%`, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="allocation-donut__center">
        <span>ETF Split</span>
      </div>
    </div>
  );
}

// ---------- Education Gate (ASIC Compliance) ----------
function EducationGate({ children }) {
  const [hasAccepted, setHasAccepted] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  const handleAccept = (event) => {
    event.preventDefault();
    if (checkboxChecked) {
      setHasAccepted(true);
    }
  };

  if (hasAccepted) {
    return children;
  }

  return (
    <div className="education-gate">
      <div className="education-gate__card">
        <h1>GENERAL EDUCATION ONLY — NOT FINANCIAL ADVICE</h1>
        <div className="education-gate__content">
          <p>The Investment Educator provides factual information and education only. It does not provide financial advice, personal advice, general advice, or product recommendations.</p>
          <p>{REQUIRED_DISCLAIMER}</p>
          <p>Survey answers are used only to shape your learning pathway — not to tell you what to buy, sell, or invest in.</p>
        </div>
        <form className="education-gate__form" onSubmit={handleAccept}>
          <label className="education-gate__checkbox-label">
            <input
              type="checkbox"
              checked={checkboxChecked}
              onChange={(e) => setCheckboxChecked(e.target.checked)}
              required
              className="education-gate__checkbox"
            />
            <span>I understand that this tool is educational only and does not provide financial advice.</span>
          </label>
          <button
            type="submit"
            className={`education-gate__button ${checkboxChecked ? "" : "is-disabled"}`}
            disabled={!checkboxChecked}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- Password gate ----------
function PasswordGate({ children }) {
  const [attempt, setAttempt] = useState("");
  const [error, setError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const expectedPassword = useMemo(() => {
    const month = new Date().getMonth() + 1;
    return `MJL${month}`;
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalized = attempt.trim().toUpperCase();
    if (normalized === expectedPassword) {
      setIsUnlocked(true);
      setError("");
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  if (isUnlocked) {
    return children;
  }

  return (
    <div className="password-gate">
      <div className="password-gate__card">
        <h1>Welcome to Investment Educator</h1>
        <p>Please enter this month&rsquo;s password to continue.</p>
        <form className="password-gate__form" onSubmit={handleSubmit}>
          <label htmlFor="password-input" className="visually-hidden">
            Password
          </label>
          <input
            id="password-input"
            type="password"
            className="password-gate__input"
            placeholder="Enter password"
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="primary-button password-gate__button">
            Log in
          </button>
          {error && <span className="password-gate__error">{error}</span>}
        </form>
      </div>
    </div>
  );
}

// ---------- Print stylesheet ----------
const PrintStyles = () => (
  <style>{`
    @page { size: A4; margin: 14mm; }
    @media print {
      /* Base text contrast - ensure all text is black on white */
      :root { font-size: 13px; }
      * { opacity: 1!important; }
      body { 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
        background: #ffffff!important; 
        color: #000000!important; 
      }
      
      /* Force all text to black for visibility */
      .app-shell,
      .app-container,
      .surface-card,
      .summary-card,
      .callout,
      .allocation-section,
      .table-section,
      .kpi-card,
      .summary-metric,
      .allocation-item,
      .legend-row,
      .data-table,
      .section-heading,
      .section-model,
      h1, h2, h3, h4, h5, h6,
      p, span, div, td, th,
      label, strong, em {
        background: #ffffff!important;
        color: #000000!important;
        opacity: 1!important;
      }
      
      /* Specific overrides for nested elements */
      .summary-card *,
      .callout *,
      .allocation-item *,
      .legend-row *,
      .kpi-card *,
      .summary-metric *,
      .section-heading *,
      .section-model *,
      .allocation-item__name,
      .allocation-item__meta,
      .allocation-item__footer,
      .legend-label,
      .legend-value,
      .kpi-label,
      .kpi-value,
      .kpi-hint {
        color: #000000!important;
        opacity: 1!important;
      }
      
      /* Badge text - ensure white text on colored backgrounds or black on white */
      .allocation-item__badge {
        background: #6366f1!important;
        color: #ffffff!important;
        opacity: 1!important;
      }
      
      /* Remove backgrounds and effects */
      .app-background { display:none!important; }
      .app-container { padding: 0!important; max-width: 100%!important; }
      
      /* Header styling */
      .app-header { margin-bottom: 12px!important; gap: 12px!important; }
      .app-brand { gap: 12px!important; }
      .brand-mark { display:none!important; }
      .brand-tagline { max-width: none!important; color: #000000!important; }
      .app-header h1 { color: #000000!important; opacity: 1!important; }
      
      /* Hide non-printable elements */
      .header-actions,
      .app-footer,
      .summary-controls__actions,
      .no-print { display:none!important; }
      
      /* Card styling with proper spacing */
      .surface-card {
        box-shadow:none!important;
        border:1px solid #d1d5db!important;
        background:#ffffff!important;
        padding:1.35rem!important;
        margin-bottom: 14px!important;
        page-break-inside: avoid!important;
        break-inside: avoid!important;
      }
      
      /* Results view spacing */
      .results-view { gap: 16px!important; }
      
      /* Summary section layout */
      .summary-section { 
        display:grid!important; 
        grid-template-columns: 1fr!important; 
        gap: 14px!important; 
        margin-bottom: 16px!important;
      }
      
      /* Prevent page breaks */
      .summary-card,
      .summary-kpis,
      .summary-controls,
      .allocation-section,
      .table-section,
      .callout { 
        page-break-inside: avoid!important; 
        break-inside: avoid!important; 
        margin-bottom: 14px!important;
      }
      
      /* Summary metrics */
      .summary-metrics { grid-template-columns: repeat(3, minmax(0,1fr))!important; gap: 12px!important; }
      .summary-metric { 
        padding: 0.75rem 0.95rem!important; 
        color: #000000!important;
        background: #ffffff!important;
      }
      .summary-metric span,
      .summary-metric strong {
        color: #000000!important;
        opacity: 1!important;
      }
      
      /* Controls */
      .summary-controls { gap: 12px!important; }
      .toggle-group { grid-template-columns: repeat(2, minmax(0,1fr))!important; gap: 8px!important; }
      .portfolio-input { 
        padding: 0.75rem 0.9rem!important; 
        color: #000000!important;
        background: #ffffff!important;
        border: 1px solid #d1d5db!important;
      }
      .portfolio-input input {
        color: #000000!important;
        opacity: 1!important;
      }
      
      /* Allocation visual - fix spacing and prevent collisions */
      .allocation-section {
        margin-top: 16px!important;
        margin-bottom: 20px!important;
      }
      .allocation-visual { 
        grid-template-columns: 140px auto!important; 
        gap: 16px!important; 
        align-items: start!important;
        margin-bottom: 20px!important;
        padding-bottom: 16px!important;
        border-bottom: 1px solid #e5e7eb!important;
      }
      .allocation-visual__chart { 
        width: 140px!important; 
        height: 140px!important;
        margin: 0!important;
        flex-shrink: 0!important;
      }
      .allocation-donut {
        width: 100%!important;
        height: 100%!important;
      }
      .allocation-donut__center { 
        font-size: 0.7rem!important; 
        padding: 0.4rem!important;
        color: #000000!important;
        background: #ffffff!important;
        border: 1px solid #d1d5db!important;
      }
      .allocation-visual__legend { 
        gap: 6px!important; 
        display: flex!important; 
        flex-direction: column!important;
        flex: 1!important;
        min-width: 0!important;
      }
      .legend-row { 
        padding: 0.45rem 0.6rem!important; 
        gap: 0!important;
        background: #ffffff!important;
        border: 1px solid #e5e7eb!important;
        margin-bottom: 4px!important;
      }
      .legend-swatch { 
        width: 14px!important; 
        height: 14px!important; 
        box-shadow: none!important;
        flex-shrink: 0!important;
        margin-right: 4px!important;
      }
      .legend-label { 
        font-size: 0.75rem!important;
        color: #000000!important;
        opacity: 1!important;
        white-space: nowrap!important;
        overflow: hidden!important;
        text-overflow: ellipsis!important;
        margin-right: auto!important;
      }
      .legend-value { 
        font-size: 0.75rem!important;
        color: #000000!important;
        opacity: 1!important;
        font-weight: 600!important;
        flex-shrink: 0!important;
        margin-left: 2px!important;
      }
      
      /* Allocation list - ensure spacing from chart */
      .allocation-list { 
        grid-template-columns: repeat(2, minmax(0,1fr))!important; 
        gap: 12px!important;
        margin-top: 16px!important;
      }
      .allocation-item { 
        padding: 0.85rem!important; 
        gap: 10px!important;
        background: #ffffff!important;
        border: 1px solid #d1d5db!important;
        page-break-inside: avoid!important;
        break-inside: avoid!important;
      }
      .allocation-item__badge { 
        padding: 0.45rem 0.8rem!important; 
        font-size: 0.75rem!important;
        color: #ffffff!important;
        background: #6366f1!important;
        opacity: 1!important;
      }
      .allocation-item__weight { 
        font-size: 1.2rem!important;
        color: #000000!important;
        opacity: 1!important;
      }
      .allocation-item__weight-unit {
        color: #000000!important;
        opacity: 1!important;
      }
      .allocation-item__name {
        color: #000000!important;
        opacity: 1!important;
        font-weight: 600!important;
      }
      .allocation-item__meta {
        color: #000000!important;
        opacity: 1!important;
      }
      .allocation-item__footer {
        color: #000000!important;
        opacity: 1!important;
      }
      .allocation-item__bar {
        background: #e5e7eb!important;
      }
      
      /* Section headings */
      .section-heading h3 {
        color: #000000!important;
        opacity: 1!important;
        font-weight: 700!important;
      }
      .section-heading p {
        color: #000000!important;
        opacity: 1!important;
      }
      .section-model {
        color: #000000!important;
        opacity: 1!important;
        font-weight: 600!important;
      }
      
      /* KPI cards */
      .kpi-card {
        background: #ffffff!important;
        border: 1px solid #d1d5db!important;
        color: #000000!important;
      }
      .kpi-label {
        color: #000000!important;
        opacity: 1!important;
      }
      .kpi-value {
        color: #000000!important;
        opacity: 1!important;
        font-weight: 700!important;
      }
      .kpi-hint {
        color: #000000!important;
        opacity: 1!important;
      }
      
      /* Callout */
      .callout { 
        flex-direction: column!important; 
        gap: 0.8rem!important; 
        padding: 1.1rem!important; 
        font-size: 0.9rem!important;
        background: #ffffff!important;
        border: 1px solid #d1d5db!important;
      }
      .callout h3,
      .callout p {
        color: #000000!important;
        opacity: 1!important;
      }
      
      /* Table styling */
      .data-table { 
        font-size: 0.75rem!important;
        color: #000000!important;
      }
      .data-table th { 
        padding: 0.6rem 0.7rem!important; 
        font-size: 0.7rem!important;
        background: #f3f4f6!important;
        color: #000000!important;
        opacity: 1!important;
        font-weight: 600!important;
      }
      .data-table td { 
        padding: 0.6rem 0.7rem!important;
        color: #000000!important;
        opacity: 1!important;
      }
      .table-wrapper { 
        border-radius: 14px!important;
        border: 1px solid #d1d5db!important;
        background: #ffffff!important;
      }
      .ticker-cell {
        color: #000000!important;
        opacity: 1!important;
        font-weight: 700!important;
      }
      
      /* Ensure Recharts tooltips and labels are visible */
      .recharts-wrapper,
      .recharts-surface {
        overflow: visible!important;
      }
      .recharts-legend-wrapper {
        color: #000000!important;
      }
      .recharts-tooltip {
        background: #ffffff!important;
        border: 1px solid #d1d5db!important;
        color: #000000!important;
      }
      .recharts-tooltip-label {
        color: #000000!important;
      }
      .recharts-tooltip-item {
        color: #000000!important;
      }
    }
  `}</style>
);

// ---------- Main App ----------
export default function InvestmentEducatorApp() {
  const [theme, setTheme] = useState("light");
  const [stage, setStage] = useState("home");
  const [answerIndices, setAnswerIndices] = useState(() => Array(QUIZ.length).fill(UNANSWERED));
  const [examplePathway, setExamplePathway] = useState("Auto");
  const [portfolioValue, setPortfolioValue] = useState(100000);
  const resultsRef = useRef(null);
  const progressRef = useRef(null);
  const etfInfoRef = useRef(null);
  const [showEtfInfo, setShowEtfInfo] = useState(false);
  const [homePanel, setHomePanel] = useState(null);

  // Restore from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ie_v1_state") || localStorage.getItem("im_v1_state");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.theme) setTheme(s.theme);
        if (s.stage) setStage(s.stage);
        if (Array.isArray(s.answerIndices)) {
          setAnswerIndices(normalizeAnswerIndices(s.answerIndices));
        } else if (Array.isArray(s.answers)) {
          setAnswerIndices(normalizeAnswerIndices(s.answers));
        }
        const pathway = s.examplePathway || s.riskOverride;
        if (isValidPathway(pathway)) setExamplePathway(pathway);
        if (typeof s.portfolioValue !== "undefined") setPortfolioValue(toNumberSafe(s.portfolioValue, 100000));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const state = { theme, stage, answerIndices, examplePathway, portfolioValue };
    localStorage.setItem("ie_v1_state", JSON.stringify(state));
  }, [theme, stage, answerIndices, examplePathway, portfolioValue]);

  useEffect(() => {
    if (stage !== "results") {
      setShowEtfInfo(false);
    }
  }, [stage]);

  useEffect(() => {
    if (!showEtfInfo) return;
    const handleClickOutside = (event) => {
      if (etfInfoRef.current && !etfInfoRef.current.contains(event.target)) {
        setShowEtfInfo(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowEtfInfo(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keyup", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keyup", handleEscape);
    };
  }, [showEtfInfo]);

  const progress = useMemo(() => {
    const answered = answerIndices.filter((idx) => Number.isInteger(idx) && idx >= 0).length;
    return answered / QUIZ.length;
  }, [answerIndices]);

  const learningPreferenceIndex = useMemo(
    () => scoreFromAnswerIndices(answerIndices),
    [answerIndices],
  );

  const educationReport = useMemo(
    () => buildEducationReport(answerIndices),
    [answerIndices],
  );

  const assetExclusions = useMemo(
    () => deriveAssetExclusions(answerIndices),
    [answerIndices],
  );

  const autoModelName = useMemo(() => {
    if (learningPreferenceIndex > 80) return "Aggressive";
    if (learningPreferenceIndex > 50) return "Balanced";
    return "Conservative";
  }, [learningPreferenceIndex]);

  const modelName = examplePathway === "Auto" ? autoModelName : examplePathway;
  const model = useMemo(() => {
    const base = MODELS[modelName] || MODELS.Balanced;
    return applyExclusionsToModel(base, assetExclusions.excludedGroups);
  }, [modelName, assetExclusions]);

  const metrics = useMemo(() => computeMetrics(model, portfolioValue), [model, portfolioValue]);
  const chartData = useMemo(() => toChartData(model), [model]);
  const diversificationPercent = Math.round(metrics.diversification * 100);

  const kpiItems = useMemo(() => ([
    {
      label: "Expected Return",
      value: percent(metrics.expReturn, 1),
      hint: "Weighted 5-year CAGR (illustrative).",
    },
    {
      label: "Fee Drag",
      value: percent(metrics.feeDrag, 2),
      hint: "Management expense ratio per annum.",
    },
    {
      label: "Volatility",
      value: percent(metrics.vol, 1),
      hint: "Simplified blend excluding covariance.",
    },
    {
      label: "Yield (Forward)",
      value: percent(metrics.yieldPct, 1),
      hint: "Projected cash yield before tax.",
    },
  ]), [metrics]);

  const resetQuiz = () => {
    setAnswerIndices(Array(QUIZ.length).fill(UNANSWERED));
    setStage("quiz");
    setExamplePathway("Auto");
  };

  const handleAnswer = (qIndex, optionIndex) => {
    setAnswerIndices((prev) => {
      const next = [...prev];
      next[qIndex] = optionIndex;
      return next;
    });
    if (qIndex < QUIZ.length - 1) {
      setTimeout(() => scrollToQuestion(qIndex + 1), 120);
    } else {
      // Last question answered - scroll to reveal button instead of auto-transitioning
      setTimeout(() => {
        const revealButton = document.querySelector('.quiz-footer');
        if (revealButton) {
          revealButton.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 200);
    }
  };

  const scrollToQuestion = (index) => {
    const el = document.getElementById(`q-${index}`);
    if (!el) return;
    const header = progressRef.current;
    const extraGap = 8;
    const headerH = header ? header.getBoundingClientRect().height + 16 : 0;
    const targetY = window.pageYOffset + el.getBoundingClientRect().top - headerH - extraGap;
    window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
  };

  const handleExportPDF = () => {
    if (resultsRef.current) {
      window.print();
    }
  };

  const shellClass = theme === "dark" ? "app-shell is-dark" : "app-shell is-light";
  const surfaceClass = "surface-card";

  return (
    <EducationGate>
      <PasswordGate>
        <div className={shellClass} data-theme={theme}>
        <PrintStyles />
        <div className="app-background" aria-hidden="true">
          <span className="app-glow app-glow--one" />
          <span className="app-glow app-glow--two" />
          <span className="app-grid" />
        </div>
        <div className="app-container">
          <header className="app-header">
            <div className="app-brand">
              <span className="brand-mark">
                <span className="brand-glow" />
              </span>
              <div>
                <p className="brand-eyebrow">Freedom by Design</p>
                <h1>Investment Educator</h1>
                <p className="brand-tagline">Factual information and investor education only — not financial advice.</p>
              </div>
            </div>
            <div className="header-actions no-print">
              <button className="ghost-button" onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}>
                {theme === "dark" ? "Switch to light" : "Switch to dark"}
              </button>
              {stage === "results" && (
                <button className="ghost-button" onClick={handleExportPDF}>
                  Export PDF
                </button>
              )}
            </div>
          </header>

          {stage === "home" && (
            <main className="home-view home-view--focused">
              <section className={`${surfaceClass} hero-card hero-card--survey`}>
                <div className="hero-card__content">
                  <span className="hero-eyebrow">Factual information &amp; education only</span>
                  <h2>Investment Educator</h2>
                  <p className="hero-lead">
                    Answer a few questions so we can understand your investing knowledge, interests, and learning goals.
                    This is for education only and does not provide financial advice.
                  </p>
                  <button
                    type="button"
                    className="primary-button primary-button--hero no-print"
                    onClick={() => setStage("quiz")}
                  >
                    Start Investor Education Survey
                  </button>
                  <div className="hero-secondary-actions no-print">
                    <button type="button" className="ghost-button ghost-button--on-hero" onClick={() => setStage("results")}>
                      View education examples
                    </button>
                    <button type="button" className="ghost-button ghost-button--on-hero" onClick={() => setHomePanel(homePanel === "how" ? null : "how")}>
                      Learn how this works
                    </button>
                    <button type="button" className="ghost-button ghost-button--on-hero" onClick={() => setHomePanel(homePanel === "disclaimer" ? null : "disclaimer")}>
                      Read education-only disclaimer
                    </button>
                  </div>
                </div>
              </section>

              {homePanel === "how" && (
                <section className={`${surfaceClass} info-card info-card--panel`}>
                  <h3>How this works</h3>
                  <ul className="bullet-list">
                    <li>The survey gathers your knowledge, interests, and learning goals — like an education intake form.</li>
                    <li>Your answers shape a learning pathway and topics to explore first, next, and later.</li>
                    <li>An illustrative ETF mix may be shown to teach diversification — it is never a recommendation.</li>
                  </ul>
                </section>
              )}

              {homePanel === "disclaimer" && (
                <section className={`${surfaceClass} info-card info-card--panel`}>
                  <h3>Education-only disclaimer</h3>
                  <p>{SURVEY_DISCLAIMER}</p>
                  <p>{REQUIRED_DISCLAIMER}</p>
                </section>
              )}
            </main>
          )}

          {stage === "quiz" && (
            <main className="quiz-view">
              <div ref={progressRef} className={`${surfaceClass} quiz-progress`}>
                <div className="quiz-progress__left">
                  <span className="quiz-eyebrow">Progress</span>
                  <div className="progress-bar">
                    <div className="progress-bar__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                </div>
                <div className="quiz-progress__score">
                  Investor education survey — {Math.round(progress * 100)}% complete
                </div>
                <button className="ghost-button no-print" onClick={() => setStage("home")}>
                  Exit
                </button>
              </div>

              <div className={`${surfaceClass} quiz-disclaimer`}>
                <p><strong>{SURVEY_DISCLAIMER}</strong></p>
                <p>Your answers help us understand your education needs and shape your learning pathway only — not financial advice.</p>
              </div>

              <div className="quiz-questions">
                {QUIZ.map((q, i) => (
                  <section id={`q-${i}`} key={q.id} className={`${surfaceClass} quiz-question`}>
                    <div className="quiz-question__meta">
                      Question {i + 1} of {QUIZ.length}
                    </div>
                    <h3>{q.q}</h3>
                    <div className="quiz-option-grid">
                      {q.options.map((opt, idx) => {
                        const selected = answerIndices[i] === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleAnswer(i, idx)}
                            className={`quiz-option ${selected ? "is-selected" : ""}`}
                            aria-pressed={selected}
                          >
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <div className="quiz-footer">
                <button
                  className="primary-button no-print"
                  onClick={() => {
                    setStage("results");
                    window.requestAnimationFrame(() => {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    });
                  }}
                >
                  View my education pathway
                </button>
              </div>
            </main>
          )}

          {stage === "results" && (
            <main ref={resultsRef} className="results-view print-block">
              <section className="summary-section">
                <div className={`${surfaceClass} education-banner`}>
                  <strong>FACTUAL INFORMATION &amp; EDUCATION ONLY</strong>
                  <p>{SURVEY_DISCLAIMER}</p>
                  <p>{REQUIRED_DISCLAIMER}</p>
                </div>

                <article className={`${surfaceClass} summary-card education-report`}>
                  <span className="summary-eyebrow">Your investor education profile</span>
                  <h2>Your learning pathway</h2>
                  <p>{educationReport.profileSummary}</p>

                  <h3 className="education-report__subheading">Your current knowledge level</h3>
                  <p className="report-highlight">{educationReport.knowledgeLevel}</p>

                  {educationReport.themes.length > 0 && (
                    <>
                      <h3 className="education-report__subheading">Your key learning areas</h3>
                      <ul className="report-themes">
                        {educationReport.themes.map((theme) => (
                          <li key={theme.tag} className="report-themes__item">
                            <strong>{theme.title}</strong>
                            <p>{theme.why}</p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {educationReport.topicsInterested.length > 0 && (
                    <>
                      <h3 className="education-report__subheading">Topics you are interested in</h3>
                      <ul className="report-tags">
                        {educationReport.topicsInterested.map((topic) => (
                          <li key={topic}>{topic}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {educationReport.topicsExcluded.length > 0 && (
                    <>
                      <h3 className="education-report__subheading">Topics you excluded</h3>
                      <ul className="report-tags report-tags--excluded">
                        {educationReport.topicsExcluded.map((topic) => (
                          <li key={topic}>{topic}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  <h3 className="education-report__subheading">Suggested education pathway</h3>
                  <ol className="pathway-steps">
                    <li><strong>Learn first:</strong> {educationReport.educationPathway.first}</li>
                    <li><strong>Learn next:</strong> {educationReport.educationPathway.next}</li>
                    <li><strong>Learn later:</strong> {educationReport.educationPathway.later}</li>
                  </ol>

                  {educationReport.hasSelections && (
                    <>
                      <h3 className="education-report__subheading">Survey responses (education intake)</h3>
                      <dl className="report-choices">
                        {educationReport.selections.map((item, index) => (
                          <div key={`${index}-${item.question}`} className="report-choices__row">
                            <dt>{item.question}</dt>
                            <dd>{item.answer}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}

                  <p className="concepts-explore-foot">{educationReport.closing}</p>
                </article>

                <div className={`${surfaceClass} etf-disclaimer-banner`}>
                  <strong>Illustrative ETF example — education only</strong>
                  <p>{ETF_ILLUSTRATIVE_DISCLAIMER}</p>
                  {assetExclusions.messages.length > 0 && (
                    <ul className="exclusion-notices">
                      {assetExclusions.messages.map((msg) => (
                        <li key={msg}>{msg}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <article className={`${surfaceClass} summary-card`}>
                  <span className="summary-eyebrow">{pathwayLabel(modelName)}</span>
                  <h2>Illustrative ETF example (education-only)</h2>
                  <p>This sample mix helps explain diversification and asset classes. It is not a recommendation and does not tell you what to invest in.</p>
                  <p>{MODELS[modelName].notes}</p>
                  <div className="summary-metrics">
                    <div className="summary-metric">
                      <span>10-year hypothetical projection (illustrative only)</span>
                      <strong>{currency(metrics.tenYear)}</strong>
                    </div>
                    <div className="summary-metric">
                      <span>Illustrative yield example — varies widely in real markets</span>
                      <strong>{currency(metrics.passiveIncome)}</strong>
                    </div>
                    <div className="summary-metric">
                      <span>Diversification (example)</span>
                      <strong>{diversificationPercent}% sectors</strong>
                    </div>
                  </div>
                  <p className="summary-disclaimer">All projections are hypothetical and based on simplified, backward-looking assumptions. They do not represent actual or expected performance.</p>
                </article>

                <div className="summary-kpis">
                  <div className={`${surfaceClass} kpi-card`}>
                    <span className="kpi-label">Illustrative historical average — not a forecast or guarantee</span>
                    <span className="kpi-value">{percent(metrics.expReturn, 1)}</span>
                    <span className="kpi-hint">Weighted 5-year CAGR (illustrative).</span>
                  </div>
                  <div className={`${surfaceClass} kpi-card`}>
                    <span className="kpi-label">Fee Drag</span>
                    <span className="kpi-value">{percent(metrics.feeDrag, 2)}</span>
                    <span className="kpi-hint">Management expense ratio per annum.</span>
                  </div>
                  <div className={`${surfaceClass} kpi-card`}>
                    <span className="kpi-label">Volatility</span>
                    <span className="kpi-value">{percent(metrics.vol, 1)}</span>
                    <span className="kpi-hint">Simplified blend excluding covariance.</span>
                  </div>
                  <div className={`${surfaceClass} kpi-card`}>
                    <span className="kpi-label">Yield (Forward)</span>
                    <span className="kpi-value">{percent(metrics.yieldPct, 1)}</span>
                    <span className="kpi-hint">Projected cash yield before tax.</span>
                  </div>
                </div>

                <aside className={`${surfaceClass} summary-controls`}>
                  <h4>Alternate illustrative examples</h4>
                  <label className="control-label">Education example style</label>
                  <div className="toggle-group">
                    {[
                      { key: "Auto", label: "From survey" },
                      { key: "Aggressive", label: "Growth illustration" },
                      { key: "Balanced", label: "Balanced illustration" },
                      { key: "Conservative", label: "Stability illustration" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setExamplePathway(key)}
                        className={`toggle-chip ${examplePathway === key ? "is-active" : ""}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="control-label">Portfolio size</label>
                  <PortfolioInput value={portfolioValue} onChange={(v) => setPortfolioValue(clamp(v, 0, 1_000_000_000))} />
                  <div className="projection">
                    <div>Illustrative yield example ≈ <strong>{currency(metrics.passiveIncome)}</strong> p.a. (varies widely in real markets)</div>
                    <div>10-year hypothetical projection (illustrative only) ≈ <strong>{currency(metrics.tenYear)}</strong></div>
                  </div>
                  <div className="diversification">
                    <span>Diversification</span>
                    <div className="progress-bar progress-bar--inline">
                      <div className="progress-bar__fill" style={{ width: `${diversificationPercent}%` }} />
                    </div>
                  </div>
                  <div className="summary-controls__actions no-print">
                    <button className="ghost-button" onClick={resetQuiz}>
                      Retake Investor Education Survey
                    </button>
                    <button className="ghost-button" onClick={() => setStage("home")}>
                      Back to intro
                    </button>
                    <button className="ghost-button" onClick={handleExportPDF}>
                      Export PDF
                    </button>
                  </div>
                  <p className="control-footnote">{REQUIRED_DISCLAIMER}</p>
                </aside>
              </section>

              <section className={`${surfaceClass} allocation-section`}>
                <div className="section-heading section-heading--with-info">
                  <div className="section-heading__copy">
                    <h3>Illustrative ETF example</h3>
                    <p>
                      <span className="section-model">{pathwayLabel(modelName)}</span> — education-only example to explain diversification and asset classes.
                    </p>
                    <p className="section-disclaimer">{ETF_ILLUSTRATIVE_DISCLAIMER}</p>
                  </div>
                  <div className="section-heading__info" ref={etfInfoRef}>
                    <button
                      type="button"
                      className={`etf-info-button ${showEtfInfo ? "is-active" : ""}`}
                      aria-label="What is an ETF?"
                      onClick={() => setShowEtfInfo((open) => !open)}
                    >
                      i
                    </button>
                    {showEtfInfo && (
                      <div className="etf-info-popover" role="dialog" aria-label="ETF definition">
                        <p>An Exchange Traded Fund (ETF) is a “basket of investments” you can buy with one click.</p>
                        <p>
                          Instead of buying individual shares one by one, for example, BHP or CBA, an ETF bundles lots of shares (or bonds, or assets) together into a single investment. When you buy an ETF, you automatically own small pieces of every company or asset inside that basket.
                        </p>
                        <p>It’s simple, low-cost, and gives you instant diversification — which means your money is spread out, not relying on just one company.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="allocation-visual">
                  <div className="allocation-visual__chart">
                    <PortfolioDonut data={chartData} />
                  </div>
                  <div className="allocation-visual__legend">
                    {chartData.map((item, index) => {
                      const gradient = ACCENT_GRADIENTS[index % ACCENT_GRADIENTS.length];
                      return (
                        <div key={item.name} className="legend-row">
                          <span className="legend-swatch" style={{ backgroundImage: gradient }} />
                          <EtfEducationalLink ticker={item.name} className="legend-label legend-label--link">
                            {item.name}
                          </EtfEducationalLink>
                          <span className="legend-value">(e.g. {item.value}% in this example)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <AllocationList model={model} pathwayTitle={pathwayLabel(modelName)} />
                <p className="external-link-disclaimer">{EXTERNAL_LINK_DISCLAIMER}</p>
              </section>

              <section className={`${surfaceClass} table-section`}>
                <div className="section-heading">
                  <h3>ETF details</h3>
                  <p>How each holding is often described in educational materials — commonly researched options in a sample mix only.</p>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th>ETF name</th>
                        <th className="numeric">Allocation</th>
                        <th className="numeric">MER</th>
                        <th className="numeric">5-yr return</th>
                        <th className="numeric">Yield</th>
                        <th>Educational context</th>
                        <th>Learn more</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(model)
                        .filter(([k]) => k !== "notes")
                        .map(([ticker, weight]) => {
                          const e = getETF(ticker);
                          return (
                          <tr key={ticker} className="data-table__row">
                              <td className="ticker-cell">
                                <EtfEducationalLink ticker={ticker} className="ticker-cell__link">
                                  {ticker}
                                </EtfEducationalLink>
                              </td>
                              <td>
                                <EtfEducationalLink ticker={ticker} className="etf-name-link">
                                  {e.name}
                                </EtfEducationalLink>
                              </td>
                              <td className="numeric">(e.g. {weight}% in this example)</td>
                              <td className="numeric">{e.mer.toFixed(2)}%</td>
                              <td className="numeric">{percent(e.return_5y, 1)}</td>
                              <td className="numeric">{percent(e.yield, 1)}</td>
                              <td>
                                {e.sector === "US Equities" && "Often used by some investors seeking broad US market exposure."}
                                {e.sector === "Tech Growth" && "Represents how tech-focused ETFs can contribute growth exposure in a diversified mix."}
                                {e.sector === "Automation" && "Illustrates how thematic ETFs can add sector-specific exposure."}
                                {e.sector === "Crypto & Blockchain" && "Shows how high-volatility assets can be included in example portfolios."}
                                {e.sector === "Aussie Dividends" && "Often used by some investors seeking income and franking credits."}
                                {e.sector === "A-REITs" && "Represents how property ETFs can contribute income & sector diversification."}
                                {e.sector === "Global Blue-Chip" && "Illustrates exposure to global companies in a diversified mix."}
                                {e.sector === "Bonds (AU)" && "Shows how fixed income can reduce volatility in sample portfolios."}
                              </td>
                              <td>
                                <EtfEducationalLink ticker={ticker} className="table-learn-link">
                                  ETF dashboard ↗
                                </EtfEducationalLink>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <div className="table-section__footer">
                  <p className="table-footnote">{REQUIRED_DISCLAIMER}</p>
                  <p className="table-footnote external-link-disclaimer">{EXTERNAL_LINK_DISCLAIMER}</p>
                  <div className="etf-dashboard-link">
                    <a 
                      href={ETF_DASHBOARD_URL}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="etf-dashboard-button"
                    >
                      <span>Deeper dive into ETFs and what makes them up</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 2L14 8L8 14M14 8H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </section>

              <section className={`${surfaceClass} callout`}>
                <div className="callout__content">
                  <span className="callout-badge">Continue your education</span>
                  <h3>Build Your Wealth Blueprint — Education That Empowers You</h3>
                  <p>{educationReport.wealthBridge}</p>
                  <p>Get a clear, simple education roadmap for how wealth is built, how investing works, and how different long-term strategies behave — all explained in plain English.</p>
                  <p>This service provides general financial education only, not financial advice or product recommendations.</p>
                  <div className="callout-highlight">
                    <span>What you'll learn</span>
                    <i />
                  </div>
                  <ul className="callout-list">
                    <li>Understand the main types of investment options and how they work</li>
                    <li>Learn how people automate their investing to stay consistent</li>
                    <li>Explore how compounding and time impact long-term outcomes</li>
                    <li>See example "Ultimate Target" projections under different assumptions</li>
                    <li>Get psychology & mindset coaching to stay on track</li>
                    <li>One-to-one coaching on education topics only — not personal advice</li>
                  </ul>
                  <div className="callout-cta">
                    <a href="https://wealthbydesign.vercel.app/contact" target="_blank" rel="noopener noreferrer" className="callout-button">
                      Start learning
                    </a>
                    <span className="callout-cta__hint">General financial education only — not financial advice.</span>
                  </div>
                </div>
              </section>
            </main>
          )}

          <footer className="app-footer">
            <p><strong>GENERAL EDUCATION ONLY — NOT FINANCIAL ADVICE</strong></p>
            <p>All content, tools, examples, charts, projections, and ETF mixes shown are hypothetical and for educational purposes only.</p>
            <p>Nothing here is financial product advice, personal advice, a recommendation, or an offer to buy/sell any financial product.</p>
            <p>Michael Leggo and Wealth Blueprint are not licensed financial advisers.</p>
            <p>Users should consider seeking independent, licensed financial advice before making investment decisions.</p>
            <p>© {new Date().getFullYear()} Investment Educator · Built by Michael Leggo.</p>
            <p>{REQUIRED_DISCLAIMER}</p>
          </footer>
        </div>
      </div>
      </PasswordGate>
    </EducationGate>
  );
}

// --------- Lightweight Runtime Tests (console) ---------
(function runtimeTests() {
  try {
    console.group("Investment Educator — runtime tests");
    console.assert(currency(undefined) === currency(0), "currency(undefined) should equal $0");
    console.assert(currency(null) === currency(0), "currency(null) should equal $0");
    console.assert(currency(NaN) === currency(0), "currency(NaN) should equal $0");
    console.assert(currency(1234567).includes("1,234,567"), "currency(1234567) formats with commas");
    console.assert(parseCurrency("$1,234,567") === 1234567, "parseCurrency should strip formatting");
    console.assert(parseCurrency("") === 0, "parseCurrency empty string -> 0");
    console.assert(toNumberSafe("100", 0) === 100, "toNumberSafe string numeric");
    console.assert(toNumberSafe(undefined, 42) === 42, "toNumberSafe fallback works");

    // Quiz selection: one option index per question (fixes duplicate value highlights on Q6–Q8)
    const testIndices = Array(QUIZ.length).fill(UNANSWERED);
    const assertSingleSelection = (qIdx, optIdx) => {
      testIndices[qIdx] = optIdx;
      const selectedCount = QUIZ[qIdx].options.filter((_, i) => testIndices[qIdx] === i).length;
      console.assert(selectedCount === 1, `Q${qIdx + 1} should have exactly one selected option`);
    };
    assertSingleSelection(5, 2); // Q6 — balanced tour
    assertSingleSelection(6, 3); // Q7 — neither
    assertSingleSelection(7, 1); // Q8 — walk through (distinct from 0 and 2)
    console.assert(QUIZ[7].options[0].value !== QUIZ[7].options[1].value, "Q8 options should have distinct score values");
    console.assert(scoreFromAnswerIndices(testIndices) >= 0 && scoreFromAnswerIndices(testIndices) <= 100, "scoreFromAnswerIndices stays in range");

    console.groupEnd();
  } catch (e) {
    console.error("Runtime tests failed:", e);
  }
})();
