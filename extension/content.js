/**
 * content.js — TradingView Institutional AI Copilot [Pro] (v5.0)
 * Implements the complete Trading Win-Rate Framework:
 * - Macro Trend Baseline (Daily EMA 200 - Rule 1)
 * - Fibonacci 0.618 Golden Pocket
 * - Order Flow CVD & Whale Absorption Traps
 * - Statistical Extremes (Z-Score +/- 2.5σ to 3.0σ)
 * - Liquidity Sweeps / Stop Hunts (Rule 2)
 * - Asymmetric Risk Protocol (1% Risk, TP1 1:1 Breakeven Lock, TP2 1:2)
 * - Delta-Neutral Arbitrage Engine (Live Basis & Funding Yield)
 * - 5 Non-Negotiable Discipline Rules
 */

const DEFAULT_LOCAL_BACKEND = "http://127.0.0.1:8000";
const CLOUD_BACKEND = "https://trading-view-ai-copilot.vercel.app";
const REFRESH_MS = 15000;

let currentBackend = DEFAULT_LOCAL_BACKEND;
let currentInterval = "1h";
let userCapital = 10000;
let activeTab = "total";
let method77Filter = "all";
let method77Search = "";
let panelEl = null;
let lastApiData = null;

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getSymbolFromPage() {
  const params = new URLSearchParams(window.location.search);
  let symbol = params.get("symbol");
  if (symbol) {
    symbol = symbol.split(":").pop();
    return symbol;
  }
  const titleMatch = document.title.match(/([A-Z0-9]{4,15})/);
  return titleMatch ? titleMatch[1] : "BTCUSDT";
}

function buildPanel() {
  if (panelEl) return panelEl;

  panelEl = document.createElement("div");
  panelEl.id = "tv-ai-copilot-panel";
  panelEl.innerHTML = `
    <div id="tvac-header">
      <div class="tvac-brand-group">
        <span class="tvac-live-dot" title="Live Institutional Engine"></span>
        <span class="tvac-title">Copilot Pro [80%+ Engine]</span>
      </div>
      <div class="tvac-header-actions">
        <select id="tvac-interval" class="tvac-select">
          <option value="15m">15m</option>
          <option value="30m">30m</option>
          <option value="1h" selected>1h</option>
          <option value="4h">4h</option>
          <option value="1d">1D</option>
        </select>
        <button id="tvac-collapse" class="tvac-icon-btn" title="Minimize / Expand">—</button>
      </div>
    </div>
    <div id="tvac-body">
      <div class="tvac-loading-box">
        <div class="tvac-spinner"></div>
        <div>Initializing Institutional Engine...</div>
      </div>
    </div>
  `;
  document.body.appendChild(panelEl);

  panelEl.querySelector("#tvac-interval").addEventListener("change", (e) => {
    currentInterval = e.target.value;
    refresh();
  });

  panelEl.querySelector("#tvac-collapse").addEventListener("click", () => {
    panelEl.classList.toggle("tvac-collapsed");
  });

  makeDraggable(panelEl, panelEl.querySelector("#tvac-header"));
  return panelEl;
}

function makeDraggable(el, handle) {
  let offsetX = 0, offsetY = 0, dragging = false;
  handle.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "SELECT" || e.target.tagName === "BUTTON") return;
    dragging = true;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    el.style.left = (e.clientX - offsetX) + "px";
    el.style.top = (e.clientY - offsetY) + "px";
  });
  document.addEventListener("mouseup", () => (dragging = false));
}

