import React, { useState, useMemo } from 'react';
import type { Candle } from '../utils/profileCalculator';
import { Zap } from 'lucide-react';

interface AdvIndicatorPanelProps {
  candles: Candle[];
  symbol?: string;
  timeframe?: string;
}

export const AdvIndicatorPanel: React.FC<AdvIndicatorPanelProps> = ({ candles, symbol, timeframe }) => {
  const [len, setLen] = useState<number>(14);
  const [aggregation, setAggregation] = useState<'simple MA' | 'smoothed MA' | 'cumulative' | 'disable'>('smoothed MA');
  const [priceEnable, setPriceEnable] = useState<boolean>(false);
  const [baseEnable, setBaseEnable] = useState<boolean>(false);
  const [showPerCandleRatios, setShowPerCandleRatios] = useState<boolean>(true);

  const advData = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const n = candles.length;
    const ch: number[] = [];
    const tr: number[] = [];
    const AD_ratio: number[] = [];
    const base_price_vol: number[] = [];
    const base_AD: number[] = [];

    for (let i = 0; i < n; i++) {
      const c = candles[i];
      const prevC = i > 0 ? candles[i - 1] : c;
      const changeVal = c.close - prevC.close;
      ch.push(changeVal);

      const highLow = c.high - c.low;
      const highPrevClose = Math.abs(c.high - prevC.close);
      const lowPrevClose = Math.abs(c.low - prevC.close);
      const trueRange = Math.max(highLow, highPrevClose, lowPrevClose) || 0.0001;
      tr.push(trueRange);

      const adRatioVal = changeVal / trueRange;
      AD_ratio.push(adRatioVal);

      const signAd = adRatioVal > 0 ? 1 : adRatioVal < 0 ? -1 : 0;
      const baseVal = baseEnable ? signAd : 1;

      const hlc3 = (c.high + c.low + c.close) / 3;
      const rawVol = c.volume || 100;
      const volVal = priceEnable ? rawVol * hlc3 : rawVol;

      const basePriceVol = baseVal * volVal;
      base_price_vol.push(basePriceVol);

      const baseAd = basePriceVol * Math.abs(adRatioVal);
      base_AD.push(baseAd);
    }

    const sma = (series: number[], length: number): number[] => {
      const res: number[] = [];
      for (let i = 0; i < series.length; i++) {
        if (i < length - 1) {
          res.push(0);
        } else {
          let sum = 0;
          for (let k = 0; k < length; k++) sum += series[i - k];
          res.push(sum / length);
        }
      }
      return res;
    };

    const rma = (series: number[], length: number): number[] => {
      const res: number[] = [];
      let prevRma = 0;
      for (let i = 0; i < series.length; i++) {
        if (i < length - 1) {
          let sum = 0;
          for (let k = 0; k <= i; k++) sum += series[k];
          prevRma = sum / (i + 1);
          res.push(prevRma);
        } else if (i === length - 1) {
          let sum = 0;
          for (let k = 0; k < length; k++) sum += series[k];
          prevRma = sum / length;
          res.push(prevRma);
        } else {
          const currentRma = (prevRma * (length - 1) + series[i]) / length;
          prevRma = currentRma;
          res.push(currentRma);
        }
      }
      return res;
    };

    let MA_base_price_vol: number[] = [];
    let MA_AD: number[] = [];

    if (aggregation === 'cumulative') {
      let cumAd = 0;
      let cumVol = 0;
      for (let i = 0; i < n; i++) {
        const signAd = AD_ratio[i] > 0 ? 1 : AD_ratio[i] < 0 ? -1 : 0;
        const volVal = priceEnable ? (candles[i].volume || 100) * ((candles[i].high + candles[i].low + candles[i].close) / 3) : (candles[i].volume || 100);
        cumVol += signAd * volVal;
        cumAd += AD_ratio[i] * volVal;
        MA_base_price_vol.push(cumVol);
        MA_AD.push(cumAd);
      }
    } else if (aggregation === 'simple MA') {
      MA_base_price_vol = sma(base_price_vol, len);
      MA_AD = sma(base_AD, len);
    } else if (aggregation === 'smoothed MA') {
      MA_base_price_vol = rma(base_price_vol, len);
      MA_AD = rma(base_AD, len);
    } else {
      MA_base_price_vol = base_price_vol;
      MA_AD = base_AD;
    }

    return candles.map((c, i) => ({
      time: c.time,
      ch: ch[i],
      tr: tr[i],
      AD_ratio: AD_ratio[i],
      base_price_vol: base_price_vol[i],
      base_AD: base_AD[i],
      MA_base_price_vol: MA_base_price_vol[i],
      MA_AD: MA_AD[i]
    }));
  }, [candles, len, aggregation, priceEnable, baseEnable]);

  const width = 800;
  const height = 130;
  const paddingX = 24;
  const baselineY = height - 20; // Bottom baseline at y = 110
  const usableHeight = height - 32; // Usable height for bars/lines = 98px

  if (!advData || advData.length === 0) return null;

  const chartData = advData.slice(-60); // Last 60 candles
  const maxVal = Math.max(
    ...chartData.map(d => Math.abs(d.base_price_vol)),
    ...chartData.map(d => Math.abs(d.base_AD)),
    ...chartData.map(d => Math.abs(d.MA_AD || 0)),
    ...chartData.map(d => Math.abs(d.MA_base_price_vol || 0)),
    1
  ) * 1.12;

  const stepX = (width - paddingX * 2) / Math.max(chartData.length - 1, 1);

  const maAdPoints: string[] = [];
  const maVolPoints: string[] = [];

  chartData.forEach((d, i) => {
    const x = paddingX + i * stepX;
    const yAd = baselineY - ((d.MA_AD || 0) / maxVal) * usableHeight;
    const yVol = baselineY - ((d.MA_base_price_vol || 0) / maxVal) * usableHeight;
    maAdPoints.push(`${x},${yAd}`);
    maVolPoints.push(`${x},${yVol}`);
  });

  const latest = chartData[chartData.length - 1];

  // Check if criteria matched on latest candle or recent candles
  const activeAlertBar = chartData.find(d => (d.base_AD > d.MA_base_price_vol) || (d.MA_AD > d.MA_base_price_vol && d.ch > 0) || (d.AD_ratio >= 0.85 && d.ch > 0));
  const hasActiveAlert = !!activeAlertBar;

  return (
    <div style={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
      
      {/* PINE SCRIPT CONTROLS HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📈 Accumulation/Distribution Volume (ADV)</span>
          </h4>
        </div>

        {/* Inputs Control Panel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Agg:</span>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as any)}
              style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '2px 6px', fontSize: '10px' }}
            >
              <option value="smoothed MA">smoothed MA (RMA)</option>
              <option value="simple MA">simple MA (SMA)</option>
              <option value="cumulative">cumulative</option>
              <option value="disable">disable</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Len:</span>
            <input
              type="number"
              min="1"
              max="100"
              value={len}
              onChange={(e) => setLen(Number(e.target.value) || 14)}
              style={{ background: '#1e293b', color: '#ffffff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', width: '42px' }}
            />
          </div>

          <label style={{ fontSize: '10px', color: '#00f2fe', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showPerCandleRatios} onChange={(e) => setShowPerCandleRatios(e.target.checked)} />
            <span>Ratios</span>
          </label>

          <label style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={priceEnable} onChange={(e) => setPriceEnable(e.target.checked)} />
            <span>Money Vol</span>
          </label>

          <label style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={baseEnable} onChange={(e) => setBaseEnable(e.target.checked)} />
            <span>Baseline</span>
          </label>
        </div>
      </div>

      {/* SVG CHART DRAWING (COMPACT 130px HEIGHT FOR ADV CANDLES) */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: '#090d16', borderRadius: '6px' }}>
          {/* Bottom baseline */}
          <line x1={paddingX} y1={baselineY} x2={width - paddingX} y2={baselineY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />

          {/* Volume Columns & A/D Volume Columns starting from baselineY going up */}
          {chartData.map((d, i) => {
            const x = paddingX + i * stepX;
            const barW = Math.max(stepX * 0.65, 2);
            
            const isUp = d.ch >= 0;

            const isStrongBullish = d.AD_ratio >= 0.85 && isUp;
            const isStrongBearish = d.AD_ratio <= -0.85 && !isUp;
            const isCrossover = (d.base_AD > d.MA_base_price_vol) || (d.MA_AD > d.MA_base_price_vol && isUp);

            let volColor = isUp ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)';
            let adColor = isUp ? '#22c55e' : '#ef4444';
            let strokeColor = 'none';
            let strokeW = '0';

            if (isStrongBullish) {
              volColor = 'rgba(0, 242, 254, 0.45)';
              adColor = '#00f2fe';
              strokeColor = '#00f2fe';
              strokeW = '2';
            } else if (isStrongBearish) {
              volColor = 'rgba(244, 63, 94, 0.45)';
              adColor = '#f43f5e';
              strokeColor = '#f43f5e';
              strokeW = '2';
            } else if (isCrossover) {
              volColor = 'rgba(255, 215, 0, 0.35)';
              adColor = '#ffd700';
              strokeColor = '#ffd700';
              strokeW = '1.5';
            }

            const volH = Math.max(((Math.abs(d.base_price_vol) / maxVal) * usableHeight), 1);
            const adH = Math.max(((Math.abs(d.base_AD) / maxVal) * usableHeight), 1);

            const yVol = baselineY - volH;
            const yAd = baselineY - adH;

            return (
              <g key={i}>
                {/* Volume Base Column (wide) */}
                <rect x={x - barW / 2} y={yVol} width={barW} height={volH} fill={volColor} stroke={strokeColor} strokeWidth={strokeW} rx="1" />
                {/* A/D Inner Column (narrower) */}
                {adColor !== 'transparent' && (
                  <rect x={x - barW / 3} y={yAd} width={barW / 1.5} height={adH} fill={adColor} stroke={isStrongBullish ? '#ffffff' : 'none'} strokeWidth={isStrongBullish ? '1' : '0'} rx="1" />
                )}

                {showPerCandleRatios && (
                  <text
                    x={x}
                    y={height - 4}
                    fill={isStrongBullish ? '#00f2fe' : isStrongBearish ? '#f43f5e' : isUp ? '#4ade80' : '#f87171'}
                    fontSize="5.5"
                    fontWeight="700"
                    textAnchor="end"
                    transform={`rotate(-45, ${x}, ${height - 4})`}
                  >
                    {d.AD_ratio >= 0 ? '.' : '-.'}{Math.round(Math.abs(d.AD_ratio) * 100).toString().padStart(2, '0')}
                  </text>
                )}
              </g>
            );
          })}

          {/* Volume MA Line (#ff9900) */}
          <polyline fill="none" stroke="#ff9900" strokeWidth="2" strokeDasharray="3 3" points={maVolPoints.join(' ')} />

          {/* ADV MA Line (#3b82f6) */}
          <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" points={maAdPoints.join(' ')} />
        </svg>
      </div>

      {/* VALUE METRICS LEGEND (MOVED BELOW ADV CHART) */}
      {latest && (
        <div style={{ display: 'flex', gap: '14px', fontSize: '11px', background: 'rgba(30, 41, 59, 0.5)', padding: '6px 10px', borderRadius: '6px', flexWrap: 'wrap' }}>
          <div>A/D Ratio: <strong style={{ color: latest.AD_ratio >= 0.85 ? '#00f2fe' : latest.AD_ratio >= 0 ? '#4ade80' : '#f87171' }}>{latest.AD_ratio > 0 ? '+' : ''}{latest.AD_ratio.toFixed(4)}</strong></div>
          <div>A/D Vol: <strong style={{ color: latest.ch >= 0 ? '#65D25B' : '#FE6B69' }}>{Math.round(latest.base_AD).toLocaleString()}</strong></div>
          <div>A/D MA ({len}): <strong style={{ color: '#4477ff' }}>{Math.round(latest.MA_AD || 0).toLocaleString()}</strong></div>
          <div>Vol MA ({len}): <strong style={{ color: '#ff9900' }}>{Math.round(latest.MA_base_price_vol || 0).toLocaleString()}</strong></div>
        </div>
      )}

      {/* LIVE CRITERIA ALERT BANNER (MOVED BELOW ADV CHART) */}
      {hasActiveAlert && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(245, 158, 11, 0.15))',
          border: '1px solid #00f2fe',
          borderRadius: '6px',
          padding: '8px 12px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 0 12px rgba(0, 242, 254, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} color="#00f2fe" className="spin" />
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#00f2fe' }}>
                🚨 ADV BREAKOUT ALERT: Accumulation Criteria Matched on {symbol || 'Chart'}!
              </div>
              <div style={{ fontSize: '10px', color: '#e0f2fe', marginTop: '1px' }}>
                A/D Ratio &ge; 0.85+ with Bullish Closing High. Highlighted in <strong>Electric Cyan (#00f2fe)</strong> & <strong>Gold (#ffd700)</strong>.
              </div>
            </div>
          </div>
          <span style={{ background: '#00f2fe', color: '#000000', fontSize: '10px', fontWeight: '900', padding: '3px 8px', borderRadius: '16px' }}>
            ALERT TRIGGERED
          </span>
        </div>
      )}

    </div>
  );
};
