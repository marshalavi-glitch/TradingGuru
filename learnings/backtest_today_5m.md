# 📊 5-Min Dual-Direction Option Premium Backtest (July 22, 2026)

This backtest evaluates intraday option trades triggered by **Monthly Matrix Level** touches on a 5-minute timeframe. It simulates **ATM Call Options (CE)** for Support Bounces and **ATM Put Options (PE)** for Resistance Rejections. Option pricing utilizes a **Delta of 0.5** with an entry premium at **1.5% of spot entry**.

| Symbol | Type | Level Touched | Touch Time | Spot Entry | Spot SL | Opt Entry | Opt Exit | Opt Max | ROI (%) | Max ROI (%) | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **GLAXO** | 🔵 CALL (CE) | S6 (2461.05) | 09:25 am | ₹2467.50 | ₹2456.13 | ₹37.01 | ₹80.26 | ₹84.66 | 🟢 **116.9%** | **128.7%** | Target/Close Exit |
| **JKCEMENT** | 🔵 CALL (CE) | S3 (5583.61) | 09:25 am | ₹5596.50 | ₹5572.44 | ₹83.95 | ₹153.20 | ₹180.70 | 🟢 **82.5%** | **115.3%** | Target/Close Exit |
| **POONAWALLA** | 🔵 CALL (CE) | S4 (458.69) | 09:25 am | ₹458.40 | ₹457.77 | ₹6.88 | ₹13.18 | ₹14.63 | 🟢 **91.6%** | **112.7%** | Target/Close Exit |
| **EXIDEIND** | 🔵 CALL (CE) | S4 (435.64) | 10:25 am | ₹437.00 | ₹434.77 | ₹6.55 | ₹11.73 | ₹14.46 | 🟢 **78.9%** | **120.5%** | Target/Close Exit |
| **ABBOTINDIA** | 🔵 CALL (CE) | S5 (28216.30) | 09:45 am | ₹28340.00 | ₹28159.87 | ₹425.10 | ₹705.10 | ₹725.10 | 🟢 **65.9%** | **70.6%** | Target/Close Exit |
| **SCHAEFFLER** | 🔵 CALL (CE) | S6 (4093.92) | 09:55 am | ₹4120.00 | ₹4085.73 | ₹61.80 | ₹104.05 | ₹106.15 | 🟢 **68.4%** | **71.8%** | Target/Close Exit |
| **LLOYDSME** | 🟠 PUT (PE) | R3 (1947.87) | 09:15 am | ₹1940.70 | ₹1951.77 | ₹29.11 | ₹66.41 | ₹67.21 | 🟢 **128.1%** | **130.9%** | Target/Close Exit |
| **LODHA** | 🟠 PUT (PE) | R3 (1205.21) | 09:15 am | ₹1185.00 | ₹1207.62 | ₹17.77 | ₹27.77 | ₹33.70 | 🟢 **56.3%** | **89.6%** | Target/Close Exit |
| **SRF** | 🟠 PUT (PE) | R3 (2967.38) | 09:15 am | ₹2956.60 | ₹2973.31 | ₹44.35 | ₹112.00 | ₹115.15 | 🟢 **152.5%** | **159.6%** | Target/Close Exit |
| **COCHINSHIP** | 🟠 PUT (PE) | R3 (1408.82) | 09:15 am | ₹1394.70 | ₹1411.64 | ₹20.92 | ₹33.82 | ₹36.77 | 🟢 **61.7%** | **75.8%** | Target/Close Exit |
| **POWERINDIA** | 🟠 PUT (PE) | R6 (32965.70) | 09:15 am | ₹32770.00 | ₹33031.63 | ₹491.55 | ₹811.55 | ₹921.55 | 🟢 **65.1%** | **87.5%** | Target/Close Exit |

### 💡 Key Observations:
1. **Support Bounces (CE)**: High performance (65% to 116% returns) as the market rebounded off deep Monthly Support boundaries.
2. **Resistance Rejections (PE)**: Put options on resistance rejections also performed exceptionally well, capturing down-moves of **+50% to +125%** options premium appreciation as heavyweights rejected their Monthly Resistance (R3/R6) lines.