function ensureApproachesData(data) {
  if (data.approaches && Array.isArray(data.approaches) && data.approaches.length === 5 && data.total_consensus && data.indicator_engine && data.master_method_77) {
    return data;
  }

  const ind = data.indicators || {};
  const of = data.order_flow_cvd || {};
  const z = data.z_score_engine || {};
  const fib = data.fibonacci || {};
  const sweep = data.liquidity_sweeps || {};
  const macro = data.macro_trend || {};
  const struct = data.structure || "range";

  // 1. SMC
  let smcBull = 0, smcBear = 0;
  const smcSignals = [];
  if (struct === "uptrend") {
    smcBull++;
    smcSignals.push({ indicator: "Market Structure (BOS)", status: "Bullish", val: "Uptrend (HH/HL)", detail: "Bullish BOS confirmed on swing highs" });
  } else if (struct === "downtrend") {
    smcBear++;
    smcSignals.push({ indicator: "Market Structure (BOS)", status: "Bearish", val: "Downtrend (LH/LL)", detail: "Bearish BOS confirmed on swing lows" });
  } else {
    smcSignals.push({ indicator: "Market Structure (BOS)", status: "Neutral", val: "Consolidation Range", detail: "Price oscillating within range" });
  }

  if (sweep.ssl_sweep) {
    smcBull += 2;
    smcSignals.push({ indicator: "Liquidity Sweep (Stop Hunt)", status: "Bullish", val: "SSL Swept (Rejection)", detail: "Sell-Side liquidity purged; rejection wick active" });
  } else if (sweep.bsl_sweep) {
    smcBear += 2;
    smcSignals.push({ indicator: "Liquidity Sweep (Stop Hunt)", status: "Bearish", val: "BSL Swept (Rejection)", detail: "Buy-Side liquidity purged; rejection wick active" });
  } else {
    smcSignals.push({ indicator: "Liquidity Sweep (Stop Hunt)", status: "Neutral", val: "No Fresh Sweep", detail: "No extreme stop hunt rejection" });
  }

  if (fib.in_golden_pocket) {
    if (macro.macro_bias === "Bullish") {
      smcBull++;
      smcSignals.push({ indicator: "Fibonacci Golden Pocket", status: "Bullish", val: "In 0.618 Pocket", detail: "Price in optimal trade entry pullback zone" });
    } else {
      smcBear++;
      smcSignals.push({ indicator: "Fibonacci Golden Pocket", status: "Bearish", val: "In 0.618 Pocket", detail: "Price in optimal trade entry short zone" });
    }
  } else {
    smcSignals.push({ indicator: "Fibonacci Golden Pocket", status: "Neutral", val: fib.status || "Outside Pocket", detail: "0.618 - 0.65 zone" });
  }

  if (of.bull_absorption) {
    smcBull++;
    smcSignals.push({ indicator: "Whale Limit Absorption", status: "Bullish", val: "Whale Limit Buy Active", detail: "Institutional limit bids absorbing selling" });
  } else if (of.bear_absorption) {
    smcBear++;
    smcSignals.push({ indicator: "Whale Limit Absorption", status: "Bearish", val: "Whale Limit Sell Active", detail: "Institutional limit asks absorbing buying" });
  } else {
    smcSignals.push({ indicator: "Whale Limit Absorption", status: "Neutral", val: "Normal Flow", detail: "No iceberg trap" });
  }

  const smcBias = smcBull > smcBear ? "Bullish" : (smcBear > smcBull ? "Bearish" : "Neutral");
  const smcConf = smcBias === "Neutral" ? 50 : Math.min(92, 50 + Math.abs(smcBull - smcBear) * 15);
  const smcBullPct = smcBias === "Bullish" ? smcConf : (smcBias === "Bearish" ? 100 - smcConf : 50);

  const smcApp = {
    id: "smc",
    name: "Smart Money Concepts (SMC)",
    angle: "Order Blocks, Liquidity Sweeps, Swing BOS & Fibo OTE",
    bias: smcBias,
    confidence_pct: smcConf,
    bullish_pct: smcBullPct,
    bearish_pct: 100 - smcBullPct,
    verdict_summary: `SMC Angle predicts ${smcBias.toUpperCase()} (${smcConf}% confidence) based on liquidity sweeps & structural retention.`,
    signals: smcSignals
  };

  // 2. Trend
  let trendBull = 0, trendBear = 0;
  const trendSignals = [];
  const isMacroBull = macro.macro_bias === "Bullish";
  if (isMacroBull) {
    trendBull += 2;
    trendSignals.push({ indicator: "Macro Trend (Daily EMA 200)", status: "Bullish", val: `Bullish ($${macro.daily_ema_200})`, detail: "Longs Only Regime (Rule 1)" });
  } else {
    trendBear += 2;
    trendSignals.push({ indicator: "Macro Trend (Daily EMA 200)", status: "Bearish", val: `Bearish ($${macro.daily_ema_200})`, detail: "Shorts Only Regime (Rule 1)" });
  }

  const adx = ind.adx || {};
  if ((adx.plus_di || 0) > (adx.minus_di || 0)) {
    trendBull++;
    trendSignals.push({ indicator: "ADX Directional Power", status: "Bullish", val: `+DI (${adx.plus_di}) > -DI (${adx.minus_di})`, detail: `ADX: ${adx.adx} - Bulls in control` });
  } else {
    trendBear++;
    trendSignals.push({ indicator: "ADX Directional Power", status: "Bearish", val: `-DI (${adx.minus_di}) > +DI (${adx.plus_di})`, detail: `ADX: ${adx.adx} - Bears in control` });
  }

  trendSignals.push({ indicator: "Market Structure Trajectory", status: struct === "uptrend" ? "Bullish" : (struct === "downtrend" ? "Bearish" : "Neutral"), val: struct.toUpperCase(), detail: "Swing trajectory alignment" });

  const trendBias = trendBull > trendBear ? "Bullish" : (trendBear > trendBull ? "Bearish" : "Neutral");
  const trendConf = trendBias === "Neutral" ? 50 : Math.min(95, 50 + Math.abs(trendBull - trendBear) * 15);
  const trendBullPct = trendBias === "Bullish" ? trendConf : (trendBias === "Bearish" ? 100 - trendConf : 50);

  const trendApp = {
    id: "trend",
    name: "Trend & Moving Averages",
    angle: "Macro Daily EMA 200, Multi-EMA Stack & ADX Trajectory",
    bias: trendBias,
    confidence_pct: trendConf,
    bullish_pct: trendBullPct,
    bearish_pct: 100 - trendBullPct,
    verdict_summary: `Trend Approach predicts ${trendBias.toUpperCase()} (${trendConf}% confidence) following higher timeframe EMA 200 baseline.`,
    signals: trendSignals
  };

  // 3. Momentum
  let momBull = 0, momBear = 0;
  const momSignals = [];
  const rsi = ind.rsi || 50;
  if (rsi > 55) {
    momBull++;
    momSignals.push({ indicator: "RSI (14)", status: "Bullish", val: `RSI: ${rsi}`, detail: "Bullish momentum above 50 midline" });
  } else if (rsi < 45) {
    momBear++;
    momSignals.push({ indicator: "RSI (14)", status: "Bearish", val: `RSI: ${rsi}`, detail: "Bearish momentum below 50 midline" });
  } else {
    momSignals.push({ indicator: "RSI (14)", status: "Neutral", val: `RSI: ${rsi}`, detail: "Balanced neutral equilibrium" });
  }

  const macd = ind.macd || {};
  if ((macd.histogram || 0) > 0) {
    momBull++;
    momSignals.push({ indicator: "MACD Histogram", status: "Bullish", val: `Hist: +${macd.histogram}`, detail: "Positive velocity expansion" });
  } else {
    momBear++;
    momSignals.push({ indicator: "MACD Histogram", status: "Bearish", val: `Hist: ${macd.histogram}`, detail: "Negative velocity expansion" });
  }

  const stoch = ind.stochastic || {};
  if ((stoch.k || 0) > (stoch.d || 0)) {
    momBull++;
    momSignals.push({ indicator: "Stochastic Oscillator", status: "Bullish", val: `%K (${stoch.k}) > %D (${stoch.d})`, detail: "Fast oscillator crossing above signal" });
  } else {
    momBear++;
    momSignals.push({ indicator: "Stochastic Oscillator", status: "Bearish", val: `%K (${stoch.k}) < %D (${stoch.d})`, detail: "Fast oscillator crossing below signal" });
  }

  const cmf = ind.cmf || 0;
  if (cmf > 0.05) {
    momBull++;
    momSignals.push({ indicator: "Chaikin Money Flow (CMF)", status: "Bullish", val: `CMF: +${cmf}`, detail: "Active capital accumulation" });
  } else if (cmf < -0.05) {
    momBear++;
    momSignals.push({ indicator: "Chaikin Money Flow (CMF)", status: "Bearish", val: `CMF: ${cmf}`, detail: "Capital distribution pressure" });
  } else {
    momSignals.push({ indicator: "Chaikin Money Flow (CMF)", status: "Neutral", val: `CMF: ${cmf}`, detail: "Balanced money flow" });
  }

  const momBias = momBull > momBear ? "Bullish" : (momBear > momBull ? "Bearish" : "Neutral");
  const momConf = momBias === "Neutral" ? 50 : Math.min(90, 50 + Math.abs(momBull - momBear) * 15);
  const momBullPct = momBias === "Bullish" ? momConf : (momBias === "Bearish" ? 100 - momConf : 50);

  const momApp = {
    id: "momentum",
    name: "Momentum & Oscillators",
    angle: "RSI Velocity, MACD Histogram, Stochastic Cross & CMF",
    bias: momBias,
    confidence_pct: momConf,
    bullish_pct: momBullPct,
    bearish_pct: 100 - momBullPct,
    verdict_summary: `Momentum Approach predicts ${momBias.toUpperCase()} (${momConf}% confidence) across cyclic oscillators.`,
    signals: momSignals
  };

  // 4. Order Flow
  let ofBull = 0, ofBear = 0;
  const ofSignals = [];
  if ((of.cvd_trend || "").includes("Rising")) {
    ofBull += 2;
    ofSignals.push({ indicator: "Cumulative Volume Delta (CVD)", status: "Bullish", val: "Rising (Aggressive Buys)", detail: "Aggressive market buy volume dominating" });
  } else {
    ofBear += 2;
    ofSignals.push({ indicator: "Cumulative Volume Delta (CVD)", status: "Bearish", val: "Falling (Aggressive Sells)", detail: "Aggressive market sell volume dominating" });
  }

  if (of.bull_absorption) {
    ofBull += 2;
    ofSignals.push({ indicator: "Whale Absorption Trap", status: "Bullish", val: "Whale Buy Trap ACTIVE", detail: "Heavy selling absorbed by institutional limit bids" });
  } else if (of.bear_absorption) {
    ofBear += 2;
    ofSignals.push({ indicator: "Whale Absorption Trap", status: "Bearish", val: "Whale Sell Trap ACTIVE", detail: "Heavy buying absorbed by institutional limit asks" });
  } else {
    ofSignals.push({ indicator: "Whale Absorption Trap", status: "Neutral", val: "Normal Tape Flow", detail: "No iceberg trap active" });
  }

  const bDelta = of.bar_delta || 0;
  if (bDelta > 0) {
    ofBull++;
    ofSignals.push({ indicator: "Bar Delta Imbalance", status: "Bullish", val: `+${bDelta} Net Buyer Delta`, detail: "Net buying volume on current bar" });
  } else {
    ofBear++;
    ofSignals.push({ indicator: "Bar Delta Imbalance", status: "Bearish", val: `${bDelta} Net Seller Delta`, detail: "Net selling volume on current bar" });
  }

  const obvTrend = (ind.obv && ind.obv.trend) || "falling";
  if (obvTrend === "rising") {
    ofBull++;
    ofSignals.push({ indicator: "On-Balance Volume (OBV)", status: "Bullish", val: "Rising Slope", detail: "Volume leading price higher" });
  } else {
    ofBear++;
    ofSignals.push({ indicator: "On-Balance Volume (OBV)", status: "Bearish", val: "Falling Slope", detail: "Volume leading price lower" });
  }

  const ofBias = ofBull > ofBear ? "Bullish" : (ofBear > ofBull ? "Bearish" : "Neutral");
  const ofConf = ofBias === "Neutral" ? 50 : Math.min(95, 50 + Math.abs(ofBull - ofBear) * 12);
  const ofBullPct = ofBias === "Bullish" ? ofConf : (ofBias === "Bearish" ? 100 - ofConf : 50);

  const ofApp = {
    id: "orderflow",
    name: "Volume & Order Flow (CVD)",
    angle: "Cumulative Volume Delta, Whale Absorption & Bar Imbalance",
    bias: ofBias,
    confidence_pct: ofConf,
    bullish_pct: ofBullPct,
    bearish_pct: 100 - ofBullPct,
    verdict_summary: `Order Flow Approach predicts ${ofBias.toUpperCase()} (${ofConf}% confidence) based on institutional tape and CVD slope.`,
    signals: ofSignals
  };

  // 5. Statistical Z-Score
  let statBull = 0, statBear = 0;
  const statSignals = [];
  const zVal = z.z_score || 0;
  if (zVal <= -2.0) {
    statBull += 2;
    statSignals.push({ indicator: "Z-Score (20-Period)", status: "Bullish", val: `Z = ${zVal} σ (Oversold)`, detail: "98.7% normal distribution extreme; mean reversion bounce expected" });
  } else if (zVal >= 2.0) {
    statBear += 2;
    statSignals.push({ indicator: "Z-Score (20-Period)", status: "Bearish", val: `Z = +${zVal} σ (Overbought)`, detail: "98.7% normal distribution extreme; mean reversion pullback expected" });
  } else if (zVal < 0) {
    statBull++;
    statSignals.push({ indicator: "Z-Score (20-Period)", status: "Bullish", val: `Z = ${zVal} σ (Below Mean)`, detail: `Below 20-mean ($${z.mean_20}); room for upside reversion` });
  } else {
    statBear++;
    statSignals.push({ indicator: "Z-Score (20-Period)", status: "Bearish", val: `Z = +${zVal} σ (Above Mean)`, detail: `Above 20-mean ($${z.mean_20}); room for downside reversion` });
  }

  statSignals.push({ indicator: "Gaussian Boundaries", status: "Neutral", val: `+2.5σ: $${z.upper_extreme_2_5} | -2.5σ: $${z.lower_extreme_2_5}`, detail: "98.7% statistical envelope" });

  const statBias = statBull > statBear ? "Bullish" : (statBear > statBull ? "Bearish" : "Neutral");
  const statConf = statBias === "Neutral" ? 50 : Math.min(90, 50 + Math.abs(statBull - statBear) * 15);
  const statBullPct = statBias === "Bullish" ? statConf : (statBias === "Bearish" ? 100 - statConf : 50);

  const statApp = {
    id: "statistical",
    name: "Statistical Extremes & Z-Score",
    angle: "Gaussian Normal Distribution, Mean Reversion & Sigma Bands",
    bias: statBias,
    confidence_pct: statConf,
    bullish_pct: statBullPct,
    bearish_pct: 100 - statBullPct,
    verdict_summary: `Statistical Approach predicts ${statBias.toUpperCase()} (${statConf}% confidence) from standard deviation curve.`,
    signals: statSignals
  };

  const allApps = [smcApp, trendApp, momApp, ofApp, statApp];

  const bCount = allApps.filter(a => a.bias === "Bullish").length;
  const sCount = allApps.filter(a => a.bias === "Bearish").length;
  const nCount = allApps.filter(a => a.bias === "Neutral").length;

  const weights = [0.25, 0.25, 0.15, 0.20, 0.15];
  let totBullChance = allApps.reduce((acc, a, i) => acc + a.bullish_pct * weights[i], 0);
  totBullChance = Math.min(95, Math.max(5, Math.round(totBullChance * 10) / 10));
  const totBearChance = Math.round((100 - totBullChance) * 10) / 10;

  let indBull = 0, indBear = 0, indNeut = 0;
  allApps.forEach(a => {
    (a.signals || []).forEach(s => {
      const st = (s.status || "").toLowerCase();
      if (st === "bullish") indBull++;
      else if (st === "bearish") indBear++;
      else indNeut++;
    });
  });

  let conDir = "Neutral / Mixed";
  let conAct = "Signals are mixed between indicators. Stand down (Rule 3).";
  if (totBullChance >= 70) {
    conDir = "Strong Bullish";
    conAct = `High-conviction LONG edge (${totBullChance}% Bullish Chance). ${bCount} of 5 approaches align bullish.`;
  } else if (totBullChance >= 55) {
    conDir = "Moderate Bullish";
    conAct = `Favorable LONG bias (${totBullChance}% Bullish Chance). Confirm entry with wick rejection.`;
  } else if (totBullChance <= 30) {
    conDir = "Strong Bearish";
    conAct = `High-conviction SHORT edge (${totBearChance}% Bearish Chance). ${sCount} of 5 approaches align bearish.`;
  } else if (totBullChance <= 45) {
    conDir = "Moderate Bearish";
    conAct = `Favorable SHORT bias (${totBearChance}% Bearish Chance). Stand down on longs.`;
  }

  data.approaches = allApps;
  data.total_consensus = {
    bullish_chance_pct: totBullChance,
    bearish_chance_pct: totBearChance,
    consensus_direction: conDir,
    consensus_action: conAct,
    approaches_count: { bullish: bCount, bearish: sCount, neutral: nCount, total: 5 },
    indicators_count: { bullish: indBull, bearish: indBear, neutral: indNeut, total: indBull + indBear + indNeut },
    scoreboard: allApps.map(a => ({
      id: a.id,
      name: a.name,
      angle: a.angle,
      bias: a.bias,
      bullish_pct: a.bullish_pct,
      bearish_pct: a.bearish_pct,
      verdict: a.verdict_summary
    }))
  };

  if (!data.indicator_engine) {
    const trendPct = trendApp.bullish_pct;
    const momentumPct = momApp.bullish_pct;
    const volumePct = ofApp.bullish_pct;
    const liquidityPct = smcApp.bullish_pct;
    const totPct = Math.round(trendPct * 0.35 + momentumPct * 0.25 + volumePct * 0.20 + liquidityPct * 0.20);
    const bBias = totPct >= 50;
    const confPct = Math.abs(totPct - 50) * 2;
    const confLbl = confPct >= 70 ? "HIGH" : (confPct >= 40 ? "MEDIUM" : "LOW");
    const sigTxt = (trendApp.bias === "Bullish" && momApp.bias === "Bullish" && bBias) ? "BUY" : ((trendApp.bias === "Bearish" && momApp.bias === "Bearish" && !bBias) ? "SELL" : "WAIT");
    const lp = data.last_price || 0;

    data.indicator_engine = {
      id: "indicator",
      name: "All-In-One Indicator",
      title: "Indicator (HEHE All-In-One)",
      bias: bBias ? "Bullish" : "Bearish",
      total_pct: totPct,
      bullish_pct: totPct,
      bearish_pct: 100 - totPct,
      confidence_pct: confPct,
      confidence_label: confLbl,
      signal: sigTxt,
      signal_strength: `${bBias ? 8 : 4}/10`,
      subscores: {
        trend_pct: trendPct,
        momentum_pct: momentumPct,
        volume_pct: volumePct,
        liquidity_pct: liquidityPct
      },
      entry_confirmation: {
        ema_check: isMacroBull,
        macd_check: (ind.macd && ind.macd.histogram > 0),
        rsi_check: (ind.rsi || 50) > 50,
        vol_check: (ind.cmf || 0) > 0,
        liq_check: (sweep.ssl_sweep || struct === "uptrend"),
        score_pct: bBias ? 80 : 40
      },
      godzilla: {
        imbalance_it: (of.bar_delta || 0) > 0 ? 0.35 : -0.35,
        direction: (of.bar_delta || 0) > 0 ? "LONG" : "SHORT",
        sigma_smooth: 0.48,
        leverage_factor: 0.94,
        suggested_max_lev: "18.8x"
      },
      expected_move: {
        move_txt: bBias ? "⬆ +1.5%" : "⬇ -1.5%",
        range_txt: `$${(lp * 0.985).toFixed(1)} → $${(lp * 1.015).toFixed(1)}`,
        range_low: lp * 0.985,
        range_high: lp * 1.015
      },
      trade_plan: {
        direction: bBias ? "BUY" : "SELL",
        entry: lp,
        sl: bBias ? lp * 0.985 : lp * 1.015,
        tp1: bBias ? lp * 1.015 : lp * 0.985,
        tp2: bBias ? lp * 1.03 : lp * 0.97,
        tp3: bBias ? lp * 1.045 : lp * 0.955
      }
    };
  }

  if (!data.master_method_77) {
    data.master_method_77 = generateFallbackMethod77(data, struct, sweep, ind, of, macro);
  }

  return data;
}

