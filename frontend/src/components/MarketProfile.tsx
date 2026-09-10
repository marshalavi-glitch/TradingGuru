import React, { useRef, useEffect, useState } from 'react';
import type { DayProfile, TPOBin } from '../utils/profileCalculator';

interface MarketProfileProps {
  activeProfile: DayProfile | null;
  priorProfile?: DayProfile | null;
  profileType: 'tpo-collapsed' | 'tpo-split' | 'volume';
  visiblePriceRange?: { min: number; max: number; paneHeight: number } | null;
  sessionPeriod: 'daily' | 'weekly' | 'monthly';
  livePrice?: number;
}

// Letter color mapping showing chronological flow of the session
function getLetterColor(letter: string): string {
  const code = letter.toUpperCase().charCodeAt(0);
  if (code >= 65 && code <= 66) return '#10b981'; // A-B: Emerald Green (First hour / Initial Balance)
  if (code >= 67 && code <= 70) return '#3b82f6'; // C-F: Blue (Morning session)
  if (code >= 71 && code <= 74) return '#00f0ff'; // G-J: Cyan (Midday)
  if (code >= 75 && code <= 78) return '#8b5cf6'; // K-N: Purple (Afternoon)
  if (code >= 79 && code <= 82) return '#ec4899'; // O-R: Pink (Late afternoon)
  if (code >= 83 && code <= 86) return '#f59e0b'; // S-V: Amber/Orange (Pre-close)
  return '#ef4444'; // W-Z and lowercase: Red (Market close/extended)
}

function formatDateLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mIdx = parseInt(parts[1], 10) - 1;
  const dStr = parseInt(parts[2], 10).toString();
  if (mIdx >= 0 && mIdx < 12) {
    return `${monthNames[mIdx]} ${dStr}`;
  }
  return dateStr;
}

