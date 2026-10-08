"""
approaches.py
Multi-Angle Chart Analysis Engine for TradingView Copilot Pro
Implements 5 Distinct Analytical Approaches + 1 Total Consensus Aggregator:
1. Smart Money Concepts (SMC) & Liquidity Sweeps
2. Multi-EMA Trend & Directional Alignment
3. Momentum & Oscillators Dynamics
4. Institutional CVD & Order Flow Footprint
5. Statistical Extremes & Gaussian Z-Score Reversion
6. Master Total Consensus (Aggregates all indicators & approaches for final probability)
"""

import numpy as np
import pandas as pd
from ta.trend import EMAIndicator, ADXIndicator
from ta.volatility import AverageTrueRange


def evaluate_multi_approaches(
    df: pd.DataFrame,
    daily_df: pd.DataFrame,
    last_price: float,
    ind: dict,
    zscore: dict,
    cvd: dict,
    sweeps: dict,
    fib: dict,
    macro: dict,
    regime: dict,
    structure: str
) -> dict:
    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]

    # 1h EMA calculations
    ema20 = float(close.ewm(span=20, adjust=False).mean().iloc[-1])
    ema50 = float(close.ewm(span=50, adjust=False).mean().iloc[-1])
    ema200_len = min(200, len(close))
    ema200 = float(close.ewm(span=ema200_len, adjust=False).mean().iloc[-1])

    # Volume comparison
    avg_vol_20 = float(volume.rolling(20).mean().iloc[-1]) if len(volume) >= 20 else float(volume.mean())
    curr_vol = float(volume.iloc[-1])
    vol_ratio = round(curr_vol / avg_vol_20, 2) if avg_vol_20 > 0 else 1.0

    # -------------------------------------------------------------
    # APPROACH 1: Smart Money Concepts (SMC) & Liquidity Sweeps
    # Angle: Order blocks, liquidity sweeps (BSL/SSL), Fibo OTE & structural breaks
    # -------------------------------------------------------------
    smc_bull_signals = 0
    smc_bear_signals = 0
    smc_signals = []

    # 1.1 Market Structure
    if structure == "uptrend":
        smc_bull_signals += 1
        smc_signals.append({
            "indicator": "Market Structure (BOS)",
            "status": "Bullish",
            "val": "Uptrend (HH/HL)",
            "detail": "Bullish Break of Structure confirmed on swing highs"
        })
    elif structure == "downtrend":
        smc_bear_signals += 1
        smc_signals.append({
            "indicator": "Market Structure (BOS)",
            "status": "Bearish",
            "val": "Downtrend (LH/LL)",
            "detail": "Bearish Break of Structure confirmed on swing lows"
        })
    else:
        smc_signals.append({
            "indicator": "Market Structure (BOS)",
            "status": "Neutral",
            "val": "Range / Consolidation",
            "detail": "Price in consolidation range, waiting for breakout"
        })

    # 1.2 Liquidity Sweeps (Rule 2)
    if sweeps.get("ssl_sweep"):
        smc_bull_signals += 2
        smc_signals.append({
            "indicator": "Liquidity Sweep (Stop Hunt)",
            "status": "Bullish",
            "val": "SSL Swept (Rejection)",
            "detail": f"Sell-Side liquidity purged; wick rejection {sweeps.get('lower_wick_pct', 0)}%"
        })
    elif sweeps.get("bsl_sweep"):
        smc_bear_signals += 2
        smc_signals.append({
            "indicator": "Liquidity Sweep (Stop Hunt)",
            "status": "Bearish",
            "val": "BSL Swept (Rejection)",
            "detail": f"Buy-Side liquidity purged; wick rejection {sweeps.get('upper_wick_pct', 0)}%"
        })
    else:
        smc_signals.append({
            "indicator": "Liquidity Sweep (Stop Hunt)",
            "status": "Neutral",
            "val": "No Fresh Sweep",
            "detail": "No extreme wick sweep detected on immediate lookback"
        })

    # 1.3 Fibonacci Golden Pocket (0.618 - 0.65 OTE)
    if fib.get("in_golden_pocket"):
        if macro.get("is_macro_bull", True):
            smc_bull_signals += 1
            smc_status = "Bullish"
            smc_detail = "Price inside optimal trade entry (0.618 OTE) pullback zone"
        else:
            smc_bear_signals += 1
            smc_status = "Bearish"
            smc_detail = "Price inside optimal trade entry (0.618 OTE) short zone"
        smc_signals.append({
            "indicator": "Fibonacci Golden Pocket",
            "status": smc_status,
            "val": f"In Pocket (${fib['golden_pocket_range'][0]} - ${fib['golden_pocket_range'][1]})",
            "detail": smc_detail
        })
    else:
        smc_signals.append({
            "indicator": "Fibonacci Golden Pocket",
            "status": "Neutral",
            "val": fib.get("status", "Outside Golden Pocket"),
            "detail": f"Golden pocket at ${fib['golden_pocket_range'][0]} - ${fib['golden_pocket_range'][1]}"
        })

    # 1.4 Whale Limit Absorption
    if cvd.get("bull_absorption"):
        smc_bull_signals += 1
        smc_signals.append({
            "indicator": "Whale Order Block Absorption",
            "status": "Bullish",
            "val": "Whale Limit Buy Absorption",
            "detail": "Passive institutional buy orders absorbed aggressive selling"
        })
    elif cvd.get("bear_absorption"):
        smc_bear_signals += 1
        smc_signals.append({
            "indicator": "Whale Order Block Absorption",
            "status": "Bearish",
            "val": "Whale Limit Sell Absorption",
            "detail": "Passive institutional sell orders absorbed aggressive buying"
        })
    else:
        smc_signals.append({
            "indicator": "Whale Order Block Absorption",
            "status": "Neutral",
            "val": "Normal Order Flow",
            "detail": "No dominant institutional limit absorption detected"
        })

    smc_total_pts = smc_bull_signals + smc_bear_signals
    if smc_bull_signals > smc_bear_signals:
        smc_bias = "Bullish"
        smc_chance = min(92, max(55, int(50 + (smc_bull_signals - smc_bear_signals) * 15)))
    elif smc_bear_signals > smc_bull_signals:
        smc_bias = "Bearish"
        smc_chance = min(92, max(55, int(50 + (smc_bear_signals - smc_bull_signals) * 15)))
    else:
        smc_bias = "Neutral"
        smc_chance = 50

    smc_bull_pct = smc_chance if smc_bias == "Bullish" else (100 - smc_chance if smc_bias == "Bearish" else 50)

    approach_smc = {
        "id": "smc",
        "name": "Smart Money Concepts (SMC)",
        "angle": "Order Blocks, Liquidity Sweeps, Swing BOS & Fibo OTE",
        "bias": smc_bias,
        "prediction": smc_bias,
        "confidence_pct": smc_chance,
        "bullish_pct": smc_bull_pct,
        "bearish_pct": 100 - smc_bull_pct,
        "verdict_summary": f"SMC Angle predicts {smc_bias.upper()} based on " + (
            "liquidity sweep & structure" if (sweeps.get("ssl_sweep") or sweeps.get("bsl_sweep")) else "current order blocks"
        ),
        "signals": smc_signals
    }

    # -------------------------------------------------------------
    # APPROACH 2: Trend & Moving Averages (Multi-MA Trend System)
    # Angle: Macro Daily EMA 200, 1h EMA 20/50/200 Stack, ADX Trend Strength
    # -------------------------------------------------------------
    trend_bull_signals = 0
    trend_bear_signals = 0
    trend_signals = []

    # 2.1 Macro Daily EMA 200 (Rule 1)
    if macro.get("is_macro_bull", True):
        trend_bull_signals += 2
        trend_signals.append({
            "indicator": "Macro Trend (Daily EMA 200)",
            "status": "Bullish",
            "val": f"Above Daily EMA (${macro.get('daily_ema_200', 0):,})",
            "detail": "Longs Only Regime (Rule 1 compliant uptrend)"
        })
    else:
        trend_bear_signals += 2
        trend_signals.append({
            "indicator": "Macro Trend (Daily EMA 200)",
            "status": "Bearish",
            "val": f"Below Daily EMA (${macro.get('daily_ema_200', 0):,})",
            "detail": "Shorts Only Regime (Rule 1 compliant downtrend)"
        })

    # 2.2 EMA 20 vs EMA 50
    if ema20 >= ema50:
        trend_bull_signals += 1
        trend_signals.append({
            "indicator": "Short-Term EMA Cross (20/50)",
            "status": "Bullish",
            "val": "EMA 20 > EMA 50 (Golden Alignment)",
            "detail": f"EMA 20: ${ema20:,.1f} | EMA 50: ${ema50:,.1f}"
        })
    else:
        trend_bear_signals += 1
        trend_signals.append({
            "indicator": "Short-Term EMA Cross (20/50)",
            "status": "Bearish",
            "val": "EMA 20 < EMA 50 (Death Alignment)",
            "detail": f"EMA 20: ${ema20:,.1f} | EMA 50: ${ema50:,.1f}"
        })

    # 2.3 Price vs 1h EMA 200
    if last_price >= ema200:
        trend_bull_signals += 1
        trend_signals.append({
            "indicator": "Intermediate Trend (1h EMA 200)",
            "status": "Bullish",
            "val": f"Price Above 1h EMA 200 (${ema200:,.1f})",
            "detail": f"Price premium: +{((last_price - ema200)/ema200)*100:.2f}%"
        })
    else:
        trend_bear_signals += 1
        trend_signals.append({
            "indicator": "Intermediate Trend (1h EMA 200)",
            "status": "Bearish",
            "val": f"Price Below 1h EMA 200 (${ema200:,.1f})",
            "detail": f"Price discount: {((last_price - ema200)/ema200)*100:.2f}%"
        })

    # 2.4 ADX Directional Power
    adx_val = ind["adx"]["adx"]
    p_di = ind["adx"]["plus_di"]
    m_di = ind["adx"]["minus_di"]
    if p_di > m_di:
        trend_bull_signals += 1
        trend_signals.append({
            "indicator": "ADX Directional Strength",
            "status": "Bullish",
            "val": f"+DI ({p_di}) > -DI ({m_di}) [ADX: {adx_val}]",
            "detail": "Bulls in control of directional trajectory"
        })
    else:
        trend_bear_signals += 1
        trend_signals.append({
            "indicator": "ADX Directional Strength",
            "status": "Bearish",
            "val": f"-DI ({m_di}) > +DI ({p_di}) [ADX: {adx_val}]",
            "detail": "Bears in control of directional trajectory"
        })

    if trend_bull_signals > trend_bear_signals:
        trend_bias = "Bullish"
        trend_chance = min(95, max(55, int(50 + (trend_bull_signals - trend_bear_signals) * 12)))
    elif trend_bear_signals > trend_bull_signals:
        trend_bias = "Bearish"
        trend_chance = min(95, max(55, int(50 + (trend_bear_signals - trend_bull_signals) * 12)))
    else:
        trend_bias = "Neutral"
        trend_chance = 50

    trend_bull_pct = trend_chance if trend_bias == "Bullish" else (100 - trend_chance if trend_bias == "Bearish" else 50)

    approach_trend = {
        "id": "trend",
        "name": "Trend & Moving Averages",
        "angle": "Macro Daily EMA 200, Multi-EMA Stack & ADX Trajectory",
        "bias": trend_bias,
        "prediction": trend_bias,
        "confidence_pct": trend_chance,
        "bullish_pct": trend_bull_pct,
        "bearish_pct": 100 - trend_bull_pct,
        "verdict_summary": f"Trend Approach predicts {trend_bias.upper()} ({trend_chance}% confidence) following multi-timeframe moving average stack.",
        "signals": trend_signals
    }

    # -------------------------------------------------------------
    # APPROACH 3: Momentum & Oscillators (Velocity & Cycle Analysis)
    # Angle: RSI, MACD Histogram, Stochastic %K/%D, Chaikin Money Flow
    # -------------------------------------------------------------
    mom_bull_signals = 0
    mom_bear_signals = 0
    mom_signals = []

    # 3.1 RSI (14)
    rsi_val = ind["rsi"]
    if rsi_val > 55:
        mom_bull_signals += 1
        mom_signals.append({
            "indicator": "Relative Strength Index (RSI 14)",
            "status": "Bullish",
            "val": f"RSI: {rsi_val} (Bullish Momentum)",
            "detail": "RSI above 50 midline supporting upside continuation"
        })
    elif rsi_val < 45:
        mom_bear_signals += 1
        mom_signals.append({
            "indicator": "Relative Strength Index (RSI 14)",
            "status": "Bearish",
            "val": f"RSI: {rsi_val} (Bearish Momentum)",
            "detail": "RSI below 50 midline supporting downward drift"
        })
    else:
        mom_signals.append({
            "indicator": "Relative Strength Index (RSI 14)",
            "status": "Neutral",
            "val": f"RSI: {rsi_val} (Neutral Zone)",
            "detail": "RSI in balanced equilibrium range (45-55)"
        })

    # 3.2 MACD Histogram & Signal Line
    macd_hist = ind["macd"]["histogram"]
    macd_line = ind["macd"]["macd"]
    macd_sig = ind["macd"]["signal"]
    if macd_hist > 0:
        mom_bull_signals += 1
        mom_signals.append({
            "indicator": "MACD Oscillator",
            "status": "Bullish",
            "val": f"Hist: +{macd_hist} (MACD > Signal)",
            "detail": f"MACD line ({macd_line}) above signal ({macd_sig})"
        })
    else:
        mom_bear_signals += 1
        mom_signals.append({
            "indicator": "MACD Oscillator",
            "status": "Bearish",
            "val": f"Hist: {macd_hist} (MACD < Signal)",
            "detail": f"MACD line ({macd_line}) below signal ({macd_sig})"
        })

    # 3.3 Stochastic Oscillator
    stoch_k = ind["stochastic"]["k"]
    stoch_d = ind["stochastic"]["d"]
    if stoch_k > stoch_d:
        mom_bull_signals += 1
        mom_signals.append({
            "indicator": "Stochastic Oscillator (14,3)",
            "status": "Bullish",
            "val": f"%K ({stoch_k}) > %D ({stoch_d})",
            "detail": "Fast line crossing above signal line"
        })
    else:
        mom_bear_signals += 1
        mom_signals.append({
            "indicator": "Stochastic Oscillator (14,3)",
            "status": "Bearish",
            "val": f"%K ({stoch_k}) < %D ({stoch_d})",
            "detail": "Fast line crossing below signal line"
        })

    # 3.4 Chaikin Money Flow (CMF)
    cmf_val = ind["cmf"]
    if cmf_val > 0.05:
        mom_bull_signals += 1
        mom_signals.append({
            "indicator": "Chaikin Money Flow (CMF 20)",
            "status": "Bullish",
            "val": f"CMF: +{cmf_val} (Capital Accumulation)",
            "detail": "Positive money flow confirms active institutional buying"
        })
    elif cmf_val < -0.05:
        mom_bear_signals += 1
        mom_signals.append({
            "indicator": "Chaikin Money Flow (CMF 20)",
            "status": "Bearish",
            "val": f"CMF: {cmf_val} (Capital Distribution)",
            "detail": "Negative money flow indicates institutional selling pressure"
        })
    else:
        mom_signals.append({
            "indicator": "Chaikin Money Flow (CMF 20)",
            "status": "Neutral",
            "val": f"CMF: {cmf_val} (Neutral Flow)",
            "detail": "Balanced volume accumulation/distribution"
        })

    if mom_bull_signals > mom_bear_signals:
        mom_bias = "Bullish"
        mom_chance = min(90, max(55, int(50 + (mom_bull_signals - mom_bear_signals) * 15)))
    elif mom_bear_signals > mom_bull_signals:
        mom_bias = "Bearish"
        mom_chance = min(90, max(55, int(50 + (mom_bear_signals - mom_bull_signals) * 15)))
    else:
        mom_bias = "Neutral"
        mom_chance = 50

    mom_bull_pct = mom_chance if mom_bias == "Bullish" else (100 - mom_chance if mom_bias == "Bearish" else 50)

    approach_momentum = {
        "id": "momentum",
        "name": "Momentum & Oscillators",
        "angle": "RSI Velocity, MACD Histogram, Stochastic Cross & CMF",
        "bias": mom_bias,
        "prediction": mom_bias,
        "confidence_pct": mom_chance,
        "bullish_pct": mom_bull_pct,
        "bearish_pct": 100 - mom_bull_pct,
        "verdict_summary": f"Momentum Approach predicts {mom_bias.upper()} ({mom_chance}% confidence) across cyclic oscillators.",
        "signals": mom_signals
    }

    # -------------------------------------------------------------
    # APPROACH 4: Volume & Order Flow (CVD Footprint & Whale Absorption)
    # Angle: Cumulative Volume Delta (CVD), Absorption Traps, Bar Delta, OBV
    # -------------------------------------------------------------
    of_bull_signals = 0
    of_bear_signals = 0
    of_signals = []

    # 4.1 CVD Slope
    if "Rising" in cvd.get("cvd_trend", ""):
        of_bull_signals += 2
        of_signals.append({
            "indicator": "Cumulative Volume Delta (CVD)",
            "status": "Bullish",
            "val": "Rising (Aggressive Market Buys)",
            "detail": "Cumulative delta uptrend indicates aggressive bid lifting"
        })
    else:
        of_bear_signals += 2
        of_signals.append({
            "indicator": "Cumulative Volume Delta (CVD)",
            "status": "Bearish",
            "val": "Falling (Aggressive Market Sells)",
            "detail": "Cumulative delta downtrend indicates aggressive ask hitting"
        })

    # 4.2 Whale Absorption Trap
    if cvd.get("bull_absorption"):
        of_bull_signals += 2
        of_signals.append({
            "indicator": "Whale Limit Absorption Trap",
            "status": "Bullish",
            "val": "Whale Buy Trap ACTIVE",
            "detail": "Heavy sell volume absorbed by institutional limit bids (Bullish Trap)"
        })
    elif cvd.get("bear_absorption"):
        of_bear_signals += 2
        of_signals.append({
            "indicator": "Whale Limit Absorption Trap",
            "status": "Bearish",
            "val": "Whale Sell Trap ACTIVE",
            "detail": "Heavy buy volume absorbed by institutional limit asks (Bearish Trap)"
        })
    else:
        of_signals.append({
            "indicator": "Whale Limit Absorption Trap",
            "status": "Neutral",
            "val": "Normal Absorption",
            "detail": "No extreme iceberg/limit order absorption imbalance detected"
        })

    # 4.3 Bar Delta
    bar_delta = cvd.get("bar_delta", 0)
    if bar_delta > 0:
        of_bull_signals += 1
        of_signals.append({
            "indicator": "Single Bar Delta Imbalance",
            "status": "Bullish",
            "val": f"+{bar_delta} Net Buyer Delta",
            "detail": "More volume traded at ask than bid on current bar"
        })
    else:
        of_bear_signals += 1
        of_signals.append({
            "indicator": "Single Bar Delta Imbalance",
            "status": "Bearish",
            "val": f"{bar_delta} Net Seller Delta",
            "detail": "More volume traded at bid than ask on current bar"
        })

    # 4.4 OBV Trend
    obv_trend = ind["obv"]["trend"]
    if obv_trend == "rising":
        of_bull_signals += 1
        of_signals.append({
            "indicator": "On-Balance Volume (OBV)",
            "status": "Bullish",
            "val": f"Rising (+{ind['obv']['value']:,.0f})",
            "detail": "Volume precedes price; OBV sloping higher"
        })
    else:
        of_bear_signals += 1
        of_signals.append({
            "indicator": "On-Balance Volume (OBV)",
            "status": "Bearish",
            "val": f"Falling ({ind['obv']['value']:,.0f})",
            "detail": "OBV sloping lower indicating distribution"
        })

    if of_bull_signals > of_bear_signals:
        of_bias = "Bullish"
        of_chance = min(95, max(55, int(50 + (of_bull_signals - of_bear_signals) * 12)))
    elif of_bear_signals > of_bull_signals:
        of_bias = "Bearish"
        of_chance = min(95, max(55, int(50 + (of_bear_signals - of_bull_signals) * 12)))
    else:
        of_bias = "Neutral"
        of_chance = 50

    of_bull_pct = of_chance if of_bias == "Bullish" else (100 - of_chance if of_bias == "Bearish" else 50)

    approach_orderflow = {
        "id": "orderflow",
        "name": "Volume & Order Flow (CVD)",
        "angle": "Cumulative Volume Delta, Whale Absorption & Bar Imbalance",
        "bias": of_bias,
        "prediction": of_bias,
        "confidence_pct": of_chance,
        "bullish_pct": of_bull_pct,
        "bearish_pct": 100 - of_bull_pct,
        "verdict_summary": f"Order Flow Approach predicts {of_bias.upper()} ({of_chance}% confidence) based on institutional tape and CVD slope.",
        "signals": of_signals
    }

    # -------------------------------------------------------------
    # APPROACH 5: Statistical & Gaussian Z-Score Reversion
    # Angle: Normal distribution bell curve, 2.5σ extreme boundaries & Volatility
    # -------------------------------------------------------------
    stat_bull_signals = 0
    stat_bear_signals = 0
    stat_signals = []

    z_val = zscore.get("z_score", 0.0)

    # 5.1 Z-Score Extreme
    if z_val <= -2.0:
        stat_bull_signals += 2
        stat_signals.append({
            "indicator": "Statistical Z-Score (20-Period)",
            "status": "Bullish",
            "val": f"Z = {z_val} σ (Oversold Extreme)",
            "detail": "98.7% Gaussian boundary reached; high statistical probability of mean reversion bounce"
        })
    elif z_val >= 2.0:
        stat_bear_signals += 2
        stat_signals.append({
            "indicator": "Statistical Z-Score (20-Period)",
            "status": "Bearish",
            "val": f"Z = +{z_val} σ (Overbought Extreme)",
            "detail": "98.7% Gaussian boundary reached; high statistical probability of mean reversion pullback"
        })
    elif z_val < 0:
        stat_bull_signals += 1
        stat_signals.append({
            "indicator": "Statistical Z-Score (20-Period)",
            "status": "Bullish",
            "val": f"Z = {z_val} σ (Below 20-Mean)",
            "detail": f"Price below 20-mean (${zscore['mean_20']:,}); room for upward reversion"
        })
    else:
        stat_bear_signals += 1
        stat_signals.append({
            "indicator": "Statistical Z-Score (20-Period)",
            "status": "Bearish",
            "val": f"Z = +{z_val} σ (Above 20-Mean)",
            "detail": f"Price above 20-mean (${zscore['mean_20']:,}); room for downward reversion"
        })

    # 5.2 Gaussian Outer Envelope (+/-2.5σ)
    stat_signals.append({
        "indicator": "Gaussian Envelope Boundaries",
        "status": "Neutral",
        "val": f"+2.5σ: ${zscore['upper_extreme_2_5']:,} | -2.5σ: ${zscore['lower_extreme_2_5']:,}",
        "detail": f"Standard deviation σ = ${zscore['std_20']:,}"
    })

    # 5.3 Volatility Regime
    is_expanding = regime.get("volatility_expansion", False)
    if is_expanding:
        stat_signals.append({
            "indicator": "Volatility Regime (ATR)",
            "status": "Neutral",
            "val": f"{regime.get('regime', 'Trending')} (Expanding)",
            "detail": "ATR above 30-period baseline; momentum breakouts favored"
        })
    else:
        stat_signals.append({
            "indicator": "Volatility Regime (ATR)",
            "status": "Neutral",
            "val": f"{regime.get('regime', 'Ranging')} (Contracting)",
            "detail": "Volatility squeeze; range mean-reversion favored"
        })

    if stat_bull_signals > stat_bear_signals:
        stat_bias = "Bullish"
        stat_chance = min(90, max(55, int(50 + (stat_bull_signals - stat_bear_signals) * 15)))
    elif stat_bear_signals > stat_bull_signals:
        stat_bias = "Bearish"
        stat_chance = min(90, max(55, int(50 + (stat_bear_signals - stat_bull_signals) * 15)))
    else:
        stat_bias = "Neutral"
        stat_chance = 50

    stat_bull_pct = stat_chance if stat_bias == "Bullish" else (100 - stat_chance if stat_bias == "Bearish" else 50)

    approach_statistical = {
        "id": "statistical",
        "name": "Statistical Extremes & Z-Score",
        "angle": "Gaussian Normal Distribution, Mean Reversion & Sigma Bands",
        "bias": stat_bias,
        "prediction": stat_bias,
        "confidence_pct": stat_chance,
        "bullish_pct": stat_bull_pct,
        "bearish_pct": 100 - stat_bull_pct,
        "verdict_summary": f"Statistical Approach predicts {stat_bias.upper()} ({stat_chance}% confidence) from standard deviation distribution curve.",
        "signals": stat_signals
    }

    all_approaches = [
        approach_smc,
        approach_trend,
        approach_momentum,
        approach_orderflow,
        approach_statistical,
    ]

    # -------------------------------------------------------------
    # 6. TOTAL CONSENSUS & ALL INDICATORS AGGREGATOR
    # "or And m ik Total ka Tab ho gaya jaha Sary Indicators ka Total krke baeega ab kaha ka kitna Chance hai"
    # -------------------------------------------------------------
    bull_app_count = sum(1 for a in all_approaches if a["bias"] == "Bullish")
    bear_app_count = sum(1 for a in all_approaches if a["bias"] == "Bearish")
    neut_app_count = sum(1 for a in all_approaches if a["bias"] == "Neutral")

    # Aggregate weighted bullish percentage across all 5 approaches
    weights = [0.25, 0.25, 0.15, 0.20, 0.15]
    total_bullish_chance = sum(a["bullish_pct"] * w for a, w in zip(all_approaches, weights))
    total_bullish_chance = round(float(np.clip(total_bullish_chance, 5, 95)), 1)
    total_bearish_chance = round(100.0 - total_bullish_chance, 1)

    # Count individual indicator signals across all approaches
    total_ind_bull = 0
    total_ind_bear = 0
    total_ind_neut = 0
    for a in all_approaches:
        for s in a["signals"]:
            st = s.get("status", "").lower()
            if st == "bullish":
                total_ind_bull += 1
            elif st == "bearish":
                total_ind_bear += 1
            else:
                total_ind_neut += 1

    total_indicators_count = total_ind_bull + total_ind_bear + total_ind_neut

    # Overall Consensus Direction
    if total_bullish_chance >= 70:
        consensus_direction = "Strong Bullish"
        consensus_action = f"High-conviction LONG edge ({total_bullish_chance}% Bullish Chance). {bull_app_count} of 5 approaches align bullish."
    elif total_bullish_chance >= 55:
        consensus_direction = "Moderate Bullish"
        consensus_action = f"Favorable LONG bias ({total_bullish_chance}% Bullish Chance). Confirm entry with stop hunt wick rejection."
    elif total_bullish_chance <= 30:
        consensus_direction = "Strong Bearish"
        consensus_action = f"High-conviction SHORT edge ({total_bearish_chance}% Bearish Chance). {bear_app_count} of 5 approaches align bearish."
    elif total_bullish_chance <= 45:
        consensus_direction = "Moderate Bearish"
        consensus_action = f"Favorable SHORT bias ({total_bearish_chance}% Bearish Chance). Stand down on longs."
    else:
        consensus_direction = "Neutral / Mixed"
        consensus_action = "Conflicting signals between trend and mean-reversion. Stand down (Rule 3: No Setup, No Trade)."

    total_tab = {
        "bullish_chance_pct": total_bullish_chance,
        "bearish_chance_pct": total_bearish_chance,
        "consensus_direction": consensus_direction,
        "consensus_action": consensus_action,
        "approaches_count": {
            "bullish": bull_app_count,
            "bearish": bear_app_count,
            "neutral": neut_app_count,
            "total": len(all_approaches)
        },
        "indicators_count": {
            "bullish": total_ind_bull,
            "bearish": total_ind_bear,
            "neutral": total_ind_neut,
            "total": total_indicators_count
        },
        "scoreboard": [
            {
                "id": a["id"],
                "name": a["name"],
                "angle": a["angle"],
                "bias": a["bias"],
                "bullish_pct": a["bullish_pct"],
                "bearish_pct": a["bearish_pct"],
                "verdict": a["verdict_summary"]
            }
            for a in all_approaches
        ]
    }

    # Indicator All-In-One Engine (from in.txt logic)
    indicator_data = compute_indicator_all_in_one(
        df=df,
        ind=ind,
        sweeps=sweeps,
        structure=structure,
        last_price=last_price
    )

    return {
        "approaches": all_approaches,
        "total_consensus": total_tab,
        "indicator_engine": indicator_data
    }