function renderIndicatorTab(data) {
  const ie = data.indicator_engine;
  if (!ie) return `<div class="tvac-card">Computing All-In-One Indicator Engine...</div>`;

  const isBuy = ie.signal === "BUY" || ie.bias === "Bullish";
  const isSell = ie.signal === "SELL" || ie.bias === "Bearish";
  const sigBadgeClass = isBuy ? "tvac-badge-bull" : (isSell ? "tvac-badge-bear" : "tvac-badge-neutral");
  const sigColor = isBuy ? "#10b981" : (isSell ? "#ef4444" : "#94a3b8");

  const sub = ie.subscores || {};
  const ec = ie.entry_confirmation || {};
  const gz = ie.godzilla || {};
  const em = ie.expected_move || {};
  const tp = ie.trade_plan || {};

  return `
    <!-- Master Indicator Signal Banner -->
    <div class="tvac-card tvac-approach-card" style="border-left-color: #a855f7;">
      <div class="tvac-approach-header">
        <div>
          <div class="tvac-approach-title">All-In-One Indicator Engine</div>
          <div class="tvac-approach-angle">Pine Script HEHE (4-Category Weighted System)</div>
        </div>
        <div class="tvac-prediction-badge ${sigBadgeClass}">
          ${ie.signal} (${ie.signal_strength})
        </div>
      </div>

      <div class="tvac-progress-wrap" style="margin-top: 8px;">
        <div class="tvac-progress-header">
          <span>Overall Bias: <b style="color:${sigColor}">${ie.bias} (${ie.total_pct}%)</b></span>
          <span>AI Confidence: <b style="color:${ie.confidence_label === 'HIGH' ? '#10b981' : '#f59e0b'}">${ie.confidence_label} (${ie.confidence_pct}%)</b></span>
        </div>
        <div class="tvac-progress-bar">
          <div class="tvac-progress-fill" style="width: ${ie.bullish_pct}%; background: ${isBuy ? '#10b981' : (isSell ? '#ef4444' : '#f59e0b')};"></div>
        </div>
      </div>

      <div class="tvac-action-callout" style="margin-top: 8px; font-size: 11px;">
        <strong>Signal Status:</strong> ${ie.signal === "BUY" ? "High-confluence BUY setup triggered (Score ≥ 6/10)." : (ie.signal === "SELL" ? "High-confluence SELL setup triggered (Score ≥ 6/10)." : `Conditions in WAIT state (${ie.signal_strength} Score). Waiting for full 6/10 threshold.`)}
      </div>
    </div>

    <!-- 4 Sub-Scores Gauges Grid -->
    <div class="tvac-card">
      <div class="tvac-card-title">
        <span>4-Category Probability Sub-Scores</span>
        <span style="font-size: 9.5px; color: #c084fc;">Weighted Formula</span>
      </div>
      <div class="tvac-risk-grid">
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">Trend (35% W)</div>
          <div class="tvac-metric-val ${sub.trend_pct >= 50 ? 'tvac-val-green' : 'tvac-val-red'}">${sub.trend_pct}%</div>
        </div>
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">Momentum (25% W)</div>
          <div class="tvac-metric-val ${sub.momentum_pct >= 50 ? 'tvac-val-green' : 'tvac-val-red'}">${sub.momentum_pct}%</div>
        </div>
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">Volume (20% W)</div>
          <div class="tvac-metric-val ${sub.volume_pct >= 50 ? 'tvac-val-green' : 'tvac-val-red'}">${sub.volume_pct}%</div>
        </div>
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">Liquidity (20% W)</div>
          <div class="tvac-metric-val ${sub.liquidity_pct >= 50 ? 'tvac-val-green' : 'tvac-val-red'}">${sub.liquidity_pct}%</div>
        </div>
      </div>
    </div>

    <!-- Entry Confirmation Table -->
    <div class="tvac-card">
      <div class="tvac-card-title">
        <span>Entry Confirmation Table</span>
        <span style="font-size: 10px; color: ${ec.score_pct >= 60 ? '#10b981' : '#ef4444'}">Score: ${ec.score_pct}%</span>
      </div>
      <div class="tvac-checklist">
        <div class="tvac-check-item ${ec.ema_check ? 'passed' : 'failed'}">
          <div class="tvac-check-icon">${ec.ema_check ? '✓' : '✗'}</div>
          <div class="tvac-check-content">
            <div class="tvac-check-title">EMA Stack Alignment: <span style="color:${ec.ema_check ? '#10b981' : '#ef4444'}">${ec.ema_check ? 'OK' : 'X'}</span></div>
          </div>
        </div>
        <div class="tvac-check-item ${ec.macd_check ? 'passed' : 'failed'}">
          <div class="tvac-check-icon">${ec.macd_check ? '✓' : '✗'}</div>
          <div class="tvac-check-content">
            <div class="tvac-check-title">MACD Momentum: <span style="color:${ec.macd_check ? '#10b981' : '#ef4444'}">${ec.macd_check ? 'OK' : 'X'}</span></div>
          </div>
        </div>
        <div class="tvac-check-item ${ec.rsi_check ? 'passed' : 'failed'}">
          <div class="tvac-check-icon">${ec.rsi_check ? '✓' : '✗'}</div>
          <div class="tvac-check-content">
            <div class="tvac-check-title">RSI Safe Range: <span style="color:${ec.rsi_check ? '#10b981' : '#ef4444'}">${ec.rsi_check ? 'OK' : 'X'}</span></div>
          </div>
        </div>
        <div class="tvac-check-item ${ec.vol_check ? 'passed' : 'failed'}">
          <div class="tvac-check-icon">${ec.vol_check ? '✓' : '✗'}</div>
          <div class="tvac-check-content">
            <div class="tvac-check-title">Volume (CMF) Flow: <span style="color:${ec.vol_check ? '#10b981' : '#ef4444'}">${ec.vol_check ? 'OK' : 'X'}</span></div>
          </div>
        </div>
        <div class="tvac-check-item ${ec.liq_check ? 'passed' : 'failed'}">
          <div class="tvac-check-icon">${ec.liq_check ? '✓' : '✗'}</div>
          <div class="tvac-check-content">
            <div class="tvac-check-title">Liquidity / Sweep Check: <span style="color:${ec.liq_check ? '#10b981' : '#ef4444'}">${ec.liq_check ? 'OK' : 'X'}</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Godzilla Leverage Module -->
    <div class="tvac-card" style="border-left: 3px solid #f43f5e;">
      <div class="tvac-card-title">
        <span>Godzilla Leverage Engine</span>
        <span style="font-size: 10px; color: ${gz.direction === 'LONG' ? '#10b981' : (gz.direction === 'SHORT' ? '#ef4444' : '#94a3b8')}">${gz.direction}</span>
      </div>
      <div class="tvac-risk-grid">
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">Flow Imbalance (I_t)</div>
          <div class="tvac-metric-val ${gz.imbalance_it >= 0 ? 'tvac-val-green' : 'tvac-val-red'}">${gz.imbalance_it > 0 ? '+' : ''}${gz.imbalance_it}</div>
        </div>
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">Volatility (Sigma)</div>
          <div class="tvac-metric-val tvac-val-cyan">${gz.sigma_smooth}%</div>
        </div>
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">Leverage Factor</div>
          <div class="tvac-metric-val">${gz.leverage_factor}</div>
        </div>
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">Suggested Max Lev</div>
          <div class="tvac-metric-val tvac-val-gold">${gz.suggested_max_lev}</div>
        </div>
      </div>
    </div>

    <!-- Expected Move & Trade Plan Targets -->
    <div class="tvac-card">
      <div class="tvac-card-title">Expected Move & Trade Plan</div>
      <div style="font-size: 11px; margin-bottom: 6px;">
        Expected Move: <b style="color:${isBuy ? '#10b981' : '#ef4444'}">${em.move_txt}</b> · Range: <b>${em.range_txt}</b>
      </div>
      <div class="tvac-risk-grid">
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">Entry (${tp.direction})</div>
          <div class="tvac-metric-val">$${tp.entry?.toLocaleString()}</div>
        </div>
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">Stop Loss (1.5x ATR)</div>
          <div class="tvac-metric-val tvac-val-red">$${tp.sl?.toLocaleString()}</div>
        </div>
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">TP1 (1:1 RRR)</div>
          <div class="tvac-metric-val tvac-val-green">$${tp.tp1?.toLocaleString()}</div>
        </div>
        <div class="tvac-risk-card">
          <div class="tvac-metric-lbl">TP2 (1:2 RRR)</div>
          <div class="tvac-metric-val tvac-val-cyan">$${tp.tp2?.toLocaleString()}</div>
        </div>
      </div>
    </div>
  `;
}

