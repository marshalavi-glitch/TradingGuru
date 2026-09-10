import React from 'react';
import { analyzeProfileNuances } from '../utils/profileCalculator';
import type { DayProfile } from '../utils/profileCalculator';
import { Calendar, Compass, AlertTriangle, Zap, Activity } from 'lucide-react';

interface StatsPanelProps {
  dayProfiles: DayProfile[];
  activeDateStr: string | null;
  onSelectDate: (dateStr: string) => void;
  untestedPocs?: { price: number; date: string }[];
  symbol?: string;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  dayProfiles,
  activeDateStr,
  onSelectDate,
  untestedPocs = []
}) => {
  const activeProfile = dayProfiles.find(p => p.dateStr === activeDateStr) || dayProfiles[0];

  const activeIdx = activeProfile ? dayProfiles.findIndex(p => p.dateStr === activeProfile.dateStr) : -1;
  const priorProfile = activeIdx !== -1 && activeIdx < dayProfiles.length - 1 ? dayProfiles[activeIdx + 1] : null;
  const nuances = activeProfile ? analyzeProfileNuances(activeProfile, priorProfile, dayProfiles) : null;

  if (!activeProfile) {
    return (
      <div className="glass-panel animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', minHeight: '300px', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Waiting for chart data...</p>
      </div>
    );
  }

  const formatNum = (num: number) => {
    if (!num) return '0.00';
    return num.toFixed(2);
  };

  const getOpeningPlaybook = () => {
    if (!nuances) {
      return {
        conviction: 'N/A',
        convictionColor: 'var(--text-muted)',
        dayTypeExpectation: 'No session active',
        rules: ['Awaiting market open and candles data...']
      };
    }

    const oRel = nuances.openRelationship || '';
    const oType = nuances.openingType || '';
    
    let conviction = 'LOW';
    let convictionColor = '#ef4444'; // Red
    let dayTypeExpectation = 'Normal / Nontrend Day';
    let rules = [
      'Expect range-bound auctions. Play mean reversion.',
      'Fade the extremes: Buy VAL support, Sell VAH resistance.',
      'Do not chase breakouts unless Initial Balance (IB) range is extremely narrow.'
    ];

    if (oType.includes('Drive (OD)')) {
      conviction = 'EXTREME';
      convictionColor = '#10b981'; // Green
      dayTypeExpectation = 'Trend Day';
      rules = [
        'Aggressive OTF Drive is active. Open price is the key daily boundary.',
        'Do not trade against the drive direction (no fading).',
        'Buy/Sell first minor pullback or Period B range extension.'
      ];
    } else if (oType.includes('Test Drive (OTD)')) {
      conviction = 'HIGH';
      convictionColor = '#34d399'; // Light Green
      dayTypeExpectation = 'Normal Variation Day';
      rules = [
        'A key support/resistance level was tested and rejected in Period A.',
        'Establish trades in the direction of the drive once Period B extends.',
        'Keep stop loss just beyond the rejected Period A extreme.'
      ];
    } else if (oType.includes('Rejection Reverse')) {
      conviction = 'MODERATE';
      convictionColor = '#fbbf24'; // Orange
      dayTypeExpectation = 'Neutral Day';
      rules = [
        'Aggressive responsive OTF rejected early direction and reversed.',
        'Wait for price to pull back to the middle of the range before entering.',
        'Target the opposite extreme of the opening range.'
      ];
    } else if (oRel.includes('Above Range') || oRel.includes('Below Range')) {
      conviction = 'HIGH IMBALANCE';
      convictionColor = '#a78bfa'; // Purple
      dayTypeExpectation = 'Double-Distribution Trend Day';
      rules = [
        'Market opened out of balance. High potential for a large trend day.',
        'Wait for Period B range breakout for confirmation of gap acceptance.',
        'If price returns inside yesterday\'s range, play the 80% rule targeting Prior POC.'
      ];
    } else if (oRel.includes('Above Value') || oRel.includes('Below Value')) {
      conviction = 'MODERATE';
      convictionColor = '#fbbf24'; // Orange
      dayTypeExpectation = 'Normal Variation Day';
      rules = [
        'Opened outside value but within range. Look for support/resistance at VAH/VAL.',
        'If price enters yesterday\'s Value Area, 80% Rule is active targeting Prior POC.'
      ];
    }

    return { conviction, convictionColor, dayTypeExpectation, rules };
  };

  const playbook = getOpeningPlaybook();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Date Select List */}
      <div className="glass-panel animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} />
          Trading Sessions
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
          {dayProfiles.map((profile) => {
            const isActive = profile.dateStr === activeDateStr;
            
            return (
              <button
                key={profile.dateStr}
                onClick={() => onSelectDate(profile.dateStr)}
                style={{
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))' 
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isActive ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  color: 'white',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>{profile.dateStr}</span>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Range: {formatNum(profile.dayLow)} - {formatNum(profile.dayHigh)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 'bold', 
                    color: profile.closePrice >= profile.openPrice ? '#10b981' : '#ef4444',
                    backgroundColor: profile.closePrice >= profile.openPrice ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {profile.closePrice >= profile.openPrice ? 'Bull' : 'Bear'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Key Reference Levels */}
      <div className="glass-panel animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: '0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={14} />
          Key Levels ({activeProfile.dateStr})
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>POC</span>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#00f0ff', marginTop: '2px' }}>{formatNum(activeProfile.pocPrice)}</div>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>IB Range</span>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b', marginTop: '2px' }}>{formatNum(activeProfile.ibLow)} - {formatNum(activeProfile.ibHigh)}</div>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>VAH</span>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#ec4899', marginTop: '2px' }}>{formatNum(activeProfile.vahPrice)}</div>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>VAL</span>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#a855f7', marginTop: '2px' }}>{formatNum(activeProfile.valPrice)}</div>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Open</span>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'white', marginTop: '2px' }}>{formatNum(activeProfile.openPrice)}</div>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Close</span>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'white', marginTop: '2px' }}>{formatNum(activeProfile.closePrice)}</div>
          </div>
        </div>
      </div>

      {/* Opening Drive Playbook */}
      <div className="glass-panel animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: '0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Compass size={14} />
          Session Opening Playbook
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>
            {nuances?.openingType || 'Open Auction'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {nuances?.openingTypeDesc}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginTop: '4px' }}>
            <span>Conviction:</span>
            <strong style={{ color: playbook.convictionColor }}>{playbook.conviction}</strong>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Trading Rules:</span>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: '1.4' }}>
              {playbook.rules.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Structural Alerts & Nuances */}
      {nuances && (
        <div className="glass-panel animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: '0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} />
            Market Structure Alerts
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {nuances.poorHigh && (
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 10px', borderRadius: '8px', fontSize: '11px' }}>
                <Zap size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#ef4444' }}>Poor High Magnet</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>The session high lacks responsive selling rejection. Highly likely to be swept.</div>
                </div>
              </div>
            )}
            
            {nuances.poorLow && (
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 10px', borderRadius: '8px', fontSize: '11px' }}>
                <Zap size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#ef4444' }}>Poor Low Magnet</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>The session low lacks responsive buying rejection. Highly likely to be swept.</div>
                </div>
              </div>
            )}

            {nuances.singlePrintAlert && (
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '8px 10px', borderRadius: '8px', fontSize: '11px' }}>
                <Zap size={14} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#3b82f6' }}>Single Prints Active</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>Conviction gaps left in TPOs. Acts as strong support/resistance zones.</div>
                </div>
              </div>
            )}

            {nuances.threeDayBalanceAlert && (
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '8px 10px', borderRadius: '8px', fontSize: '11px' }}>
                <Zap size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#f59e0b' }}>3-Day Balance Squeeze</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>Tight multi-day range contraction. Major breakout expansion imminent.</div>
                </div>
              </div>
            )}

            {untestedPocs.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(236, 72, 153, 0.05)', border: '1px solid rgba(236, 72, 153, 0.2)', padding: '8px 10px', borderRadius: '8px', fontSize: '11px' }}>
                <Zap size={14} color="#ec4899" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#ec4899' }}>Naked POCs ({untestedPocs.length})</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>Unvisited point-of-controls from previous sessions acting as structural magnets.</div>
                </div>
              </div>
            )}

            {nuances.rotationFactor !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '8px 10px', borderRadius: '8px', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Rotation Factor:</span>
                <strong style={{ color: nuances.rotationFactor > 0 ? '#10b981' : '#ef4444' }}>
                  {nuances.rotationFactor > 0 ? `+${nuances.rotationFactor}` : nuances.rotationFactor}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