def compute_indicator_all_in_one(
    df: pd.DataFrame,
    ind: dict,
    sweeps: dict,
    structure: str,
    last_price: float
) -> dict:
    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]
    open_p = df["open"]

    # 1. EMAs (20, 50, 200)
    ema20 = float(close.ewm(span=20, adjust=False).mean().iloc[-1])
    ema50 = float(close.ewm(span=50, adjust=False).mean().iloc[-1])
    ema200_len = min(200, len(close))
    ema200 = float(close.ewm(span=ema200_len, adjust=False).mean().iloc[-1])
    ema_bull_stack = ema20 > ema50 and ema50 > ema200
    ema_bear_stack = ema20 < ema50 and ema50 < ema200

    # 2. ADX
    adx_val = ind["adx"]["adx"]
    p_di = ind["adx"]["plus_di"]
    m_di = ind["adx"]["minus_di"]
    strong_trend = adx_val > 25
    trend_up_by_di = p_di > m_di

    # Trend Sub-score (in.txt line 553-557)
    ema_sub = 100 if ema_bull_stack else (0 if ema_bear_stack else 50)
    di_sub = (100 if trend_up_by_di else 0) if strong_trend else 50
    struct_sub = 100 if structure == "uptrend" else (0 if structure == "downtrend" else 50)
    trend_pct = round((ema_sub + di_sub + struct_sub) / 3.0, 1)

    # Momentum Sub-score (in.txt line 559-560)
    rsi_val = ind["rsi"]
    k_line = ind["stochastic"]["k"]
    d_line = ind["stochastic"]["d"]
    momentum_pct = round(float(np.clip((rsi_val + k_line) / 2.0, 0, 100)), 1)

    # Volume Sub-score (in.txt line 562-565)
    cmf_val = ind["cmf"]
    cmf_bullish = cmf_val > 0
    cmf_sub = 100 if cmf_bullish else 0
    avg_vol_20 = float(volume.rolling(20).mean().iloc[-1]) if len(volume) >= 20 else float(volume.mean())
    curr_vol = float(volume.iloc[-1])
    high_volume = curr_vol > avg_vol_20 * 1.5
    vol_spike_sub = (100 if close.iloc[-1] > open_p.iloc[-1] else 0) if high_volume else 50
    volume_pct = round((cmf_sub + vol_spike_sub) / 2.0, 1)

    # Liquidity Sub-score (in.txt line 567-570)
    sweep_low = sweeps.get("ssl_sweep", False)
    sweep_high = sweeps.get("bsl_sweep", False)
    sweep_sub = 100 if sweep_low else (0 if sweep_high else 50)
    bos_sub = 100 if structure == "uptrend" else (0 if structure == "downtrend" else 50)
    liquidity_pct = round((sweep_sub + bos_sub) / 2.0, 1)

    # Total Weighted % (in.txt line 572-578)
    w_t, w_m, w_v, w_l = 0.35, 0.25, 0.20, 0.20
    total_pct = round(trend_pct * w_t + momentum_pct * w_m + volume_pct * w_v + liquidity_pct * w_l, 1)
    bull_bias = total_pct >= 50
    confidence_pct = round(abs(total_pct - 50) * 2.0, 1)
    confidence_label = "HIGH" if confidence_pct >= 70 else ("MEDIUM" if confidence_pct >= 40 else "LOW")

    # Trade Signal Engine Score (out of 10) (in.txt line 611-618)
    macd_bullish = ind["macd"]["histogram"] > 0
    rsi_overbought = rsi_val > 70
    rsi_oversold = rsi_val < 30

    buy_strength = (
        int(ema_bull_stack) +
        int(macd_bullish) +
        int(rsi_val > 50) +
        int(k_line > d_line) +
        int(strong_trend) +
        int(cmf_bullish) +
        int(high_volume) +
        int(structure != "downtrend") +
        int(not sweep_high) +
        int(close.iloc[-1] > open_p.iloc[-1])
    )
    sell_strength = (
        int(ema_bear_stack) +
        int(not macd_bullish) +
        int(rsi_val < 50) +
        int(k_line < d_line) +
        int(strong_trend) +
        int(not cmf_bullish) +
        int(high_volume) +
        int(structure != "uptrend") +
        int(not sweep_low) +
        int(close.iloc[-1] < open_p.iloc[-1])
    )

    adx_ok = adx_val >= 18
    struct_ok_buy = structure != "downtrend"
    struct_ok_sell = structure != "uptrend"

    buy_cond = buy_strength >= 6 and macd_bullish and not rsi_overbought and struct_ok_buy and adx_ok
    sell_cond = sell_strength >= 6 and not macd_bullish and not rsi_oversold and struct_ok_sell and adx_ok

    signal_txt = "BUY" if buy_cond else ("SELL" if sell_cond else "WAIT")
    active_strength = buy_strength if buy_cond else (sell_strength if sell_cond else max(buy_strength, sell_strength))

    # Entry Confirmation (in.txt lines 802-808)
    ema_check = ema_bull_stack if bull_bias else ema_bear_stack
    macd_check = macd_bullish if bull_bias else not macd_bullish
    rsi_check = (rsi_val > 50 and not rsi_overbought) if bull_bias else (rsi_val < 50 and not rsi_oversold)
    vol_check = cmf_bullish if bull_bias else not cmf_bullish
    liq_check = (sweep_low or structure == "uptrend") if bull_bias else (sweep_high or structure == "downtrend")
    entry_score = round(((int(ema_check) + int(macd_check) + int(rsi_check) + int(vol_check) + int(liq_check)) / 5.0) * 100.0, 1)

    # Godzilla Leverage Module (in.txt lines 853-867)
    up_vol = np.where(close > close.shift(1), volume, 0.0)
    dn_vol = np.where(close < close.shift(1), volume, 0.0)
    sum_up = float(up_vol[-20:].sum()) if len(up_vol) >= 20 else float(up_vol.sum())
    sum_dn = float(dn_vol[-20:].sum()) if len(dn_vol) >= 20 else float(dn_vol.sum())
    tot_flow = sum_up + sum_dn
    imbalance_it = round((sum_up - sum_dn) / tot_flow, 3) if tot_flow > 0 else 0.0

    godzilla_dir = "LONG" if imbalance_it > 0 else ("SHORT" if imbalance_it < 0 else "NEUTRAL")

    atr_series = AverageTrueRange(high=high, low=low, close=close, window=14).average_true_range()
    atr_val = float(atr_series.iloc[-1])
    sigma_pct_raw = (atr_series / close) * 100.0
    sigma_smooth = float(sigma_pct_raw.tail(20).mean()) if len(sigma_pct_raw) >= 20 else float(sigma_pct_raw.iloc[-1])
    sigma_adj = (sigma_smooth / 100.0) * 50.0
    lev_factor = round(1.0 / (1.0 + (sigma_adj ** 2.0)), 3)
    suggested_lev = round(lev_factor * 20.0, 1)

    # Expected Move (in.txt lines 583-590)
    exp_move_amt = atr_val * 1.5
    exp_move_pct = round((exp_move_amt / last_price) * 100.0, 2)
    exp_dir_txt = "⬆ +" if bull_bias else "⬇ -"
    exp_move_txt = f"{exp_dir_txt}{exp_move_pct}%"
    exp_range_low = round(last_price if bull_bias else last_price - exp_move_amt, 2)
    exp_range_high = round(last_price + exp_move_amt if bull_bias else last_price, 2)
    exp_range_txt = f"${exp_range_low:,.2f} → ${exp_range_high:,.2f}"

    # Trade Plan (in.txt lines 671-695)
    risk_dist = atr_val * 1.5
    dir_mult = 1 if bull_bias else -1
    sl_price = round(last_price - dir_mult * risk_dist, 2)
    tp1_price = round(last_price + dir_mult * risk_dist * 1.0, 2)
    tp2_price = round(last_price + dir_mult * risk_dist * 2.0, 2)
    tp3_price = round(last_price + dir_mult * risk_dist * 3.0, 2)

    return {
        "id": "indicator",
        "name": "All-In-One Indicator",
        "title": "Indicator (HEHE All-In-One)",
        "bias": "Bullish" if bull_bias else "Bearish",
        "total_pct": total_pct,
        "bullish_pct": total_pct,
        "bearish_pct": round(100.0 - total_pct, 1),
        "confidence_pct": confidence_pct,
        "confidence_label": confidence_label,
        "signal": signal_txt,
        "signal_strength": f"{active_strength}/10",
        "subscores": {
            "trend_pct": trend_pct,
            "momentum_pct": momentum_pct,
            "volume_pct": volume_pct,
            "liquidity_pct": liquidity_pct
        },
        "entry_confirmation": {
            "ema_check": bool(ema_check),
            "macd_check": bool(macd_check),
            "rsi_check": bool(rsi_check),
            "vol_check": bool(vol_check),
            "liq_check": bool(liq_check),
            "score_pct": entry_score
        },
        "godzilla": {
            "imbalance_it": imbalance_it,
            "direction": godzilla_dir,
            "sigma_smooth": round(sigma_smooth, 2),
            "leverage_factor": lev_factor,
            "suggested_max_lev": f"{suggested_lev}x"
        },
        "expected_move": {
            "move_txt": exp_move_txt,
            "range_txt": exp_range_txt,
            "range_low": exp_range_low,
            "range_high": exp_range_high
        },
        "trade_plan": {
            "direction": "BUY" if bull_bias else "SELL",
            "entry": last_price,
            "sl": sl_price,
            "tp1": tp1_price,
            "tp2": tp2_price,
            "tp3": tp3_price
        }
    }