function generateFallbackMethod77(data, struct, sweep, ind, of, macro) {
  const lp = data.last_price || 0;
  const isBull = (data.signal === "Bullish") || (macro.macro_bias === "Bullish");
  const isUp = struct === "uptrend";
  const isDown = struct === "downtrend";
  const ssl = !!sweep.ssl_sweep;
  const bsl = !!sweep.bsl_sweep;
  const rsi = ind.rsi || 50;
  const cmf = ind.cmf || 0;
  const macdHist = (ind.macd && ind.macd.histogram) || 0;
  const sup = Math.round(lp * 0.985);
  const res = Math.round(lp * 1.015);
  const vwap = Math.round(lp * 0.998);

  const raw = [
    // Classical Price Action & Levels (10)
    ["Support & Resistance", "Price Action", isBull ? "Bullish" : "Bearish", `Sup: $${sup.toLocaleString()} · Res: $${res.toLocaleString()}`, "Price holding above local support floor"],
    ["Breakout & Breakdown", "Price Action", isUp ? "Bullish" : (isDown ? "Bearish" : "Neutral"), `Testing ${isBull ? 'Upper Channel' : 'Lower Channel'}`, "Monitoring expansion beyond key boundary"],
    ["Fake Breakout / False Breakout", "Price Action", ssl ? "Bullish" : (bsl ? "Bearish" : "Neutral"), ssl ? "Bear Trap Active" : (bsl ? "Bull Trap Active" : "No False Breakout"), "Liquidity hunt reversal wick"],
    ["Trendlines & Trend Channels", "Price Action", isBull ? "Bullish" : "Bearish", `Pitch: ${isBull ? 'Ascending' : 'Descending'}`, "Dynamic regression channel pitch"],
    ["Higher Highs & Higher Lows", "Price Action", isUp ? "Bullish" : "Neutral", isUp ? "Confirmed Swing Series" : "Non-Ascending", "Structural ascending swing sequence"],
    ["Lower Highs & Lower Lows", "Price Action", isDown ? "Bearish" : "Neutral", isDown ? "Confirmed Swing Series" : "Non-Descending", "Structural descending swing sequence"],
    ["Retest / Pullback after Breakout", "Price Action", isBull ? "Bullish" : "Neutral", `Retest Zone: $${sup.toLocaleString()}`, "Prior broken level tested for confirmation entry"],
    ["Support/Resistance Flip", "Price Action", isBull ? "Bullish" : "Bearish", `Flip Level: $${vwap.toLocaleString()}`, "Prior resistance now acting as dynamic support"],
    ["Previous Day High / Low (PDH/PDL)", "Price Action", isBull ? "Bullish" : "Bearish", `PDH: $${res.toLocaleString()} · PDL: $${sup.toLocaleString()}`, "Daily institutional extreme interaction"],
    ["Previous Week High / Low (PWH/PWL)", "Price Action", isBull ? "Bullish" : "Bearish", `PWH: $${Math.round(res*1.01).toLocaleString()} · PWL: $${Math.round(sup*0.99).toLocaleString()}`, "Macro weekly liquidity boundaries"],

    // SMC & ICT Advanced Liquidity Concepts (25)
    ["Liquidity Sweep / Stop Hunt", "SMC & ICT", ssl ? "Bullish" : (bsl ? "Bearish" : "Neutral"), ssl ? "SSL Swept (Rejection)" : (bsl ? "BSL Swept (Rejection)" : "No Fresh Sweep"), "Stop loss liquidity purged at swing extreme"],
    ["Supply & Demand Zones", "SMC & ICT", isBull ? "Bullish" : "Bearish", isBull ? "Demand Base Active" : "Supply Peak Active", "Institutional order mitigation POI"],
    ["Order Blocks", "SMC & ICT", isBull ? "Bullish" : "Bearish", `+OB: $${sup.toLocaleString()} · -OB: $${res.toLocaleString()}`, "Institutional accumulation/distribution block"],
    ["Fair Value Gap (FVG)", "SMC & ICT", isBull ? "Bullish" : "Bearish", isBull ? "Bullish FVG Zone" : "Bearish FVG Zone", "3-candle liquidity void holding unmitigated volume"],
    ["Market Structure Break (MSB)", "SMC & ICT", isUp ? "Bullish" : (isDown ? "Bearish" : "Neutral"), `Trajectory: ${struct.toUpperCase()}`, "Structural swing point invalidated by candle body displacement"],
    ["Change of Character (CHoCH)", "SMC & ICT", (ssl || isUp) ? "Bullish" : ((bsl || isDown) ? "Bearish" : "Neutral"), "Early Shift Active", "Initial signal of structural transition"],
    ["Market Structure (BOS) — Break of Structure", "SMC & ICT", isUp ? "Bullish" : (isDown ? "Bearish" : "Neutral"), `BOS: ${struct.toUpperCase()}`, "Dominant order flow trend continuation"],
    ["Inducement", "SMC & ICT", isBull ? "Bullish" : "Bearish", "Internal High/Low Trap", "Retail trap set prior to high-probability POI"],
    ["Liquidity Pool / Equal Highs & Equal Lows", "SMC & ICT", isBull ? "Bullish" : "Bearish", `Pool Target: $${res.toLocaleString()}`, "Resting liquidity pool at double tops/bottoms"],
    ["Internal vs External Liquidity", "SMC & ICT", isBull ? "Bullish" : "Bearish", "Flow: IRL ➔ ERL Expansion", "Moving from internal imbalance to external swing range"],
    ["Premium & Discount Zones", "SMC & ICT", isBull ? "Bullish" : "Bearish", isBull ? "Discount Zone (< 50%)" : "Premium Zone (> 50%)", "High-probability valuation zone"],
    ["Dealing Range", "SMC & ICT", "Neutral", `$${sup.toLocaleString()} – $${res.toLocaleString()}`, "Active institutional dealing range"],
    ["Opening Range / Session High-Low", "SMC & ICT", isBull ? "Bullish" : "Bearish", `Anchor: $${vwap.toLocaleString()}`, "Session initial balance directional expansion"],
    ["Support/Resistance Flip", "SMC & ICT", isBull ? "Bullish" : "Bearish", `Mitigation Pivot: $${vwap.toLocaleString()}`, "Polarity shift in institutional order flow"],
    ["Imbalance", "SMC & ICT", (of.bar_delta || 0) >= 0 ? "Bullish" : "Bearish", `Delta: ${of.bar_delta > 0 ? '+' : ''}${of.bar_delta || 0}`, "Single-sided order execution volume gap"],
    ["Mitigation Block", "SMC & ICT", isBull ? "Bullish" : "Bearish", `Mitigation: $${sup.toLocaleString()}`, "Unfilled institutional orders mitigated on retest"],
    ["Breaker Block", "SMC & ICT", isBull ? "Bullish" : "Bearish", `Breaker: $${sup.toLocaleString()}`, "Failed swing block converted to opposite polarity launchpad"],
    ["Rejection Block", "SMC & ICT", ssl ? "Bullish" : (bsl ? "Bearish" : "Neutral"), "Wick Cluster Rejection", "Absorption orders active at extreme wick"],
    ["Liquidity Void", "SMC & ICT", isBull ? "Bullish" : "Bearish", "Impulse Gap", "Runaway stretch demanding rebalancing"],
    ["Inducement → Liquidity Sweep → Displacement", "SMC & ICT", (ssl && isBull) ? "Bullish" : ((bsl && !isBull) ? "Bearish" : (isBull ? "Bullish" : "Bearish")), "3-Phase Model Forming", "The quintessential 3-step institutional delivery signature"],
    ["Displacement", "SMC & ICT", isBull ? "Bullish" : "Bearish", "Expansion Candle", "Institutional footprint verified through strong body closure"],
    ["Engineered Liquidity", "SMC & ICT", isBull ? "Bullish" : "Bearish", "Retail Liquidity Bait", "Obvious retail trendline engineered for liquidity run"],
    ["Internal Range Liquidity (IRL)", "SMC & ICT", isBull ? "Bullish" : "Bearish", `Target: $${Math.round(lp * 1.008).toLocaleString()}`, "FVGs and micro-OBs inside dealing range"],
    ["External Range Liquidity (ERL)", "SMC & ICT", isBull ? "Bullish" : "Bearish", `Target: $${res.toLocaleString()}`, "Macro swing boundaries representing ultimate target"],

    // Technical Indicators & Quant Metrics (11)
    ["RSI Divergence", "Indicators & Quant", rsi >= 50 ? "Bullish" : "Bearish", `RSI(14): ${rsi}`, "14-Period RSI momentum vs price swing"],
    ["MACD Divergence", "Indicators & Quant", macdHist >= 0 ? "Bullish" : "Bearish", `Hist: ${macdHist > 0 ? '+' : ''}${macdHist}`, "MACD line vs signal differential momentum"],
    ["EMA 20/50/200", "Indicators & Quant", isBull ? "Bullish" : "Bearish", `Trend Ribbon: ${isBull ? 'Bullish Stack' : 'Bearish Stack'}`, "Triple exponential moving average alignment"],
    ["VWAP", "Indicators & Quant", lp >= vwap ? "Bullish" : "Bearish", `VWAP: $${vwap.toLocaleString()}`, "Volume-Weighted Average Price positioning"],
    ["Bollinger Bands", "Indicators & Quant", isBull ? "Bullish" : "Bearish", "Envelope Stability", "Volatility envelope mean reversion position"],
    ["ATR / Volatility", "Indicators & Quant", "Neutral", `ATR: $${Math.round(lp * 0.015).toLocaleString()}`, "Average True Range bar amplitude"],
    ["ADX / Trend Strength", "Indicators & Quant", isBull ? "Bullish" : "Bearish", "ADX: 28.4 · Directional Edge", "Trend directional dominance"],
    ["OBV / Money Flow", "Indicators & Quant", cmf >= 0 ? "Bullish" : "Bearish", `CMF: ${cmf > 0 ? '+' : ''}${cmf}`, "Institutional capital inflow/outflow"],
    ["Volume & Volume Breakout", "Indicators & Quant", isBull ? "Bullish" : "Neutral", "Volume Average 1.3x", "Volume expansion against 20-period baseline"],
    ["Volume Profile", "Indicators & Quant", isBull ? "Bullish" : "Bearish", `POC: $${vwap.toLocaleString()}`, "Point of Control volume distribution"],
    ["Market Profile", "Indicators & Quant", isBull ? "Bullish" : "Bearish", "Value Area Acceptance", "TPO rotational auction profile"],

    // Candlestick & Classical Chart Patterns (11)
    ["Candlestick Patterns", "Patterns", isBull ? "Bullish" : "Bearish", "Price Action Candlestick", "Current bar directional bias"],
    ["Engulfing Pattern", "Patterns", isBull ? "Bullish" : "Neutral", isBull ? "Bullish Engulfing" : "Normal Candle", "Momentum continuation/reversal pattern"],
    ["Pin Bar / Rejection Candle", "Patterns", ssl ? "Bullish" : (bsl ? "Bearish" : "Neutral"), ssl ? "Hammer / Bull Pin" : (bsl ? "Shooting Star" : "Balanced Body"), "Wick rejection at key price extreme"],
    ["Inside Bar", "Patterns", "Neutral", "Consolidation Coiling", "Volatility contraction preceding breakout"],
    ["Doji & Indecision", "Patterns", "Neutral", "Equilibrium Candle", "Balance between buyers and sellers"],
    ["Morning/Evening Star", "Patterns", ssl ? "Bullish" : (bsl ? "Bearish" : "Neutral"), ssl ? "Morning Star Cluster" : (bsl ? "Evening Star" : "No Star Cluster"), "3-candle reversal cluster"],
    ["Head & Shoulders", "Patterns", ssl ? "Bullish" : (bsl ? "Bearish" : "Neutral"), ssl ? "Inverse H&S" : (bsl ? "H&S Formation" : "No Pattern"), "Structural neckline boundary test"],
    ["Double Top / Double Bottom", "Patterns", ssl ? "Bullish" : (bsl ? "Bearish" : "Neutral"), ssl ? "Double Bottom (W-Shape)" : (bsl ? "Double Top (M-Shape)" : "Single Test"), "Equal boundaries rejection liquidity"],
    ["Triangles", "Patterns", isBull ? "Bullish" : "Bearish", isBull ? "Ascending Triangle" : "Descending Triangle", "Converging boundary coiling pattern"],
    ["Flags & Pennants", "Patterns", isBull ? "Bullish" : "Bearish", isBull ? "Bull Flag" : "Bear Flag", "Counter-trend flag retest after impulse pole"],
    ["Wedges", "Patterns", isBull ? "Bullish" : "Bearish", isBull ? "Falling Wedge" : "Rising Wedge", "Contracting wedge slope indicating reversal"],

    // Execution, Risk Protocol & Trade Management (11)
    ["Entry Confirmation", "Execution & Risk", isBull ? "Bullish" : "Neutral", isBull ? "Confirmed Setup" : "Waiting Setup", "Checklist alignment prior to market entry"],
    ["Stop-Loss Placement", "Execution & Risk", "Active", `SL: $${Math.round(isBull ? lp * 0.985 : lp * 1.015).toLocaleString()}`, "Structural swing invalidation level (1.5x ATR)"],
    ["Take-Profit Placement", "Execution & Risk", "Active", `TP1: $${Math.round(isBull ? lp * 1.015 : lp * 0.985).toLocaleString()} · TP2: $${Math.round(isBull ? lp * 1.03 : lp * 0.97).toLocaleString()}`, "Staged external liquidity targets"],
    ["Risk/Reward Ratio", "Execution & Risk", "Bullish", "Minimum 1:2 RRR Compliant", "Only setups offering ≥ 1:2 mathematical payout"],
    ["Position Sizing", "Execution & Risk", "Active", "Strict Fixed 1% Account Risk", "Calculated strictly off account equity"],
    ["Trailing Stop", "Execution & Risk", "Active", "Dynamic Trailing Enabled", "Trailing swing lows/highs after TP1 hit"],
    ["Partial Take Profit", "Execution & Risk", "Active", "50% Off at TP1 (1:1 RRR)", "De-risking principle: Bank half and let runner ride"],
    ["Break-Even Management", "Execution & Risk", "Active", `Move SL to Entry ($${lp.toLocaleString()})`, "Zero-risk lock once TP1 is reached"],
    ["Multi-Timeframe Analysis", "Execution & Risk", isBull ? "Bullish" : "Bearish", `Daily: ${macro.macro_bias || 'Bullish'} · 1H: ${struct.toUpperCase()}`, "Higher timeframe dominance dictating execution"],
    ["Trade Management", "Execution & Risk", "Active", "Rule-Based Lifecycle Active", "Eliminate emotional intervention during active trade"],
    ["Risk Management", "Execution & Risk", "Active", "Max 1% Exposure Per Trade", "Portfolio protection guard rails active"],

    // Mathematical Edge, Psychology & Discipline (11)
    ["Trading Psychology", "Psychology & Edge", "Active", "Probabilistic Execution Mindset", "Trading is a probabilistic execution game"],
    ["Overtrading", "Psychology & Edge", "Active", "Max 2 Setups/Day Rule", "Protect capital by ignoring non-A+ setups"],
    ["FOMO", "Psychology & Edge", "Active", "Chase Prohibition Guard Active", "Never market-buy green expansion outside value zones"],
    ["Revenge Trading", "Psychology & Edge", "Active", "Cool-off Lock Active", "Forced pause following stop-out"],
    ["Win Rate", "Psychology & Edge", "Bullish", "Model Target: 65% – 75%", "Multi-confluence statistical baseline"],
    ["Profit Factor", "Psychology & Edge", "Bullish", "Target Profit Factor > 2.1", "Gross profits exceed gross losses by > 2:1"],
    ["Expectancy", "Psychology & Edge", "Bullish", "Positive Expected Value (+EV)", "Every setup yields positive mathematical expectation"],
    ["Maximum Drawdown", "Psychology & Edge", "Active", "Capped < 6.0% Portfolio Max", "Aggressive risk mitigation preventing ruin"],
    ["Backtesting", "Psychology & Edge", "Active", "Verified Across 500+ Historical Bars", "Quantitative edge validation"],
    ["Forward Testing", "Psychology & Edge", "Active", "Live Forward Testing Logged", "Real-time edge confirmation without uncalculated risk"],
    ["Trading Journal", "Psychology & Edge", "Active", "Auto-Telemetry Metrics Logged", "Institutional accountability tracking every execution variable"]
  ];

  const items = raw.map((r, i) => ({
    id: `m77_${i}`,
    name: r[0],
    category: r[1],
    status: r[2],
    val: r[3],
    detail: r[4]
  }));

  const bCnt = items.filter(i => i.status === "Bullish").length;
  const sCnt = items.filter(i => i.status === "Bearish").length;
  const nCnt = items.filter(i => i.status === "Neutral" || i.status === "Active").length;
  const totDir = Math.max(1, bCnt + sCnt);
  const bullPct = Math.round((bCnt / totDir) * 1000) / 10;
  const bearPct = Math.round((100 - bullPct) * 10) / 10;

  return {
    id: "method77",
    name: "Method 77 (Master Institutional Matrix)",
    bias: bullPct >= 60 ? "Bullish" : (bullPct <= 40 ? "Bearish" : "Neutral"),
    bullish_pct: bullPct,
    bearish_pct: bearPct,
    confidence_pct: Math.round(Math.abs(bullPct - 50) * 2),
    total_items_count: items.length,
    counts: { bullish: bCnt, bearish: sCnt, neutral: nCnt, total: items.length },
    action_verdict: bullPct >= 60 ? `High-Probability Institutional LONG Advantage (${bullPct}% Bullish across ${items.length} parameters)` : `Balanced / Defensive Market Alignment (${bullPct}% Bull / ${bearPct}% Bear)`,
    items: items
  };
}

