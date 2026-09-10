import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { Candle } from '../utils/profileCalculator';
import type { MatrixSeriesData } from '../utils/matrixCalculator';

interface ChartContainerProps {
  candles: Candle[];
  symbol: string;
  timeframe?: string;
  matrixSeriesData?: MatrixSeriesData | null;
  pocPrice?: number;
  vahPrice?: number;
  valPrice?: number;
  ibHigh?: number;
  ibLow?: number;
  
  // PDF-based reference levels
  priorPocPrice?: number;
  priorVahPrice?: number;
  priorValPrice?: number;
  poorHighPrice?: number;
  poorLowPrice?: number;
  untestedPocs?: { price: number; date: string }[];
  failedAuctions?: { price: number; type: 'high' | 'low'; date: string }[];
  ddGapTop?: number;
  ddGapBottom?: number;
  threeDayBalanceHigh?: number;
  threeDayBalanceLow?: number;

  // Session Opening props
  openPrice?: number;
  openingType?: string;

  // Active single prints
  activeSinglePrints?: { start: number; end: number }[];
  legacySapnas?: { start: number; end: number; date: string }[];

  // Visible price range change callback
  onVisiblePriceRangeChange?: (range: { min: number; max: number; paneHeight: number } | null) => void;

  // GEX Levels props (ready for scanner updates)
  gexCallWall?: number;
  gexPutWall?: number;
  gexFlipZone?: number;
  gexMaxPain?: number;
  sessionPeriod?: 'daily' | 'weekly' | 'monthly';
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  candles,
  symbol,
  timeframe = '30',
  matrixSeriesData,
  sessionPeriod,
  pocPrice,
  vahPrice,
  valPrice,
  ibHigh,
  ibLow,
  priorPocPrice,
  priorVahPrice,
  priorValPrice,
  poorHighPrice,
  poorLowPrice,
  untestedPocs,
  failedAuctions,
  ddGapTop,
  ddGapBottom,
  threeDayBalanceHigh,
  threeDayBalanceLow,
  openPrice,
  openingType,
  activeSinglePrints,
  legacySapnas,
  onVisiblePriceRangeChange,
  gexCallWall,
  gexPutWall,
  gexFlipZone,
  gexMaxPain
}) => {
  const [candleStyle, setCandleStyle] = useState<'japanese' | 'heikin-ashi'>('japanese');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  // Custom price lines for profile metrics
  const pocLineRef = useRef<any>(null);
  const vahLineRef = useRef<any>(null);
  const valLineRef = useRef<any>(null);

  // Price lines for Initial Balance & Extensions
  const ibHighLineRef = useRef<any>(null);
  const ibLowLineRef = useRef<any>(null);
  const ext1618UpLineRef = useRef<any>(null);
  const ext1618DownLineRef = useRef<any>(null);
  const ext2618UpLineRef = useRef<any>(null);
  const ext2618DownLineRef = useRef<any>(null);
  const ext3618UpLineRef = useRef<any>(null);
  const ext3618DownLineRef = useRef<any>(null);

  // PDF references
  const priorPocLineRef = useRef<any>(null);
  const priorVahLineRef = useRef<any>(null);
  const priorValLineRef = useRef<any>(null);
  const poorHighLineRef = useRef<any>(null);
  const poorLowLineRef = useRef<any>(null);
  const ddGapTopLineRef = useRef<any>(null);
  const ddGapBottomLineRef = useRef<any>(null);
  const threeDayBalHighLineRef = useRef<any>(null);
  const threeDayBalLowLineRef = useRef<any>(null);
  const untestedPocLinesRef = useRef<any[]>([]);
  const failedAuctionLinesRef = useRef<any[]>([]);
  const activeSinglePrintLinesRef = useRef<any[]>([]);
  const legacySapnaLinesRef = useRef<any[]>([]);
  const matrixSeriesRef = useRef<any[]>([]);

  // Open line
  const openPriceLineRef = useRef<any>(null);
  const lastSymbolTimeframeRef = useRef<string>('');

  // GEX Refs
  const gexCallWallLineRef = useRef<any>(null);
  const gexPutWallLineRef = useRef<any>(null);
  const gexFlipZoneLineRef = useRef<any>(null);
  const gexMaxPainLineRef = useRef<any>(null);

  const onVisiblePriceRangeChangeRef = useRef(onVisiblePriceRangeChange);
  const handleRangeChangeRef = useRef<() => void>(() => {});

  useEffect(() => {
    onVisiblePriceRangeChangeRef.current = onVisiblePriceRangeChange;
  }, [onVisiblePriceRangeChange]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart instance
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0d1017' },
        textColor: '#9ca3af',
        fontSize: 12,
        fontFamily: 'Outfit, sans-serif'
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' }
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal
        vertLine: {
          color: '#8b5cf6',
          width: 1,
          style: 3, // LineStyle.Dashed
          labelBackgroundColor: '#8b5cf6'
        },
        horzLine: {
          color: '#8b5cf6',
          width: 1,
          style: 3, // LineStyle.Dashed
          labelBackgroundColor: '#8b5cf6'
        }
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        visible: true
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false
      }
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Add Volume Series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: 'volume-scale'
    });
    
    chart.priceScale('volume-scale').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0
      },
      visible: false
    });
    volumeSeriesRef.current = volumeSeries;

    // Add Anchored VWAP Series
    const vwapSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: 2,
      priceLineVisible: false,
      title: 'VWAP'
    });
    vwapSeriesRef.current = vwapSeries;

    // Add Matrix Matrix Step Line Series
    const colors = {
      upper: '#ef4444', // Red
      mid: '#fb923c',   // Orange
      lower: '#10b981'  // Green
    };

    const matrixConfigs = [
      { color: colors.upper, title: 'L1' },
      { color: colors.upper, title: 'L2' },
      { color: colors.mid,   title: 'L3' },
      { color: colors.upper, title: 'L4' },
      { color: colors.mid,   title: 'L5' },
      { color: colors.mid,   title: 'L6' },
      { color: colors.lower, title: 'L7' },
      { color: colors.mid,   title: 'L8' },
      { color: colors.lower, title: 'L9' },
      { color: colors.lower, title: 'L10' }
    ];

    const matrixSeriesList = matrixConfigs.map((cfg) => {
      return chart.addLineSeries({
        color: cfg.color,
        lineWidth: 1,
        lineType: 2, // LineType.WithSteps
        priceLineVisible: false,
        lastValueVisible: true,
        title: cfg.title
      });
    });
    matrixSeriesRef.current = matrixSeriesList;

    const handleRangeChange = () => {
      if (!chartRef.current || !candlestickSeriesRef.current) return;
      try {
        const height = chartRef.current.paneSize().height;
        const min = candlestickSeriesRef.current.coordinateToPrice(height);
        const max = candlestickSeriesRef.current.coordinateToPrice(0);
        if (min !== null && max !== null && min < max) {
          onVisiblePriceRangeChangeRef.current?.({ min, max, paneHeight: height });
        }
      } catch (e) {
        // Safe catch if paneSize is not ready yet
      }
    };

    handleRangeChangeRef.current = handleRangeChange;

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(handleRangeChange);
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
        requestAnimationFrame(handleRangeChange);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    const container = chartContainerRef.current;
    const triggerUpdate = () => {
      requestAnimationFrame(handleRangeChange);
    };

    if (container) {
      container.addEventListener('wheel', triggerUpdate, { passive: true });
      container.addEventListener('mousemove', triggerUpdate);
      container.addEventListener('touchmove', triggerUpdate, { passive: true });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (container) {
        container.removeEventListener('wheel', triggerUpdate);
        container.removeEventListener('mousemove', triggerUpdate);
        container.removeEventListener('touchmove', triggerUpdate);
      }
      chart.remove();
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    let chartData = [];
    if (candleStyle === 'heikin-ashi') {
      let prevHaOpen = null;
      let prevHaClose = null;
      
      chartData = candles.map((c, idx) => {
        const haClose = (c.open + c.high + c.low + c.close) / 4;
        let haOpen;
        if (idx === 0 || prevHaOpen === null) {
          haOpen = (c.open + c.close) / 2;
        } else {
          haOpen = (prevHaOpen + prevHaClose) / 2;
        }
        const haHigh = Math.max(c.high, haOpen, haClose);
        const haLow = Math.min(c.low, haOpen, haClose);
        
        prevHaOpen = haOpen;
        prevHaClose = haClose;
        
        return {
          time: c.time as Time,
          open: haOpen,
          high: haHigh,
          low: haLow,
          close: haClose
        };
      });
    } else {
      chartData = candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));
    }

    const volumeData = candles.map((c, idx) => {
      let isBullish = c.close >= c.open;
      if (candleStyle === 'heikin-ashi') {
        const ha = chartData[idx];
        isBullish = ha.close >= ha.open;
      }
      return {
        time: c.time as Time,
        value: c.volume,
        color: isBullish ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
      };
    });

    candlestickSeriesRef.current.setData(chartData);
    volumeSeriesRef.current.setData(volumeData);

    // Calculate and set daily-anchored VWAP
    if (vwapSeriesRef.current) {
      let currentDayStr = '';
      let cumulativeVolume = 0;
      let cumulativePriceVolume = 0;

      const vwapData = candles.map((c) => {
        const date = new Date((c.time as number) * 1000);
        const dayStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

        if (dayStr !== currentDayStr) {
          currentDayStr = dayStr;
          cumulativeVolume = 0;
          cumulativePriceVolume = 0;
        }

        const ohlcPrice = (c.open + c.high + c.low + c.close) / 4;
        cumulativePriceVolume += ohlcPrice * c.volume;
        cumulativeVolume += c.volume;

        return {
          time: c.time as Time,
          value: cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : ohlcPrice
        };
      });

      vwapSeriesRef.current.setData(vwapData);
    }

    // Set Matrix Matrix series data
    if (matrixSeriesRef.current.length === 10 && matrixSeriesData) {
      matrixSeriesRef.current[0].setData(matrixSeriesData.level1);
      matrixSeriesRef.current[1].setData(matrixSeriesData.level2);
      matrixSeriesRef.current[2].setData(matrixSeriesData.level3);
      matrixSeriesRef.current[3].setData(matrixSeriesData.level4);
      matrixSeriesRef.current[4].setData(matrixSeriesData.level5);
      matrixSeriesRef.current[5].setData(matrixSeriesData.level6);
      matrixSeriesRef.current[6].setData(matrixSeriesData.level7);
      matrixSeriesRef.current[7].setData(matrixSeriesData.level8);
      matrixSeriesRef.current[8].setData(matrixSeriesData.level9);
      matrixSeriesRef.current[9].setData(matrixSeriesData.level10);
    } else if (matrixSeriesRef.current.length === 10) {
      matrixSeriesRef.current.forEach(s => s.setData([]));
    }
    
    // Fit content logic
    const currentKey = `${symbol}-${timeframe}-${sessionPeriod || 'daily'}`;
    if (lastSymbolTimeframeRef.current !== currentKey) {
      if (sessionPeriod === 'monthly' && candles.length > 150) {
        chartRef.current?.timeScale().setVisibleLogicalRange({
          from: candles.length - 150,
          to: candles.length + 5,
        });
      } else if (sessionPeriod === 'weekly' && candles.length > 100) {
        chartRef.current?.timeScale().setVisibleLogicalRange({
          from: candles.length - 100,
          to: candles.length + 3,
        });
      } else {
        chartRef.current?.timeScale().fitContent();
      }
      lastSymbolTimeframeRef.current = currentKey;
    }

    // Propagate visible range
    requestAnimationFrame(() => {
      handleRangeChangeRef.current();
    });
  }, [candles, symbol, timeframe, sessionPeriod, matrixSeriesData, candleStyle]);

  // Update Price Lines
  useEffect(() => {
    const series = candlestickSeriesRef.current;
    if (!series) return;

    // Helper to clear a line ref
    const clearLine = (ref: React.MutableRefObject<any>) => {
      if (ref.current) {
        try { series.removePriceLine(ref.current); } catch (e) {}
        ref.current = null;
      }
    };

    // Clean up standard lines
    clearLine(pocLineRef);
    clearLine(vahLineRef);
    clearLine(valLineRef);

    // Clean up IB & extensions
    clearLine(ibHighLineRef);
    clearLine(ibLowLineRef);
    clearLine(ext1618UpLineRef);
    clearLine(ext1618DownLineRef);
    clearLine(ext2618UpLineRef);
    clearLine(ext2618DownLineRef);
    clearLine(ext3618UpLineRef);
    clearLine(ext3618DownLineRef);

    // Clean up PDF lines
    clearLine(priorPocLineRef);
    clearLine(priorVahLineRef);
    clearLine(priorValLineRef);
    clearLine(poorHighLineRef);
    clearLine(poorLowLineRef);
    clearLine(ddGapTopLineRef);
    clearLine(ddGapBottomLineRef);
    clearLine(threeDayBalHighLineRef);
    clearLine(threeDayBalLowLineRef);
    clearLine(openPriceLineRef);

    // Clean up untested POCs list
    if (untestedPocLinesRef.current.length > 0) {
      untestedPocLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch (e) {}
      });
      untestedPocLinesRef.current = [];
    }

    // Clean up Failed Auctions list
    if (failedAuctionLinesRef.current.length > 0) {
      failedAuctionLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch (e) {}
      });
      failedAuctionLinesRef.current = [];
    }

    // Clean up active single prints list
    if (activeSinglePrintLinesRef.current.length > 0) {
      activeSinglePrintLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch (e) {}
      });
      activeSinglePrintLinesRef.current = [];
    }

    // Clean up legacy Sapnas list
    if (legacySapnaLinesRef.current.length > 0) {
      legacySapnaLinesRef.current.forEach(line => {
        try { series.removePriceLine(line); } catch (e) {}
      });
      legacySapnaLinesRef.current = [];
    }

    // Clean up GEX lines
    clearLine(gexCallWallLineRef);
    clearLine(gexPutWallLineRef);
    clearLine(gexFlipZoneLineRef);
    clearLine(gexMaxPainLineRef);

    // 1. Draw Active POC
    if (pocPrice) {
      pocLineRef.current = series.createPriceLine({
        price: pocPrice,
        color: '#00f0ff',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'POC'
      });
    }

    // 2. Draw Active VAH
    if (vahPrice) {
      vahLineRef.current = series.createPriceLine({
        price: vahPrice,
        color: '#ec4899',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'VAH'
      });
    }

    // 3. Draw Active VAL
    if (valPrice) {
      valLineRef.current = series.createPriceLine({
        price: valPrice,
        color: '#a855f7',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'VAL'
      });
    }

    // 4. Draw Initial Balance & Fibonacci Extensions
    if (ibHigh && ibLow && ibHigh > ibLow) {
      const ibRange = ibHigh - ibLow;

      ibHighLineRef.current = series.createPriceLine({
        price: ibHigh,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'IB High'
      });

      ibLowLineRef.current = series.createPriceLine({
        price: ibLow,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'IB Low'
      });

      // 1.618
      const up1618 = ibLow + (ibRange * 1.618);
      ext1618UpLineRef.current = series.createPriceLine({
        price: up1618,
        color: '#a855f7',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Fib 1.618 U'
      });

      const down1618 = ibHigh - (ibRange * 1.618);
      ext1618DownLineRef.current = series.createPriceLine({
        price: down1618,
        color: '#a855f7',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Fib 1.618 D'
      });

      // 2.618
      const up2618 = ibLow + (ibRange * 2.618);
      ext2618UpLineRef.current = series.createPriceLine({
        price: up2618,
        color: '#f97316',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Fib 2.618 U'
      });

      const down2618 = ibHigh - (ibRange * 2.618);
      ext2618DownLineRef.current = series.createPriceLine({
        price: down2618,
        color: '#f97316',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Fib 2.618 D'
      });

      // 3.618
      const up3618 = ibLow + (ibRange * 3.618);
      ext3618UpLineRef.current = series.createPriceLine({
        price: up3618,
        color: '#ffffff',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Fib 3.618 U'
      });

      const down3618 = ibHigh - (ibRange * 3.618);
      ext3618DownLineRef.current = series.createPriceLine({
        price: down3618,
        color: '#ffffff',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Fib 3.618 D'
      });
    }

    // 5. Draw Prior POC
    if (priorPocPrice) {
      priorPocLineRef.current = series.createPriceLine({
        price: priorPocPrice,
        color: '#06b6d4',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Prior POC'
      });
    }

    // 6. Draw Prior VAH
    if (priorVahPrice) {
      priorVahLineRef.current = series.createPriceLine({
        price: priorVahPrice,
        color: '#f43f5e',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Prior VAH'
      });
    }

    // 7. Draw Prior VAL
    if (priorValPrice) {
      priorValLineRef.current = series.createPriceLine({
        price: priorValPrice,
        color: '#a855f7',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Prior VAL'
      });
    }

    // 8. Draw Poor High
    if (poorHighPrice) {
      poorHighLineRef.current = series.createPriceLine({
        price: poorHighPrice,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'Poor High'
      });
    }

    // 9. Draw Poor Low
    if (poorLowPrice) {
      poorLowLineRef.current = series.createPriceLine({
        price: poorLowPrice,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'Poor Low'
      });
    }

    // 10. Draw Sapna boundary
    if (ddGapTop) {
      ddGapTopLineRef.current = series.createPriceLine({
        price: ddGapTop,
        color: '#ec4899',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Prior Sapna Top'
      });
    }
    if (ddGapBottom) {
      ddGapBottomLineRef.current = series.createPriceLine({
        price: ddGapBottom,
        color: '#ec4899',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Prior Sapna Btm'
      });
    }

    // 11. Draw 3-Day Balance boundaries
    if (threeDayBalanceHigh) {
      threeDayBalHighLineRef.current = series.createPriceLine({
        price: threeDayBalanceHigh,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: '3D Bal High'
      });
    }
    if (threeDayBalanceLow) {
      threeDayBalLowLineRef.current = series.createPriceLine({
        price: threeDayBalanceLow,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: '3D Bal Low'
      });
    }

    // 12. Draw Untested POCs
    if (untestedPocs && untestedPocs.length > 0) {
      untestedPocs.forEach((upoc) => {
        const line = series.createPriceLine({
          price: upoc.price,
          color: '#f43f5e',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `NPOC (${upoc.date})`
        });
        untestedPocLinesRef.current.push(line);
      });
    }

    // 12b. Draw Failed Auctions
    if (failedAuctions && failedAuctions.length > 0) {
      failedAuctions.forEach((fa) => {
        const titleLabel = fa.type === 'high' ? `FA High (${fa.date})` : `FA Low (${fa.date})`;
        const line = series.createPriceLine({
          price: fa.price,
          color: '#f97316',
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: titleLabel
        });
        failedAuctionLinesRef.current.push(line);
      });
    }

    // Draw Legacy Sapnas
    if (legacySapnas && legacySapnas.length > 0) {
      legacySapnas.forEach((sapna) => {
        const lineTop = series.createPriceLine({
          price: sapna.end,
          color: '#ec4899',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `Sapna Top (${sapna.date})`
        });
        legacySapnaLinesRef.current.push(lineTop);

        const lineBottom = series.createPriceLine({
          price: sapna.start,
          color: '#ec4899',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `Sapna Btm (${sapna.date})`
        });
        legacySapnaLinesRef.current.push(lineBottom);
      });
    }

    // 13. Draw Opening Price
    if (openPrice && openingType) {
      let lineColor = '#f59e0b';
      if (openingType.includes('Bullish')) {
        lineColor = '#10b981';
      } else if (openingType.includes('Bearish')) {
        lineColor = '#ef4444';
      } else if (openingType.includes('ORR') || openingType.includes('Rejection')) {
        lineColor = '#c084fc';
      }
      
      openPriceLineRef.current = series.createPriceLine({
        price: openPrice,
        color: lineColor,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `Open: ${openingType}`
      });
    }

    // 14. Draw Active Single Prints
    if (activeSinglePrints && activeSinglePrints.length > 0) {
      activeSinglePrints.forEach((range, idx) => {
        const lineStart = series.createPriceLine({
          price: range.start,
          color: '#f43f5e',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: `Sapna Btm ${idx + 1}`
        });
        activeSinglePrintLinesRef.current.push(lineStart);

        const lineEnd = series.createPriceLine({
          price: range.end,
          color: '#f43f5e',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: `Sapna Top ${idx + 1}`
        });
        activeSinglePrintLinesRef.current.push(lineEnd);
      });
    }

    // GEX levels (if provided)
    if (gexCallWall) {
      gexCallWallLineRef.current = series.createPriceLine({
        price: gexCallWall,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'CW'
      });
    }
    if (gexPutWall) {
      gexPutWallLineRef.current = series.createPriceLine({
        price: gexPutWall,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'PW'
      });
    }
    if (gexFlipZone) {
      gexFlipZoneLineRef.current = series.createPriceLine({
        price: gexFlipZone,
        color: '#a78bfa',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'FZ'
      });
    }
    if (gexMaxPain) {
      gexMaxPainLineRef.current = series.createPriceLine({
        price: gexMaxPain,
        color: '#e879f9',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'MP'
      });
    }

  }, [
    pocPrice, vahPrice, valPrice, ibHigh, ibLow, candles,
    priorPocPrice, priorVahPrice, priorValPrice,
    poorHighPrice, poorLowPrice, untestedPocs, failedAuctions,
    ddGapTop, ddGapBottom,
    threeDayBalanceHigh, threeDayBalanceLow,
    openPrice, openingType, activeSinglePrints, legacySapnas,
    gexCallWall, gexPutWall, gexFlipZone, gexMaxPain
  ]);

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: '1', height: '100%', overflow: 'hidden' }}>
      
      {/* Chart Title Overlay */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(13, 16, 23, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{symbol}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
              {timeframe === 'D' ? 'Daily' : timeframe === 'W' ? 'Weekly' : timeframe === 'M' ? 'Monthly' : `${timeframe}m`} Chart
            </span>
          </div>

          {/* Candlestick Style Toggle */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button 
              onClick={() => setCandleStyle('japanese')}
              style={{
                fontSize: '10px',
                fontWeight: '600',
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: candleStyle === 'japanese' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: candleStyle === 'japanese' ? '#60a5fa' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              Candles
            </button>
            <button 
              onClick={() => setCandleStyle('heikin-ashi')}
              style={{
                fontSize: '10px',
                fontWeight: '600',
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: candleStyle === 'heikin-ashi' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: candleStyle === 'heikin-ashi' ? '#60a5fa' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              Heikin Ashi
            </button>
          </div>
        </div>
        {candles.length > 0 && (
          <div style={{ display: 'flex', gap: '14px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <span>O: <strong style={{ color: 'white' }}>{candles[candles.length - 1].open.toFixed(2)}</strong></span>
            <span>H: <strong style={{ color: '#10b981' }}>{candles[candles.length - 1].high.toFixed(2)}</strong></span>
            <span>L: <strong style={{ color: '#ef4444' }}>{candles[candles.length - 1].low.toFixed(2)}</strong></span>
            <span>C: <strong style={{ color: 'white' }}>{candles[candles.length - 1].close.toFixed(2)}</strong></span>
          </div>
        )}
      </div>

      <div 
        ref={chartContainerRef} 
        style={{ flex: '1', minHeight: '380px', width: '100%', position: 'relative' }} 
      />

    </div>
  );
};
