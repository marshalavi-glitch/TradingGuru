import React, { useEffect, useRef, useMemo } from 'react';
import { Candle } from '../utils/profileCalculator';
import { calculateMacd, calculateRsi, calculateEma } from '../utils/swingCalculator';

interface MacdRsiSubChartProps {
  candles: Candle[];
  symbol?: string;
  fastLength?: number;
  slowLength?: number;
  signalLength?: number;
  rsiLength?: number;
  rsiMaLength?: number;
  upperThreshold?: number;
  lowerThreshold?: number;
  height?: number;
}

export const MacdRsiSubChart: React.FC<MacdRsiSubChartProps> = ({
  candles,
  symbol = 'NSE:NIFTY',
  fastLength = 12,
  slowLength = 26,
  signalLength = 9,
  rsiLength = 14,
  rsiMaLength = 20,
  upperThreshold = 65,
  lowerThreshold = 35,
  height = 280
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Compute indicators data
  const indicatorData = useMemo(() => {
    if (!candles || candles.length < 20) return null;
    const closes = candles.map(c => c.close);
    
    // MACD {26, 12, 9}
    const { macdLine, signalLine, histogram } = calculateMacd(closes, fastLength, slowLength, signalLength);
    
    // RSI {14, 20}
    const rsiLine = calculateRsi(closes, rsiLength);
    
    // RSI Signal MA (20 period SMA of RSI)
    const rsiMaLine: number[] = new Array(rsiLine.length).fill(50);
    for (let i = 0; i < rsiLine.length; i++) {
      if (i < rsiMaLength - 1) {
        let sum = 0;
        for (let k = 0; k <= i; k++) sum += rsiLine[k];
        rsiMaLine[i] = sum / (i + 1);
      } else {
        let sum = 0;
        for (let k = 0; k < rsiMaLength; k++) sum += rsiLine[i - k];
        rsiMaLine[i] = sum / rsiMaLength;
      }
    }

    const lastIdx = candles.length - 1;
    return {
      macdLine,
      signalLine,
      histogram,
      rsiLine,
      rsiMaLine,
      latest: {
        macd: macdLine[lastIdx] || 0,
        signal: signalLine[lastIdx] || 0,
        hist: histogram[lastIdx] || 0,
        rsi: rsiLine[lastIdx] || 50,
        rsiMa: rsiMaLine[lastIdx] || 50
      }
    };
  }, [candles, fastLength, slowLength, signalLength, rsiLength, rsiMaLength]);

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current || !indicatorData || candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerRef.current.clientWidth || 800;
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Deep Midnight Chart Theme matching user screenshot
    ctx.fillStyle = '#0b1320';
    ctx.fillRect(0, 0, width, height);

    const paddingLeft = 10;
    const paddingRight = 60;
    const chartW = width - paddingLeft - paddingRight;

    const macdPaneH = Math.floor(height * 0.48);
    const rsiPaneTop = Math.floor(height * 0.52);
    const rsiPaneH = height - rsiPaneTop;

    const n = candles.length;
    const stepX = chartW / Math.max(1, n - 1);

    const getX = (idx: number) => paddingLeft + idx * stepX;

    // -------------------------------------------------------------
    // PANE 1: MACD Pane {26, 12, 9}
    // -------------------------------------------------------------
    const macdBins = indicatorData.macdLine;
    const sigBins = indicatorData.signalLine;
    const histBins = indicatorData.histogram;

    let macdMin = Infinity;
    let macdMax = -Infinity;
    for (let i = 0; i < n; i++) {
      if (macdBins[i] < macdMin) macdMin = macdBins[i];
      if (macdBins[i] > macdMax) macdMax = macdBins[i];
      if (sigBins[i] < macdMin) macdMin = sigBins[i];
      if (sigBins[i] > macdMax) macdMax = sigBins[i];
      if (histBins[i] < macdMin) macdMin = histBins[i];
      if (histBins[i] > macdMax) macdMax = histBins[i];
    }
    const macdMargin = Math.max(0.5, (macdMax - macdMin) * 0.1);
    macdMin -= macdMargin;
    macdMax += macdMargin;
    const macdRange = macdMax - macdMin || 1;

    const getMacdY = (val: number) => {
      return 25 + ((macdMax - val) / macdRange) * (macdPaneH - 30);
    };

    // MACD Header Label (matching screenshot)
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Moving Average Convergence/Div... {${slowLength}, ${fastLength}, ${signalLength}}`, 12, 16);

    // Header Value Pills
    const macdValStr = indicatorData.latest.macd.toFixed(2);
    const sigValStr = indicatorData.latest.signal.toFixed(2);
    const histValStr = indicatorData.latest.hist.toFixed(3);

    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.fillRect(285, 4, 45, 15);
    ctx.fillStyle = '#60a5fa';
    ctx.fillText(macdValStr, 290, 16);

    ctx.fillStyle = 'rgba(236, 72, 153, 0.25)';
    ctx.fillRect(335, 4, 45, 15);
    ctx.fillStyle = '#ec4899';
    ctx.fillText(sigValStr, 340, 16);

    ctx.fillStyle = indicatorData.latest.hist >= 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
    ctx.fillRect(385, 4, 50, 15);
    ctx.fillStyle = indicatorData.latest.hist >= 0 ? '#10b981' : '#ef4444';
    ctx.fillText(histValStr, 390, 16);

    // MACD Zero Line
    const macdZeroY = getMacdY(0);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, macdZeroY);
    ctx.lineTo(width - paddingRight, macdZeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw MACD Histogram Bars
    const barWidth = Math.max(1.5, stepX * 0.7);
    for (let i = 0; i < n; i++) {
      const x = getX(i);
      const val = histBins[i];
      const y = getMacdY(val);
      ctx.fillStyle = val >= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.75)';
      ctx.fillRect(x - barWidth / 2, Math.min(macdZeroY, y), barWidth, Math.abs(y - macdZeroY));
    }

    // Draw Signal Line (Pink)
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = getX(i);
      const y = getMacdY(sigBins[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw MACD Line (Blue)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = getX(i);
      const y = getMacdY(macdBins[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Horizontal separator between MACD & RSI
    ctx.strokeStyle = 'rgba(30, 58, 138, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rsiPaneTop);
    ctx.lineTo(width, rsiPaneTop);
    ctx.stroke();

    // -------------------------------------------------------------
    // PANE 2: Relative Strength Index Pane {14, 20}
    // -------------------------------------------------------------
    const rsiBins = indicatorData.rsiLine;
    const rsiMaBins = indicatorData.rsiMaLine;

    const rsiMin = 10;
    const rsiMax = 90;
    const rsiRange = rsiMax - rsiMin;

    const getRsiY = (val: number) => {
      const clamped = Math.max(rsiMin, Math.min(rsiMax, val));
      return rsiPaneTop + 22 + ((rsiMax - clamped) / rsiRange) * (rsiPaneH - 30);
    };

    // RSI Header Title
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Relative strength index {${rsiLength}, ${rsiMaLength}}`, 12, rsiPaneTop + 16);

    // RSI Value Pills
    const rsiValStr = indicatorData.latest.rsi.toFixed(2);
    const rsiMaValStr = indicatorData.latest.rsiMa.toFixed(2);

    ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.fillRect(235, rsiPaneTop + 4, 45, 15);
    ctx.fillStyle = '#c084fc';
    ctx.fillText(rsiValStr, 240, rsiPaneTop + 16);

    ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
    ctx.fillRect(285, rsiPaneTop + 4, 45, 15);
    ctx.fillStyle = '#facc15';
    ctx.fillText(rsiMaValStr, 290, rsiPaneTop + 16);

    // RSI Threshold Dotted Lines (Upper 70/65 and Lower 30/35)
    const upperY = getRsiY(upperThreshold);
    const lowerY = getRsiY(lowerThreshold);

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    ctx.beginPath();
    ctx.moveTo(paddingLeft, upperY);
    ctx.lineTo(width - paddingRight, upperY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(paddingLeft, lowerY);
    ctx.lineTo(width - paddingRight, lowerY);
    ctx.stroke();

    ctx.setLineDash([]);

    // 1. Red Filled Area Above Upper Threshold (Overbought)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    for (let i = 0; i < n - 1; i++) {
      const r1 = rsiBins[i];
      const r2 = rsiBins[i + 1];
      if (r1 > upperThreshold || r2 > upperThreshold) {
        const x1 = getX(i);
        const x2 = getX(i + 1);
        const y1 = getRsiY(r1);
        const y2 = getRsiY(r2);
        ctx.beginPath();
        ctx.moveTo(x1, upperY);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, upperY);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 2. Green Triangles Below Lower Threshold (Oversold Signal Markers matching screenshot)
    for (let i = 1; i < n - 1; i++) {
      const r = rsiBins[i];
      const prevR = rsiBins[i - 1];
      if (r <= lowerThreshold || (prevR <= lowerThreshold && r > lowerThreshold)) {
        const x = getX(i);
        const y = lowerY + 8;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.moveTo(x - 5, y + 8);
        ctx.lineTo(x + 5, y + 8);
        ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw RSI Signal MA Line (Gold/Yellow 20 SMA)
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = getX(i);
      const y = getRsiY(rsiMaBins[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw RSI Line (Purple 14 RSI)
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = getX(i);
      const y = getRsiY(rsiBins[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Right Y-Axis Scale Labels
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#60a5fa';
    ctx.fillText(indicatorData.latest.macd.toFixed(1), width - paddingRight + 6, macdZeroY);
    ctx.fillStyle = '#a855f7';
    ctx.fillText(indicatorData.latest.rsi.toFixed(1), width - paddingRight + 6, getRsiY(indicatorData.latest.rsi));

  }, [candles, indicatorData, height, fastLength, slowLength, signalLength, rsiLength, rsiMaLength, upperThreshold, lowerThreshold]);

  if (!indicatorData) return null;

  return (
    <div ref={containerRef} style={{ width: '100%', background: '#0b1320', borderRadius: '8px', border: '1px solid #1e3a8a', overflow: 'hidden', padding: '4px 0' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
};