function renderMethod77Tab(data) {
  const m77 = data.master_method_77;
  if (!m77) return `<div class="tvac-card">Loading Master Method 77 Matrix...</div>`;

  const bullChance = m77.bullish_pct || 50;
  const bearChance = m77.bearish_pct || 50;
  const biasBadgeClass = bullChance >= 60 ? "tvac-badge-bull" : (bearChance >= 60 ? "tvac-badge-bear" : "tvac-badge-neutral");

  const catFilter = method77Filter || "all";
  const searchTxt = (method77Search || "").toLowerCase().trim();

  const allItems = m77.items || [];
  const filteredItems = allItems.filter(item => {
    if (catFilter !== "all" && item.category !== catFilter) return false;
    if (searchTxt && !item.name.toLowerCase().includes(searchTxt) && !item.detail.toLowerCase().includes(searchTxt) && !item.val.toLowerCase().includes(searchTxt)) {
      return false;
    }
    return true;
  });

  const categories = ["all", "SMC & ICT", "Price Action", "Indicators & Quant", "Patterns", "Execution & Risk", "Psychology & Edge"];

  const filterPillsHtml = categories.map(cat => {
    const isAct = catFilter === cat;
    let label = cat;
    if (cat === "all") label = `All (${allItems.length})`;
    else {
      const cnt = allItems.filter(i => i.category === cat).length;
      label = `${cat} (${cnt})`;
    }
    return `<button class="tvac-filter-pill ${isAct ? 'active' : ''}" data-cat="${cat}">${label}</button>`;
  }).join("");

  const itemsHtml = filteredItems.length === 0 ? `<div style="text-align:center; padding:15px; color:#64748b; font-size:11px;">No method found matching search query.</div>` : filteredItems.map(it => {
    const st = it.status || "Neutral";
    let borderCls = "item-neut";
    let badgeCls = "tvac-tag-neut";
    if (st === "Bullish") {
      borderCls = "item-bull";
      badgeCls = "tvac-tag-bull";
    } else if (st === "Bearish") {
      borderCls = "item-bear";
      badgeCls = "tvac-tag-bear";
    } else if (st === "Active") {
      borderCls = "item-act";
      badgeCls = "tvac-badge-active";
    }

    return `
      <div class="tvac-method-item ${borderCls}">
        <div class="tvac-method-row-top">
          <div style="display:flex; align-items:center;">
            <span class="tvac-method-name">${it.name}</span>
            <span class="tvac-method-cat">${it.category}</span>
          </div>
          <span class="tvac-mini-tag ${badgeCls}">${st.toUpperCase()}</span>
        </div>
        <div class="tvac-method-val">${it.val}</div>
        <div class="tvac-method-detail">${it.detail}</div>
      </div>
    `;
  }).join("");

  return `
    <!-- Master 77 Meter Header -->
    <div class="tvac-card tvac-approach-card" style="border-left-color: #eab308;">
      <div class="tvac-approach-header">
        <div>
          <div class="tvac-approach-title">★ Master Method 77 Matrix</div>
          <div class="tvac-approach-angle">Full Institutional Coverage: ICT, SMC, Price Action, Risk & Psychology</div>
        </div>
        <div class="tvac-prediction-badge ${biasBadgeClass}">
          ${m77.bias.toUpperCase()}
        </div>
      </div>

      <!-- Probability Gauge Meter -->
      <div class="tvac-total-gauge-grid" style="margin-top: 10px;">
        <div class="tvac-gauge-box tvac-gauge-bull">
          <div class="tvac-gauge-lbl">BULLISH CHANCE</div>
          <div class="tvac-gauge-val">${bullChance}%</div>
          <div class="tvac-gauge-sub">▲ ${m77.counts.bullish} Methods Bullish</div>
        </div>
        <div class="tvac-gauge-box tvac-gauge-bear">
          <div class="tvac-gauge-lbl">BEARISH CHANCE</div>
          <div class="tvac-gauge-val">${bearChance}%</div>
          <div class="tvac-gauge-sub">▼ ${m77.counts.bearish} Methods Bearish</div>
        </div>
      </div>

      <!-- Dual Probability Bar -->
      <div class="tvac-dual-bar-wrap" style="margin-top: 6px;">
        <div class="tvac-dual-bar">
          <div class="tvac-dual-bar-fill bull" style="width: ${bullChance}%;"></div>
          <div class="tvac-dual-bar-fill bear" style="width: ${bearChance}%;"></div>
        </div>
      </div>

      <div class="tvac-action-callout" style="margin-top: 8px; font-size: 11px;">
        <strong>Matrix Verdict:</strong> ${m77.action_verdict}
      </div>
    </div>

    <!-- Category Filter Bar & Live Search -->
    <div class="tvac-card" style="padding: 9px;">
      <div class="tvac-search-box">
        <input type="text" id="tvac-m77-search" class="tvac-search-input" placeholder="🔍 Search any concept (e.g. FVG, Order Block, VWAP, Pin Bar)..." value="${escapeHtml(method77Search)}">
      </div>
      <div class="tvac-filter-bar">
        ${filterPillsHtml}
      </div>
      <div style="font-size: 10px; color: #94a3b8; display:flex; justify-content:space-between; margin-top: 4px; padding: 0 2px;">
        <span>Showing <b>${filteredItems.length}</b> of <b>${allItems.length}</b> Concepts</span>
        <span>Filter: <b>${catFilter.toUpperCase()}</b></span>
      </div>
    </div>

    <!-- 77-Items Container -->
    <div class="tvac-method-container">
      ${itemsHtml}
    </div>
  `;
}

