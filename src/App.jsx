import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import "./App.css";

// ---------------------------------------------
// Investment Matchmaker — v1 (JS version for Cursor)
// ---------------------------------------------

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
    notes: "This is an educational example of how someone with similar quiz responses might explore risk and diversification. It is not a recommendation or personal advice.",
  },
  Balanced: {
    IVV: 30, NDQ: 20, VHY: 20, VAP: 10, IOO: 10, CRYP: 10,
    notes: "This is an educational example of how someone with similar quiz responses might explore risk and diversification. It is not a recommendation or personal advice.",
  },
  Conservative: {
    VHY: 25, VAP: 20, IOO: 20, VAF: 15, IVV: 10, NDQ: 10,
    notes: "This is an educational example of how someone with similar quiz responses might explore risk and diversification. It is not a recommendation or personal advice.",
  },
};

// ---------- Quiz ----------
const QUIZ = [
  { id: 1, q: "What’s your primary goal?", options: [
    { label: "Grow wealth", value: 15, tags: ["growth"] },
    { label: "Build income", value: -5, tags: ["income"] },
    { label: "Protect capital", value: -10, tags: ["defensive"] },
  ]},
  { id: 2, q: "How long until you’ll need the money?", options: [
    { label: "10+ years", value: 15, tags: ["long"] },
    { label: "5–10 years", value: 5, tags: ["medium"] },
    { label: "<5 years", value: -10, tags: ["short"] },
  ]},
  { id: 3, q: "How do you react when markets drop 20%?", options: [
    { label: "Buy more", value: 15, tags: ["risk-on"] },
    { label: "Stay calm", value: 5, tags: ["steady"] },
    { label: "Sell", value: -15, tags: ["risk-off"] },
  ]},
  { id: 4, q: "What’s more important?", options: [
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
  { id: 7, q: "Do you want exposure to property, crypto, or both?", options: [
    { label: "Property", value: -1, tags: ["property"] },
    { label: "Crypto", value: 6, tags: ["crypto"] },
    { label: "Both", value: 5, tags: ["property","crypto"] },
    { label: "Neither", value: 0, tags: [] },
  ]},
  { id: 8, q: "Annual contribution budget?", options: [
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

function AllocationList({ model, modelName }) {
  const entries = Object.entries(model).filter(([key]) => key !== "notes");

  return (
    <div className="allocation-list">
      {entries.map(([ticker, weight], index) => {
        const etf = getETF(ticker);
        const gradient = ACCENT_GRADIENTS[index % ACCENT_GRADIENTS.length];
        return (
          <article key={ticker} className="allocation-item">
            <header className="allocation-item__header">
              <span className="allocation-item__badge" style={{ backgroundImage: gradient }}>
                {ticker}
              </span>
              <div className="allocation-item__weight">
                {weight}
                <span className="allocation-item__weight-unit">%</span>
              </div>
            </header>
            <div className="allocation-item__name">{etf.name}</div>
            <div className="allocation-item__description">
              {ticker} — shown here as part of an example {modelName?.toLowerCase() || "illustrative"} mix
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
          <p>This tool is for educational purposes only.</p>
          <p>It does not provide financial product advice, personal advice, or recommendations.</p>
          <p>Any portfolios, allocations, projections or ETF examples shown are illustrative only and are not suggestions to buy, sell or implement any product.</p>
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
        <h1>Welcome to Investment Matchmaker</h1>
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
export default function InvestmentMatchmakerApp() {
  const [theme, setTheme] = useState("light");
  const [stage, setStage] = useState("home");
  const [answers, setAnswers] = useState(Array(QUIZ.length).fill(NaN));
  const [riskOverride, setRiskOverride] = useState("Auto");
  const [portfolioValue, setPortfolioValue] = useState(100000);
  const resultsRef = useRef(null);
  const progressRef = useRef(null);
  const etfInfoRef = useRef(null);
  const [showEtfInfo, setShowEtfInfo] = useState(false);

  // Restore from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("im_v1_state");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.theme) setTheme(s.theme);
        if (s.stage) setStage(s.stage);
        if (Array.isArray(s.answers)) setAnswers(s.answers);
        if (s.riskOverride) setRiskOverride(s.riskOverride);
        if (typeof s.portfolioValue !== "undefined") setPortfolioValue(toNumberSafe(s.portfolioValue, 100000));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const state = { theme, stage, answers, riskOverride, portfolioValue };
    localStorage.setItem("im_v1_state", JSON.stringify(state));
  }, [theme, stage, answers, riskOverride, portfolioValue]);

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
    const answered = answers.filter(a => !Number.isNaN(a)).length;
    return answered / QUIZ.length;
  }, [answers]);

  const riskScore = useMemo(() => {
    let score = 50;
    answers.forEach(a => { if (!Number.isNaN(a)) score += a; });
    return clamp(score, 0, 100);
  }, [answers]);

  const autoModelName = useMemo(() => {
    if (riskScore > 80) return "Aggressive";
    if (riskScore > 50) return "Balanced";
    return "Conservative";
  }, [riskScore]);

  const modelName = riskOverride === "Auto" ? autoModelName : riskOverride;
  const model = MODELS[modelName];

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
    setAnswers(Array(QUIZ.length).fill(NaN));
    setStage("quiz");
    setRiskOverride("Auto");
  };

  const handleAnswer = (qIndex, value) => {
    setAnswers(prev => {
      const next = [...prev];
      next[qIndex] = value;
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
                <h1>Investment Matchmaker</h1>
                <p className="brand-tagline">Explore how different investment styles work — through simple, illustrative examples.</p>
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
            <main className="home-view">
              <section className={`${surfaceClass} hero-card`}>
                <div className="hero-card__content">
                <span className="hero-eyebrow">Educational tool</span>
                <h2>Explore hypothetical ETF mixes based on different risk styles — for learning only.</h2>
                <p>Answer a few questions and we'll show you educational example portfolios to help you understand how risk, time horizon and diversification can influence long-term outcomes.</p>
                <p>Nothing here tells you what to buy — this is general education only.</p>
                  <div className="hero-actions">
                    <button className="primary-button no-print" onClick={() => setStage("quiz")}>
                      Start education tool
                    </button>
                    <button className="ghost-button no-print" onClick={() => setStage("results")}>
                      View example mixes
                    </button>
                  </div>
                </div>
                <div className="hero-highlights">
                  <div className="highlight-chip">
                    <span className="highlight-label">Live risk score</span>
                    <span className="highlight-value">{riskScore}</span>
                  </div>
                  <div className="highlight-chip">
                    <span className="highlight-label">Models curated</span>
                    <span className="highlight-value">Aggressive · Balanced · Conservative</span>
                  </div>
                  <div className="highlight-chip">
                    <span className="highlight-label">Output</span>
                    <span className="highlight-value">ETF blend · projections · income</span>
                  </div>
                </div>
              </section>
              <section className={`${surfaceClass} info-card`}>
                <h3>What you'll explore</h3>
                <ul className="bullet-list">
                  <li>Illustrative allocation examples across different ETF types.</li>
                  <li>Hypothetical projections for income, 10-year growth and diversification concepts.</li>
                  <li>Educational examples for learning purposes only.</li>
                </ul>
                <div className="info-card__foot">General education only. Not financial advice.</div>
              </section>
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
                  Example risk score <span>{riskScore}</span> → {autoModelName} example
                </div>
                <button className="ghost-button no-print" onClick={() => setStage("home")}>
                  Exit
                </button>
              </div>

              <div className={`${surfaceClass} quiz-disclaimer`}>
                <p><strong>Your answers help us select an illustrative example to teach different concepts.</strong></p>
                <p>This does not create a personalised portfolio.</p>
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
                        const selected = !Number.isNaN(answers[i]) && answers[i] === opt.value;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleAnswer(i, opt.value)}
                            className={`quiz-option ${selected ? "is-selected" : ""}`}
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
                  Show educational example
                </button>
              </div>
            </main>
          )}

          {stage === "results" && (
            <main ref={resultsRef} className="results-view print-block">
              <section className="summary-section">
                <div className={`${surfaceClass} education-banner`}>
                  <strong>EDUCATIONAL EXAMPLE ONLY — NOT A RECOMMENDATION</strong>
                  <p>This mix is hypothetical and shown only to teach concepts such as diversification, risk, and long-term compounding.</p>
                  <p>It is not telling you what to buy.</p>
                </div>

                <article className={`${surfaceClass} summary-card`}>
                  <span className="summary-eyebrow">{modelName} example</span>
                  <h2>Example ETF mix (educational only)</h2>
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
                  <h4>Fine-tune</h4>
                  <label className="control-label">Risk setting</label>
                  <div className="toggle-group">
                    {["Auto", "Aggressive", "Balanced", "Conservative"].map((option) => (
                      <button
                        key={option}
                        onClick={() => setRiskOverride(option)}
                        className={`toggle-chip ${riskOverride === option ? "is-active" : ""}`}
                      >
                        {option}
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
                      Re-run quiz
                    </button>
                    <button className="ghost-button" onClick={() => setStage("home")}>
                      Back to intro
                    </button>
                    <button className="ghost-button" onClick={handleExportPDF}>
                      Export PDF
                    </button>
                  </div>
                  <p className="control-footnote">All examples, projections and mixes are hypothetical and for educational purposes only. Not financial advice.</p>
                </aside>
              </section>

              <section className={`${surfaceClass} allocation-section`}>
                <div className="section-heading section-heading--with-info">
                  <div className="section-heading__copy">
                    <h3>Illustrative portfolio example</h3>
                    <p>
                      <span className="section-model">{modelName} example</span> · {MODELS[modelName].notes}
                    </p>
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
                          <span className="legend-label">{item.name}</span>
                          <span className="legend-value">(e.g. {item.value}% in this example)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <AllocationList model={model} modelName={modelName} />
              </section>

              <section className={`${surfaceClass} table-section`}>
                <div className="section-heading">
                  <h3>ETF details</h3>
                  <p>Understand the role each holding plays inside the portfolio.</p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(model)
                        .filter(([k]) => k !== "notes")
                        .map(([ticker, weight]) => {
                          const e = getETF(ticker);
                          return (
                          <tr key={ticker} className="data-table__row">
                              <td className="ticker-cell">{ticker}</td>
                              <td>{e.name}</td>
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
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <p className="table-footnote">All data shown is illustrative and for educational purposes only. Not financial advice.</p>
              </section>

              <section className={`${surfaceClass} callout`}>
                <div className="callout__content">
                  <span className="callout-badge">Education service</span>
                  <h3>Build Your Wealth Blueprint — Education That Empowers You</h3>
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
                    <li>Get personalised coaching about education only — not advice</li>
                  </ul>
                  <div className="callout-cta">
                    <button className="callout-button" type="button" onClick={() => setStage("quiz")}>
                      Start learning
                    </button>
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
            <p>© {new Date().getFullYear()} Investment Matchmaker · Built by Michael Leggo.</p>
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
    console.group("Investment Matchmaker — runtime tests");
    console.assert(currency(undefined) === currency(0), "currency(undefined) should equal $0");
    console.assert(currency(null) === currency(0), "currency(null) should equal $0");
    console.assert(currency(NaN) === currency(0), "currency(NaN) should equal $0");
    console.assert(currency(1234567).includes("1,234,567"), "currency(1234567) formats with commas");
    console.assert(parseCurrency("$1,234,567") === 1234567, "parseCurrency should strip formatting");
    console.assert(parseCurrency("") === 0, "parseCurrency empty string -> 0");
    console.assert(toNumberSafe("100", 0) === 100, "toNumberSafe string numeric");
    console.assert(toNumberSafe(undefined, 42) === 42, "toNumberSafe fallback works");
    console.groupEnd();
  } catch (e) {
    console.error("Runtime tests failed:", e);
  }
})();