export const MarketProfile: React.FC<MarketProfileProps> = ({
  activeProfile,
  priorProfile,
  profileType,
  visiblePriceRange,
  sessionPeriod,
  livePrice
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredBin, setHoveredBin] = useState<{ bin: TPOBin; y: number; x: number; date?: string } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [compareMode, setCompareMode] = useState<'single' | 'compare'>('compare');

  // Monitor resize of the canvas container to match candlestick chart canvas height
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        setDimensions({
          width: canvasContainerRef.current.clientWidth,
          height: canvasContainerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Trigger a delayed resize to capture container size after full render
    const timer = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container || !activeProfile || activeProfile.bins.length === 0 || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI screens (retina display support)
    const dpr = window.devicePixelRatio || 1;
    const width = dimensions.width;
    const height = dimensions.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const padding = { top: 32, bottom: 10, left: 55, right: 15 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const showCompare = compareMode === 'compare' && priorProfile && priorProfile.bins && priorProfile.bins.length > 0;
    const isAligned = visiblePriceRange && visiblePriceRange.min && visiblePriceRange.max;

    const activeMin = activeProfile.dayLow;
    const activeMax = activeProfile.dayHigh;
    const combinedMin = showCompare ? Math.min(activeMin, priorProfile!.dayLow) : activeMin;
    const combinedMax = showCompare ? Math.max(activeMax, priorProfile!.dayHigh) : activeMax;

    const minPrice = isAligned ? visiblePriceRange.min : combinedMin;
    const maxPrice = isAligned ? visiblePriceRange.max : combinedMax;
    const priceRange = maxPrice - minPrice;

    // Clear Canvas
    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, 0, width, height);

    const bins = activeProfile.bins;

    // Draw Y-Axis (Prices) on the left
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    
    const visibleBins = isAligned 
      ? bins.filter(b => b.price >= minPrice && b.price <= maxPrice)
      : bins;
    const labelStep = Math.max(1, Math.floor(visibleBins.length / 12));
    
    bins.forEach((bin, idx) => {
      const y = padding.top + ((maxPrice - bin.price) / priceRange) * chartHeight;
      if (y < padding.top || y > padding.top + chartHeight) return;

      const isPoc = bin.price === activeProfile.pocPrice;
      const isVah = bin.price === activeProfile.vahPrice;
      const isVal = bin.price === activeProfile.valPrice;
      const isPriorPoc = showCompare && bin.price === priorProfile!.pocPrice;

      const isStep = idx % labelStep === 0;

      if (isPoc || isVah || isVal || isPriorPoc || isStep) {
        const textY = y + 4;
        
        if (isPoc) {
          ctx.fillStyle = '#00f0ff';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
        } else if (isVah) {
          ctx.fillStyle = '#ec4899';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
        } else if (isVal) {
          ctx.fillStyle = '#a855f7';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
        } else if (isPriorPoc) {
          ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
        } else {
          ctx.fillStyle = '#6b7280';
          ctx.font = '10px "JetBrains Mono", monospace';
        }
        
        ctx.fillText(bin.price.toFixed(2), padding.left - 8, textY);
      }
    });

    const drawPanel = (profile: DayProfile, startX: number, panelWidth: number, title: string, isPrior: boolean) => {
      const pBins = profile.bins;
      const binStep = pBins.length > 1 ? Math.abs(pBins[0].price - pBins[1].price) : profile.tickSize;
      const rowHeight = (binStep / priceRange) * chartHeight;

      const getRowY = (binPrice: number) => {
        return padding.top + ((maxPrice - binPrice) / priceRange) * chartHeight - rowHeight / 2;
      };

      // Draw Panel Header Card Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.fillRect(startX, padding.top - 24, panelWidth, 20);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, padding.top - 24, panelWidth, 20);

      // Title Text
      ctx.fillStyle = isPrior ? 'var(--text-secondary)' : '#ffffff';
      ctx.font = 'bold 9px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, startX + panelWidth / 2, padding.top - 10);

      let maxVolumeValue = 0;
      for (const b of pBins) {
        if (b.volume > maxVolumeValue) maxVolumeValue = b.volume;
      }

      // Draw Row Backgrounds & Shading
      pBins.forEach((bin) => {
        const y = getRowY(bin.price);
        if (y < padding.top - rowHeight || y > padding.top + chartHeight) return;

        const isInsideValueArea = bin.price <= profile.vahPrice && bin.price >= profile.valPrice;

        if (isInsideValueArea) {
          ctx.fillStyle = isPrior ? 'rgba(139, 92, 246, 0.015)' : 'rgba(139, 92, 246, 0.04)';
          ctx.fillRect(startX, y, panelWidth, rowHeight);
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + panelWidth, y);
        ctx.stroke();
      });

      const tpoWidthRatio = profileType === 'volume' ? 0 : 0.65;
      const volumeWidthRatio = profileType === 'volume' ? 0.9 : 0.3;

      // Render TPOs
      if (profileType === 'tpo-collapsed' || profileType === 'tpo-split') {
        const tpoAreaWidth = panelWidth * tpoWidthRatio;
        
        pBins.forEach((bin) => {
          const y = getRowY(bin.price);
          if (y < padding.top - rowHeight || y > padding.top + chartHeight) return;
          
          ctx.textAlign = 'left';
          const isBlockView = rowHeight < 9;
          const fontHeight = Math.max(6, Math.min(18, rowHeight - 2));
          ctx.font = `${fontHeight}px "JetBrains Mono", monospace`;
          
          const charWidth = ctx.measureText('M').width;
          const blockHeight = Math.max(1, rowHeight - 1);
          const blockWidth = isBlockView ? Math.max(3, Math.min(8, rowHeight * 1.2)) : charWidth;

          if (profileType === 'tpo-collapsed') {
            bin.tpos.forEach((letter, colIdx) => {
              const spacing = isBlockView ? blockWidth + 0.5 : charWidth + 1;
              const x = startX + colIdx * spacing;
              
              if (x < startX + tpoAreaWidth) {
                ctx.fillStyle = getLetterColor(letter);
                if (isBlockView) {
                  ctx.fillRect(x, y + (rowHeight - blockHeight)/2, blockWidth, blockHeight);
                } else {
                  ctx.fillText(letter, x, y + rowHeight / 2 + fontHeight / 3);
                }
              }
            });
          } else {
            // Split View
            bin.tpos.forEach((letter) => {
              const periodIndex = letter.charCodeAt(0) - (letter.charCodeAt(0) >= 97 ? 97 - 26 : 65);
              const spacing = charWidth + 2;
              const x = startX + periodIndex * spacing;
              
              if (x < startX + tpoAreaWidth) {
                ctx.fillStyle = getLetterColor(letter);
                ctx.fillText(letter, x, y + rowHeight / 2 + fontHeight / 3);
              }
            });
          }
        });
      }

      // Render Volume Bars
      if (profileType === 'volume' || profileType === 'tpo-collapsed' || profileType === 'tpo-split') {
        const volAreaWidth = panelWidth * volumeWidthRatio;
        const volStartOffset = profileType === 'volume' ? startX : startX + panelWidth * 0.7;

        pBins.forEach((bin) => {
          const y = getRowY(bin.price);
          if (y < padding.top - rowHeight || y > padding.top + chartHeight) return;
          
          const h = Math.max(1, rowHeight - 2);
          const w = (bin.volume / maxVolumeValue) * volAreaWidth;
          const isInsideValueArea = bin.price <= profile.vahPrice && bin.price >= profile.valPrice;
          
          if (bin.price === profile.pocPrice) {
            ctx.fillStyle = isPrior ? 'rgba(0, 240, 255, 0.25)' : 'rgba(0, 240, 255, 0.45)';
          } else if (isInsideValueArea) {
            ctx.fillStyle = isPrior ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.25)';
          } else {
            ctx.fillStyle = isPrior ? 'rgba(59, 130, 246, 0.06)' : 'rgba(59, 130, 246, 0.12)';
          }

          ctx.fillRect(volStartOffset, y + 1, w, h);
          
          ctx.strokeStyle = bin.price === profile.pocPrice 
            ? (isPrior ? 'rgba(0, 240, 255, 0.4)' : 'rgba(0, 240, 255, 0.8)')
            : isInsideValueArea 
              ? (isPrior ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.5)') 
              : (isPrior ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.2)');
          ctx.lineWidth = 1;
          ctx.strokeRect(volStartOffset, y + 1, w, h);
        });
      }

      // Draw horizontal reference lines inside the panel
      const drawPriceLine = (price: number, color: string, isSolid = false, width = 1.5) => {
        const y = getRowY(price) + rowHeight / 2;
        if (y < padding.top || y > padding.top + chartHeight) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (!isSolid) {
          ctx.setLineDash([4, 4]);
        }
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + panelWidth, y);
        ctx.stroke();
        if (!isSolid) {
          ctx.setLineDash([]);
        }
      };

      if (profile.vahPrice) drawPriceLine(profile.vahPrice, isPrior ? 'rgba(236, 72, 153, 0.3)' : 'rgba(236, 72, 153, 0.5)', false, 1.2);
      if (profile.valPrice) drawPriceLine(profile.valPrice, isPrior ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.5)', false, 1.2);
      if (profile.pocPrice) drawPriceLine(profile.pocPrice, isPrior ? 'rgba(0, 240, 255, 0.45)' : '#00f0ff', true, isPrior ? 1.5 : 2.5);

      // Draw Initial Balance (IB) Indicator
      if (profile.ibHigh && profile.ibLow) {
        const ibYTop = getRowY(profile.ibHigh) + rowHeight / 2;
        const ibYBottom = getRowY(profile.ibLow) + rowHeight / 2;

        const drawTop = Math.max(padding.top, ibYTop);
        const drawBottom = Math.min(padding.top + chartHeight, ibYBottom);
        
        if (drawTop < drawBottom) {
          ctx.strokeStyle = isPrior ? 'rgba(245, 158, 11, 0.35)' : '#f59e0b';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(startX + 4, drawTop);
          ctx.lineTo(startX + 4, drawBottom);
          ctx.stroke();
        }
      }
    };

    if (showCompare) {
      const panelWidth = chartWidth / 2 - 10;
      drawPanel(priorProfile!, padding.left, panelWidth, `Prior Profile (${formatDateLabel(priorProfile!.dateStr)})`, true);
      drawPanel(activeProfile, padding.left + panelWidth + 20, panelWidth, `Active Profile (${formatDateLabel(activeProfile.dateStr)})`, false);
    } else {
      drawPanel(activeProfile, padding.left, chartWidth, `Profile (${formatDateLabel(activeProfile.dateStr)})`, false);
    }

    // Draw Live Price Line and Label Box
    if (livePrice) {
      const activeStartX = showCompare ? padding.left + (chartWidth / 2 - 10) + 20 : padding.left;
      const activeWidth = showCompare ? chartWidth / 2 - 10 : chartWidth;
      const y = padding.top + ((maxPrice - livePrice) / priceRange) * chartHeight;
      
      if (y >= padding.top && y <= padding.top + chartHeight) {
        const isUp = livePrice >= activeProfile.openPrice;
        const liveColor = isUp ? '#10b981' : '#ef4444';

        ctx.strokeStyle = liveColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(activeStartX, y);
        ctx.lineTo(activeStartX + activeWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label box on the left scale
        const labelText = livePrice.toFixed(2);
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(labelText).width;
        const boxWidth = textWidth + 8;
        const boxHeight = 14;
        const boxX = padding.left - boxWidth - 4;
        const boxY = y - boxHeight / 2;

        ctx.fillStyle = liveColor;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 3);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, boxX + boxWidth / 2, boxY + boxHeight - 3.5);
      }
    }

  }, [activeProfile, priorProfile, profileType, visiblePriceRange, dimensions, sessionPeriod, livePrice, compareMode]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeProfile) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 32, bottom: 10, left: 55, right: 15 };
    const chartWidth = rect.width - padding.left - padding.right;
    const showCompare = compareMode === 'compare' && priorProfile && priorProfile.bins && priorProfile.bins.length > 0;
    
    const isAligned = visiblePriceRange && visiblePriceRange.min && visiblePriceRange.max;
    const activeMin = activeProfile.dayLow;
    const activeMax = activeProfile.dayHigh;
    const combinedMin = showCompare ? Math.min(activeMin, priorProfile!.dayLow) : activeMin;
    const combinedMax = showCompare ? Math.max(activeMax, priorProfile!.dayHigh) : activeMax;
    
    const minPrice = isAligned ? visiblePriceRange.min : combinedMin;
    const maxPrice = isAligned ? visiblePriceRange.max : combinedMax;
    const priceRange = maxPrice - minPrice;

    const chartHeight = rect.height - padding.top - padding.bottom;

    if (y < padding.top || y > padding.top + chartHeight) {
      setHoveredBin(null);
      return;
    }

    let targetProfile = activeProfile;
    let titleStr = 'Active';

    if (showCompare) {
      const halfWidth = chartWidth / 2 - 10;
      if (x >= padding.left && x < padding.left + halfWidth) {
        targetProfile = priorProfile!;
        titleStr = 'Prior';
      } else if (x >= padding.left + halfWidth + 20 && x <= padding.left + chartWidth) {
        targetProfile = activeProfile;
        titleStr = 'Active';
      } else {
        setHoveredBin(null);
        return;
      }
    }

    const bins = targetProfile.bins;
    let closestBin: TPOBin | null = null;
    let binY = 0;
    let hoveredDate = formatDateLabel(targetProfile.dateStr);

    const clickPct = (y - padding.top) / chartHeight;
    const hoveredPrice = maxPrice - clickPct * priceRange;

    let minDiff = Infinity;
    for (let i = 0; i < bins.length; i++) {
      const diff = Math.abs(bins[i].price - hoveredPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestBin = bins[i];
      }
    }

    if (closestBin) {
      binY = padding.top + ((maxPrice - closestBin.price) / priceRange) * chartHeight;
    }

    if (closestBin && binY >= padding.top && binY <= padding.top + chartHeight) {
      setHoveredBin({
        bin: closestBin,
        y: binY,
        x: x + 15,
        date: `${titleStr}: ${hoveredDate}`
      });
    } else {
      setHoveredBin(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredBin(null);
  };

  return (
    <div 
      className="glass-panel animate-fade-in" 
      style={{ display: 'flex', flexDirection: 'column', flex: '1', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(13, 16, 23, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>Profile Analysis</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
              TPO & Volume
            </span>
          </div>

          {/* Toggle buttons */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setCompareMode('single')}
              style={{
                background: compareMode === 'single' ? 'var(--accent-blue)' : 'transparent',
                color: compareMode === 'single' ? 'white' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Single Day
            </button>
            <button
              onClick={() => setCompareMode('compare')}
              style={{
                background: compareMode === 'compare' ? 'var(--accent-blue)' : 'transparent',
                color: compareMode === 'compare' ? 'white' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '600',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              2-Day Compare
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', fontSize: '10px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', backgroundColor: '#00f0ff', borderRadius: '2px' }}></span> POC
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', backgroundColor: '#ec4899', borderRadius: '2px' }}></span> VAH
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', backgroundColor: '#a855f7', borderRadius: '2px' }}></span> VAL
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '2px' }}></span> IB
          </span>
        </div>
      </div>

      {/* Canvas container */}
      <div ref={canvasContainerRef} style={{ flex: '1', position: 'relative', width: '100%', minHeight: '380px' }}>
        <canvas 
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'crosshair', display: 'block' }}
        />

        {/* Custom Tooltip */}
        {hoveredBin && (
          <div 
            className="tooltip-custom"
            style={{ 
              position: 'absolute', 
              top: `${hoveredBin.y}px`, 
              left: `${hoveredBin.x}px`,
              pointerEvents: 'none',
              transform: 'translateY(-50%)',
              zIndex: 1000
            }}
          >
            <div style={{ fontWeight: 'bold', color: hoveredBin.bin.price === activeProfile?.pocPrice ? '#00f0ff' : 'white', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
              Price: {hoveredBin.bin.price.toFixed(2)}
            </div>
            {hoveredBin.date && (
              <div style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>
                📅 Date: {hoveredBin.date}
              </div>
            )}
            <div>TPOs: <span style={{ color: 'var(--color-poc)' }}>{hoveredBin.bin.tpos.length}</span> ({hoveredBin.bin.tpos.join(', ') || 'None'})</div>
            <div>Volume: <span style={{ color: '#3b82f6' }}>{Math.round(hoveredBin.bin.volume).toLocaleString()}</span></div>
            {hoveredBin.bin.price === activeProfile?.pocPrice && (
              <div style={{ color: '#00f0ff', fontSize: '9px', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase' }}>
                ⭐ Point of Control (POC)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