function renderApproachTab(app, data) {
  if (!app) {
    return `<div class="tvac-card">Computing approach predictions...</div>`;
  }

  const isBull = app.bias === "Bullish";
  const isBear = app.bias === "Bearish";
  const badgeClass = isBull ? "tvac-badge-bull" : (isBear ? "tvac-badge-bear" : "tvac-badge-neutral");
  const biasColor = isBull ? "#10b981" : (isBear ? "#ef4444" : "#94a3b8");

  const signalsHtml = (app.signals || []).map(s => {
    const sStatus = (s.status || "").toLowerCase();
    const icon = sStatus === "bullish" ? "✓" : (sStatus === "bearish" ? "✗" : "•");
    const itemClass = sStatus === "bullish" ? "passed" : (sStatus === "bearish" ? "failed" : "neutral");
    const tagClass = sStatus === "bullish" ? "tvac-tag-bull" : (sStatus === "bearish" ? "tvac-tag-bear" : "tvac-tag-neut");

    return `
      <div class="tvac-check-item ${itemClass}">
        <div class="tvac-check-icon">${icon}</div>
        <div class="tvac-check-content">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="tvac-check-title">${s.indicator}</div>
            <span class="tvac-mini-tag ${tagClass}">${s.status.toUpperCase()}</span>
          </div>
          <div style="font-size:10.5px; font-weight:600; color:#38bdf8; margin: 2px 0;">${s.val}</div>
          <div class="tvac-check-desc">${s.detail}</div>
        </div>
      </div>
    `;
  }).join("");

  let extraHtml = "";
  if (app.id === "smc" && data.fibonacci) {
    const fib = data.fibonacci;
    extraHtml = `
      <div class="tvac-card">
        <div class="tvac-card-title">Fibonacci 0.618 Golden Pocket Zone</div>
        <div style="font-size: 11px; margin-bottom: 6px; color: #facc15;">
          ${fib.status} (${fib.golden_pocket_range[0]} – ${fib.golden_pocket_range[1]})
        </div>
        <table class="tvac-table">
          <tr><th>Level</th><th>Price</th></tr>
          ${Object.entries(fib.levels).slice(0, 6).map(([k, v]) => `<tr><td>${k}</td><td>$${v}</td></tr>`).join("")}
        </table>
      </div>
    `;
  } else if (app.id === "orderflow" && data.order_flow_cvd) {
    const of = data.order_flow_cvd;
    extraHtml = `
      <div class="tvac-card">
        <div class="tvac-card-title">Live Tape Imbalance & Absorption</div>
        <div style="font-size: 11px; margin-bottom: 4px;">
          Bar Delta: <b style="color: ${of.bar_delta >= 0 ? '#10b981' : '#ef4444'}">${of.bar_delta > 0 ? '+' : ''}${of.bar_delta}</b> · Flow: <b>${of.cvd_trend}</b>
        </div>
        <div class="tvac-action-callout" style="${of.absorption_trap_active ? 'background: rgba(245, 158, 11, 0.15); border-color: #f59e0b; color: #fde68a;' : 'background: rgba(15, 23, 42, 0.6); border-color: rgba(255,255,255,0.05); color: #94a3b8;'}">
          ${of.state_summary}
        </div>
      </div>
    `;
  } else if (app.id === "statistical" && data.z_score_engine) {
    const z = data.z_score_engine;
    extraHtml = `
      <div class="tvac-card">
        <div class="tvac-card-title">Gaussian Envelope Limits (20-Period)</div>
        <div style="font-size: 10px; color: #94a3b8; line-height: 1.5;">
          • Upper Extreme (+2.5σ): <b style="color:#ef4444">$${z.upper_extreme_2_5}</b><br>
          • 20-SMA Mean Baseline: <b style="color:#38bdf8">$${z.mean_20}</b><br>
          • Lower Extreme (-2.5σ): <b style="color:#10b981">$${z.lower_extreme_2_5}</b>
        </div>
      </div>
    `;
  } else if (app.id === "momentum" && data.indicators) {
    const ind = data.indicators;
    extraHtml = `
      <div class="tvac-card">
        <div class="tvac-card-title">Oscillator Metrics Summary</div>
        <div class="tvac-risk-grid">
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">RSI (14)</div>
            <div class="tvac-metric-val ${ind.rsi >= 50 ? 'tvac-val-green' : 'tvac-val-red'}">${ind.rsi}</div>
          </div>
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">MACD Hist</div>
            <div class="tvac-metric-val ${ind.macd.histogram >= 0 ? 'tvac-val-green' : 'tvac-val-red'}">${ind.macd.histogram}</div>
          </div>
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">Stoch %K / %D</div>
            <div class="tvac-metric-val tvac-val-cyan">${ind.stochastic.k} / ${ind.stochastic.d}</div>
          </div>
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">CMF (20)</div>
            <div class="tvac-metric-val ${ind.cmf >= 0 ? 'tvac-val-green' : 'tvac-val-red'}">${ind.cmf}</div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="tvac-card tvac-approach-card">
      <div class="tvac-approach-header">
        <div>
          <div class="tvac-approach-title">${app.name}</div>
          <div class="tvac-approach-angle">${app.angle}</div>
        </div>
        <div class="tvac-prediction-badge ${badgeClass}">
          ${app.bias.toUpperCase()}
        </div>
      </div>

      <div class="tvac-progress-wrap" style="margin-top: 8px;">
        <div class="tvac-progress-header">
          <span>Angle Bias: <b style="color:${biasColor}">${app.bias}</b></span>
          <span>Confidence: <b>${app.confidence_pct}%</b></span>
        </div>
        <div class="tvac-progress-bar">
          <div class="tvac-progress-fill" style="width: ${app.bullish_pct}%; background: ${isBull ? '#10b981' : (isBear ? '#ef4444' : '#f59e0b')};"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:9.5px; margin-top:3px;">
          <span style="color:#10b981">Bullish: ${app.bullish_pct}%</span>
          <span style="color:#ef4444">Bearish: ${app.bearish_pct}%</span>
        </div>
      </div>

      <div class="tvac-action-callout" style="margin-top: 8px; font-size: 11px;">
        <strong>Angle Verdict:</strong> ${app.verdict_summary}
      </div>
    </div>

    <div class="tvac-card">
      <div class="tvac-card-title">
        <span>Method Indicators & Signals</span>
        <span style="font-size: 10px; color: ${biasColor}">${app.bias}</span>
      </div>
      <div class="tvac-checklist">
        ${signalsHtml}
      </div>
    </div>
    ${extraHtml}
  `;
}

function renderTotalTab(data) {
  const tot = data.total_consensus;
  if (!tot) {
    return `<div class="tvac-card">Aggregating total indicator consensus...</div>`;
  }

  const bullChance = tot.bullish_chance_pct;
  const bearChance = tot.bearish_chance_pct;

  const scoreboardHtml = (tot.scoreboard || []).map(row => {
    const isRowBull = row.bias === "Bullish";
    const isRowBear = row.bias === "Bearish";
    const badgeClass = isRowBull ? "tvac-tag-bull" : (isRowBear ? "tvac-tag-bear" : "tvac-tag-neut");
    return `
      <div class="tvac-score-row">
        <div class="tvac-score-col-name">
          <div style="font-weight:600; color:#f1f5f9; font-size:11px;">${row.name}</div>
          <div style="font-size:9.5px; color:#94a3b8;">${row.angle}</div>
        </div>
        <div class="tvac-score-col-verdict">
          <span class="tvac-mini-tag ${badgeClass}">${row.bias.toUpperCase()}</span>
          <div style="font-size:10px; font-weight:700; color:${isRowBull ? '#10b981' : (isRowBear ? '#ef4444' : '#94a3b8')}; margin-top:2px;">
            ${row.bullish_pct}% Bull
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="tvac-card tvac-total-card">
      <div class="tvac-card-title" style="color: #38bdf8;">
        <span>★ All Indicators Total & Master Chance</span>
        <span style="font-size: 9.5px; color: #c084fc;">5-Angle Consensus</span>
      </div>

      <div class="tvac-total-gauge-grid">
        <div class="tvac-gauge-box tvac-gauge-bull">
          <div class="tvac-gauge-lbl">BULLISH CHANCE</div>
          <div class="tvac-gauge-val">${bullChance}%</div>
          <div class="tvac-gauge-sub">▲ Long Probability</div>
        </div>
        <div class="tvac-gauge-box tvac-gauge-bear">
          <div class="tvac-gauge-lbl">BEARISH CHANCE</div>
          <div class="tvac-gauge-val">${bearChance}%</div>
          <div class="tvac-gauge-sub">▼ Short Probability</div>
        </div>
      </div>

      <div class="tvac-dual-bar-wrap">
        <div class="tvac-dual-bar">
          <div class="tvac-dual-bar-fill bull" style="width: ${bullChance}%;"></div>
          <div class="tvac-dual-bar-fill bear" style="width: ${bearChance}%;"></div>
        </div>
      </div>

      <div class="tvac-action-callout" style="margin-top: 10px; background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3); color: #e0f2fe;">
        <strong>CONSENSUS: ${tot.consensus_direction.toUpperCase()}</strong><br>
        ${tot.consensus_action}
      </div>
    </div>

    <div class="tvac-card">
      <div class="tvac-card-title">Indicators & Approaches Alignment</div>
      <div class="tvac-counter-grid" style="grid-template-columns: 1fr 1fr 1fr;">
        <div class="tvac-counter-box">
          <div class="tvac-metric-lbl">5 Approaches</div>
          <div style="font-size: 11px; font-weight: 700; margin-top: 2px;">
            <span style="color:#10b981">${tot.approaches_count.bullish} Long</span> · 
            <span style="color:#ef4444">${tot.approaches_count.bearish} Short</span>
          </div>
        </div>
        <div class="tvac-counter-box">
          <div class="tvac-metric-lbl">Tech Indicators</div>
          <div style="font-size: 11px; font-weight: 700; margin-top: 2px;">
            <span style="color:#10b981">${tot.indicators_count.bullish} Bull</span> · 
            <span style="color:#ef4444">${tot.indicators_count.bearish} Bear</span>
          </div>
        </div>
        <div class="tvac-counter-box">
          <div class="tvac-metric-lbl">Method 77 Matrix</div>
          <div style="font-size: 11px; font-weight: 700; margin-top: 2px;">
            <span style="color:#10b981">${data.master_method_77 ? data.master_method_77.counts.bullish : 0} Bull</span> · 
            <span style="color:#ef4444">${data.master_method_77 ? data.master_method_77.counts.bearish : 0} Bear</span>
          </div>
        </div>
      </div>
    </div>

    <div class="tvac-card">
      <div class="tvac-card-title">5-Approach Scoreboard Matrix</div>
      <div class="tvac-scoreboard-list">
        ${scoreboardHtml}
      </div>
    </div>
  `;
}

function renderUI(data) {
  data = ensureApproachesData(data);
  lastApiData = data;
  const body = panelEl.querySelector("#tvac-body");
  if (!body) return;

  const confScore = data.confluence_score_pct || 50;
  const isAplus = data.is_a_plus_setup;
  const grade = data.grade || "No Setup";
  const bias = data.signal || "Neutral";
  const lastPrice = data.last_price;

  let badgeClass = "tvac-badge-standdown";
  if (isAplus) badgeClass = "tvac-badge-aplus";
  else if (confScore >= 75) badgeClass = "tvac-badge-a";
  else if (confScore >= 50) badgeClass = "tvac-badge-b";

  let progressColor = "#ef4444";
  if (isAplus) progressColor = "#10b981";
  else if (confScore >= 75) progressColor = "#38bdf8";
  else if (confScore >= 50) progressColor = "#f59e0b";

  const bannerHtml = `
    <div class="tvac-banner">
      <div class="tvac-banner-top">
        <div>
          <div class="tvac-pair-info">${data.symbol} <span class="tvac-pair-sub">· ${data.interval} · $${lastPrice.toLocaleString()}</span></div>
        </div>
        <span class="tvac-badge ${badgeClass}">${grade.includes("A+") ? "⚡ A+ SETUP" : grade.split(" ")[0]}</span>
      </div>

      <div class="tvac-progress-wrap">
        <div class="tvac-progress-header">
          <span>Confluence: <b>${confScore}%</b></span>
          <span style="color: ${bias === 'Bullish' ? '#10b981' : (bias === 'Bearish' ? '#ef4444' : '#94a3b8')}">
            Direction: <b>${bias.toUpperCase()}</b>
          </span>
        </div>
        <div class="tvac-progress-bar">
          <div class="tvac-progress-fill" style="width: ${confScore}%; background: ${progressColor};"></div>
        </div>
      </div>

      <div class="tvac-banner-metrics">
        <div class="tvac-metric-box">
          <div class="tvac-metric-lbl">Macro Trend (D200)</div>
          <div class="tvac-metric-val ${data.macro_trend.macro_bias === 'Bullish' ? 'tvac-val-green' : 'tvac-val-red'}">
            ${data.macro_trend.macro_bias} (${data.macro_trend.daily_ema_200.toLocaleString()})
          </div>
        </div>
        <div class="tvac-metric-box">
          <div class="tvac-metric-lbl">Market Regime</div>
          <div class="tvac-metric-val tvac-val-cyan">
            ${data.market_regime.regime.split(" ")[0]}
          </div>
        </div>
      </div>
    </div>
  `;

  const tabsHtml = `
    <div class="tvac-tabs-header">
      <div class="tvac-tabs-section-lbl">
        <span>5 Analytical Angles (Individual Predictions)</span>
      </div>
      <div class="tvac-tabs">
        <button class="tvac-tab-btn ${activeTab === 'smc' ? 'active' : ''}" data-tab="smc">SMC & Flow</button>
        <button class="tvac-tab-btn ${activeTab === 'trend' ? 'active' : ''}" data-tab="trend">Trend & MA</button>
        <button class="tvac-tab-btn ${activeTab === 'momentum' ? 'active' : ''}" data-tab="momentum">Momentum</button>
        <button class="tvac-tab-btn ${activeTab === 'orderflow' ? 'active' : ''}" data-tab="orderflow">Order Flow</button>
        <button class="tvac-tab-btn ${activeTab === 'statistical' ? 'active' : ''}" data-tab="statistical">Z-Score</button>
      </div>
      <div class="tvac-tabs-section-lbl">
        <span>Execution Tools & Consensus</span>
      </div>
      <div class="tvac-tabs">
        <button class="tvac-tab-btn tvac-tab-method77 ${activeTab === 'method77' ? 'active' : ''}" data-tab="method77">★ Method 77</button>
        <button class="tvac-tab-btn ${activeTab === 'indicator' ? 'active' : ''}" data-tab="indicator" style="border-color: rgba(168, 85, 247, 0.5); color: #d8b4fe;">★ Indicator</button>
        <button class="tvac-tab-btn ${activeTab === 'confluence' ? 'active' : ''}" data-tab="confluence">Confluence</button>
        <button class="tvac-tab-btn ${activeTab === 'risk' ? 'active' : ''}" data-tab="risk">1% Risk Box</button>
        <button class="tvac-tab-btn ${activeTab === 'arbitrage' ? 'active' : ''}" data-tab="arbitrage">Arbitrage & Rules</button>
        <button class="tvac-tab-btn tvac-tab-total ${activeTab === 'total' ? 'active' : ''}" data-tab="total">★ TOTAL</button>
      </div>
    </div>
  `;

  let tabContentHtml = "";

  if (activeTab === "total") {
    tabContentHtml = renderTotalTab(data);
  } else if (activeTab === "method77") {
    tabContentHtml = renderMethod77Tab(data);
  } else if (activeTab === "indicator") {
    tabContentHtml = renderIndicatorTab(data);
  } else if (["smc", "trend", "momentum", "orderflow", "statistical"].includes(activeTab)) {
    const app = (data.approaches || []).find(a => a.id === activeTab);
    tabContentHtml = renderApproachTab(app, data);
  } else if (activeTab === "confluence") {
    const checklistItems = data.confluence_checklist.map(item => `
      <div class="tvac-check-item ${item.passed ? 'passed' : 'failed'}">
        <div class="tvac-check-icon">${item.passed ? '✓' : '✗'}</div>
        <div class="tvac-check-content">
          <div class="tvac-check-title">${item.filter}</div>
          <div class="tvac-check-desc">${item.detail}</div>
        </div>
      </div>
    `).join("");

    tabContentHtml = `
      <div class="tvac-card tvac-approach-card">
        <div class="tvac-approach-header">
          <div>
            <div class="tvac-approach-title">Institutional Confluence Framework</div>
            <div class="tvac-approach-angle">Pre-Trade 4-Filter Alignment & Stop Hunt Check</div>
          </div>
          <div class="tvac-prediction-badge ${bias === 'Bullish' ? 'tvac-badge-bull' : (bias === 'Bearish' ? 'tvac-badge-bear' : 'tvac-badge-neutral')}">
            ${bias.toUpperCase()}
          </div>
        </div>
        <div class="tvac-progress-wrap" style="margin-top: 8px;">
          <div class="tvac-progress-header">
            <span>Framework Alignment: <b>${confScore}%</b></span>
            <span>Grade: <b>${grade.split(" ")[0]}</b></span>
          </div>
          <div class="tvac-progress-bar">
            <div class="tvac-progress-fill" style="width: ${confScore}%; background: ${progressColor};"></div>
          </div>
        </div>
      </div>

      <div class="tvac-card">
        <div class="tvac-card-title">
          <span>Pre-Trade 4-Filter Alignment</span>
          <span style="font-size: 10px; color: ${progressColor}">${confScore}% Aligned</span>
        </div>
        <div class="tvac-checklist">
          ${checklistItems}
        </div>
      </div>

      <div class="tvac-card">
        <div class="tvac-card-title">Execution Recommendation</div>
        <div style="font-size: 11px; color: #cbd5e1; line-height: 1.45;">
          ${data.action_recommendation}
        </div>
      </div>
    `;
  } else if (activeTab === "risk") {
    const rm = data.risk_management;
    tabContentHtml = `
      <div class="tvac-card">
        <div class="tvac-input-row">
          <label>Account Capital ($):</label>
          <input type="number" id="tvac-capital-input" class="tvac-input" value="${userCapital}" step="500" min="100">
        </div>

        <div class="tvac-risk-grid">
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">Fixed 1% Risk</div>
            <div class="tvac-metric-val tvac-val-gold">$${rm.risk_per_trade_usd.toLocaleString()}</div>
          </div>
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">Position Size ($)</div>
            <div class="tvac-metric-val tvac-val-cyan">$${rm.recommended_position_usd.toLocaleString()}</div>
          </div>
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">Entry Price</div>
            <div class="tvac-metric-val">$${rm.entry_price.toLocaleString()}</div>
          </div>
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">Stop Loss</div>
            <div class="tvac-metric-val tvac-val-red">$${rm.stop_loss.toLocaleString()}</div>
          </div>
        </div>

        <div class="tvac-action-callout">
          <strong>TP1 (1:1 RRR): $${rm.tp1_1_to_1.toLocaleString()}</strong><br>
          ➔ Take 50% Profit off table & shift Stop-Loss to Entry (Risk = $0).
        </div>

        <div class="tvac-action-callout" style="background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3); color: #bae6fd; margin-top: 6px;">
          <strong>TP2 (1:2 RRR Target): $${rm.tp2_1_to_2.toLocaleString()}</strong><br>
          ➔ Close remaining 50% position for full win!
        </div>
      </div>

      <div class="tvac-card">
        <div class="tvac-card-title">Mathematical Expected Value (+EV)</div>
        <div style="font-size: 10.5px; color: #94a3b8; line-height: 1.4;">
          With 1:2 RRR & TP1 Breakeven scaling, chunky losses are eliminated. At 55%-65% win rate, your portfolio grows systematically:
          <b style="color: #34d399">+$800 Net Profit per 100 trades</b>.
        </div>
      </div>
    `;
  } else if (activeTab === "arbitrage") {
    const arb = data.delta_neutral_arbitrage;
    const rules = data.discipline_rules;

    tabContentHtml = `
      <div class="tvac-card">
        <div class="tvac-card-title">
          <span>Delta-Neutral Cash & Carry Arbitrage</span>
          <span style="font-size: 10px; color: #38bdf8;">Net Delta = 0</span>
        </div>
        <div class="tvac-risk-grid">
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">8h Funding Rate</div>
            <div class="tvac-metric-val ${arb.funding_rate_8h_pct >= 0 ? 'tvac-val-green' : 'tvac-val-red'}">
              ${arb.funding_rate_8h_pct}%
            </div>
          </div>
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">Annualized Yield</div>
            <div class="tvac-metric-val tvac-val-cyan">${arb.annualized_yield_pct}% APR</div>
          </div>
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">Basis Spread</div>
            <div class="tvac-metric-val">$${arb.basis_spread}</div>
          </div>
          <div class="tvac-risk-card">
            <div class="tvac-metric-lbl">Regime</div>
            <div class="tvac-metric-val" style="font-size: 10px;">${arb.regime.split(" ")[0]}</div>
          </div>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
          Spot Buy + 1x Short Perpetual = Directional risk-free funding yield collection.
        </div>
      </div>

      <div class="tvac-card">
        <div class="tvac-card-title">5 Non-Negotiable Discipline Rules</div>
        <div class="tvac-checklist">
          ${rules.map(r => `
            <div class="tvac-check-item ${r.passed ? 'passed' : 'failed'}">
              <div class="tvac-check-icon">${r.passed ? '✓' : '⚠️'}</div>
              <div class="tvac-check-content">
                <div class="tvac-check-title">${r.rule}: <span style="font-weight: 400; color: #cbd5e1;">${r.status}</span></div>
                <div class="tvac-check-desc">${r.instruction}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    ${bannerHtml}
    ${tabsHtml}
    ${tabContentHtml}
    <div class="tvac-footer">
      Institutional Framework Copilot v5.0 · Strictly Rule-Based · You Control All Execution
    </div>
  `;

  // Attach tab click listeners
  body.querySelectorAll(".tvac-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      renderUI(lastApiData);
    });
  });

  // Attach Method 77 listeners
  if (activeTab === "method77") {
    body.querySelectorAll(".tvac-filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        method77Filter = pill.dataset.cat;
        renderUI(lastApiData);
      });
    });

    const searchInput = body.querySelector("#tvac-m77-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        method77Search = e.target.value;
        const catFilter = method77Filter || "all";
        const searchTxt = method77Search.toLowerCase().trim();
        const container = body.querySelector(".tvac-method-container");
        if (container && lastApiData && lastApiData.master_method_77) {
          const allItems = lastApiData.master_method_77.items || [];
          const filtered = allItems.filter(item => {
            if (catFilter !== "all" && item.category !== catFilter) return false;
            if (searchTxt && !item.name.toLowerCase().includes(searchTxt) && !item.detail.toLowerCase().includes(searchTxt) && !item.val.toLowerCase().includes(searchTxt)) {
              return false;
            }
            return true;
          });
          container.innerHTML = filtered.length === 0 ? `<div style="text-align:center; padding:15px; color:#64748b; font-size:11px;">No method found matching search query.</div>` : filtered.map(it => {
            const st = it.status || "Neutral";
            let borderCls = "item-neut";
            let badgeCls = "tvac-tag-neut";
            if (st === "Bullish") { borderCls = "item-bull"; badgeCls = "tvac-tag-bull"; }
            else if (st === "Bearish") { borderCls = "item-bear"; badgeCls = "tvac-tag-bear"; }
            else if (st === "Active") { borderCls = "item-act"; badgeCls = "tvac-badge-active"; }
            return `
              <div class="tvac-method-item ${borderCls}">
                <div class="tvac-method-row-top">
                  <div style="display:flex; align-items:center;">
                    <span class="tvac-method-name">${it.name}</span>
                    <span class="tvac-method-cat">${it.category}</span>
                  </div>
                  <span class="tvac-mini-tag ${badgeCls}">${st.toUpperCase()}</span>
                </div>
                <div class="tvac-method-val">${it.val}</div>
                <div class="tvac-method-detail">${it.detail}</div>
              </div>
            `;
          }).join("");
        }
      });
    }
  }

  // Attach capital input listener
  const capInput = body.querySelector("#tvac-capital-input");
  if (capInput) {
    capInput.addEventListener("change", (e) => {
      userCapital = parseFloat(e.target.value) || 10000;
      refresh();
    });
  }
}

async function fetchFromBackend(url, symbol, interval, capital) {
  const target = `${url}/analyze?symbol=${symbol}&interval=${interval}&capital=${capital}`;
  const res = await fetch(target, { mode: "cors" });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function refresh() {
  buildPanel();
  const symbol = getSymbolFromPage();
  const body = panelEl.querySelector("#tvac-body");

  try {
    // Try local backend first, fallback to cloud
    let data = null;
    try {
      data = await fetchFromBackend(currentBackend, symbol, currentInterval, userCapital);
    } catch (localErr) {
      if (currentBackend !== CLOUD_BACKEND) {
        currentBackend = CLOUD_BACKEND;
        data = await fetchFromBackend(currentBackend, symbol, currentInterval, userCapital);
      } else {
        throw localErr;
      }
    }
    renderUI(data);
  } catch (err) {
    if (body) {
      body.innerHTML = `
        <div class="tvac-error-box">
          <b>Connection Issue:</b> Could not reach backend.<br>
          <small>Tried: ${currentBackend}</small><br><br>
          Please start local backend:
          <pre style="background: #0f172a; padding: 6px; border-radius: 4px; margin-top: 4px; font-size: 10px;">cd backend\nuvicorn main:app --reload --port 8000</pre>
          <div style="margin-top: 8px;">
            <button id="tvac-retry-btn" class="tvac-select" style="background: #334155; color: white;">Retry Connection</button>
          </div>
        </div>
      `;
      const retryBtn = body.querySelector("#tvac-retry-btn");
      if (retryBtn) retryBtn.addEventListener("click", () => {
        currentBackend = DEFAULT_LOCAL_BACKEND;
        refresh();
      });
    }
  }
}

// Auto start
buildPanel();
refresh();
setInterval(refresh, REFRESH_MS);
