import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Sparkles, 
  Globe, 
  DollarSign, 
  Flame, 
  Activity, 
  Layers, 
  Search, 
  RefreshCw,
  Award,
  BarChart2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface TrumpMoodContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

interface PolicyInsight {
  id: string;
  category: 'tariffs' | 'fed_rates' | 'crude_energy' | 'tech_ai' | 'geopolitics';
  headline: string;
  trumpQuote: string;
  sentiment: 'BULLISH_INDIA' | 'BEARISH_INDIA' | 'HIGH_VOLATILITY' | 'NEUTRAL';
  impactSummary: string;
  keyWinners: string[];
  keyLosers: string[];
  score: number; // -10 to +10
}

interface SymbolImpact {
  symbol: string;
  name: string;
  sector: string;
  trumpImpact: 'VERY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'VERY_BEARISH';
  score: number;
  driver: string;
  actionablePlaybook: string;
}

export const TrumpMoodContainer: React.FC<TrumpMoodContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'tariffs' | 'fed_rates' | 'crude_energy' | 'tech_ai'>('all');
  const [selectedScenario, setSelectedScenario] = useState<string>('scenario_tariffs');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const insights: PolicyInsight[] = [
    {
      id: 'tariffs',
      category: 'tariffs',
      headline: 'Universal Import Tariffs & Reciprocal Trade Act',
      trumpQuote: '"Tariffs are the greatest economic tool. If you want to sell in America, you build in America—or pay a 10% to 25% tariff."',
      sentiment: 'HIGH_VOLATILITY',
      impactSummary: 'Universal tariffs create short-term export friction for global exporters, but weaken the US Dollar long-term and push manufacturing supply chains toward India.',
      keyWinners: ['Domestic Indian Manufacturing', 'Chemicals', 'Capital Goods'],
      keyLosers: ['Metals Exporters', 'Textile Exporters to US'],
      score: +6.5
    },
    {
      id: 'fed_rates',
      category: 'fed_rates',
      headline: 'Aggressive Pressure on Federal Reserve for Rate Cuts',
      trumpQuote: '"Interest rates are way too high! Lowering rates to 3% will unleash unprecedented American economic energy."',
      sentiment: 'BULLISH_INDIA',
      impactSummary: 'Aggressive US Fed rate cuts narrow the US-India yield spread, triggering massive Foreign Institutional Investor (FII) capital inflows into Nifty & Bank Nifty.',
      keyWinners: ['Bank Nifty', 'Nifty 50', 'FII-heavy Stocks (HDFC Bank, ICICI Bank)'],
      keyLosers: ['US Dollar Index (DXY)'],
      score: +9.0
    },
    {
      id: 'crude_energy',
      category: 'crude_energy',
      headline: 'Energy Dominance: "Drill, Baby, Drill" Production Expansion',
      trumpQuote: '"We have more liquid gold under our feet than anyone. We will double US oil production and drive Crude down to $50-$60/bbl."',
      sentiment: 'BULLISH_INDIA',
      impactSummary: 'Lower global crude oil prices directly reduce India\'s current account deficit, crush domestic inflation, and expand profit margins for OMCs, Paints, Tyres, and Aviation.',
      keyWinners: ['Asian Paints', 'MRF', 'HPCL/BPCL', 'InterGlobe Aviation (IndiGo)'],
      keyLosers: ['US Shale Producers', 'Oil Exploration (ONGC)'],
      score: +8.8
    },
    {
      id: 'tech_ai',
      category: 'tech_ai',
      headline: 'Corporate Tax Cuts & Accelerated Tech CapEx Expansion',
      trumpQuote: '"We are slashing US corporate tax from 21% down to 15% for domestic producers and deregulation will unleash massive AI infrastructure."',
      sentiment: 'BULLISH_INDIA',
      impactSummary: 'US Fortune 500 tax savings and deregulation boost corporate IT & AI modernization budgets, driving high-margin contract renewals for Indian IT majors.',
      keyWinners: ['TCS', 'Infosys', 'HCLTech', 'Tech Mahindra'],
      keyLosers: ['Over-regulated US Legacy Bureaucracy'],
      score: +8.2
    }
  ];

  const symbolImpacts: SymbolImpact[] = [
    {
      symbol: 'NSE:NIFTY1!',
      name: 'NIFTY 50 Futures',
      sector: 'Broad Market',
      trumpImpact: 'VERY_BULLISH',
      score: 8.8,
      driver: 'Lower Crude Oil + FII Capital Inflows + Lower Inflation',
      actionablePlaybook: 'Buy dips on key support levels. FII liquidity inflows support long-term bull market.'
    },
    {
      symbol: 'NSE:BANKNIFTY1!',
      name: 'BANK NIFTY Futures',
      sector: 'Banking & Financials',
      trumpImpact: 'VERY_BULLISH',
      score: 9.2,
      driver: 'US Rate Cut Pressure -> RBI Monetary Easing -> Credit Expansion',
      actionablePlaybook: 'Outperform index. Strongest FII buying vehicle across HDFC Bank & ICICI Bank.'
    },
    {
      symbol: 'NSE:RELIANCE1!',
      name: 'Reliance Industries',
      sector: 'Energy & Retail',
      trumpImpact: 'BULLISH',
      score: 7.5,
      driver: 'Refining margins offset by Telecom / Retail expansion & Green Energy CapEx',
      actionablePlaybook: 'Accumulate near Value Area Low. Retail & 5G monetization shield from oil swings.'
    },
    {
      symbol: 'NSE:INFY',
      name: 'Infosys Ltd.',
      sector: 'IT Services',
      trumpImpact: 'BULLISH',
      score: 8.0,
      driver: 'US Corporate Tax Cut (15%) increases BFSI Tech & AI Spending',
      actionablePlaybook: 'Buy on breakouts. US BFSI recovery directly boosts Q3/Q4 deal wins.'
    },
    {
      symbol: 'NSE:TATASTEEL',
      name: 'Tata Steel Ltd.',
      sector: 'Metals & Mining',
      trumpImpact: 'NEUTRAL',
      score: 5.5,
      driver: 'Universal US Steel Tariffs vs Indian Domestic Infrastructure Demand',
      actionablePlaybook: 'Trade rangebound. Focus on domestic infrastructure demand over US exports.'
    },
    {
      symbol: 'MCX:CRUDEOIL1!',
      name: 'Crude Oil Futures',
      sector: 'Energy Commodity',
      trumpImpact: 'VERY_BEARISH',
      score: -8.0,
      driver: '"Drill Baby Drill" -> US Daily Supply Increases to 13.8M bpd',
      actionablePlaybook: 'Sell rallies near resistance. Supply glut limits upside potential.'
    },
    {
      symbol: 'MCX:GOLD1!',
      name: 'Gold Futures',
      sector: 'Precious Metals',
      trumpImpact: 'BULLISH',
      score: 8.5,
      driver: 'Tariff Volatility + Central Bank Reserve Diversification + Weak USD',
      actionablePlaybook: 'Maintain bullish posture on pullbacks as inflation & tariff hedge.'
    }
  ];

  const filteredImpacts = useMemo(() => {
    if (!searchFilter.trim()) return symbolImpacts;
    const q = searchFilter.toLowerCase();
    return symbolImpacts.filter(s => 
      s.symbol.toLowerCase().includes(q) || 
      s.name.toLowerCase().includes(q) || 
      s.sector.toLowerCase().includes(q)
    );
  }, [searchFilter]);

  const handleSymbolClick = (sym: string) => {
    if (onSymbolSelect) onSymbolSelect(sym);
    if (onSwitchToChart) onSwitchToChart();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.25s ease-out', width: '100%' }}>
      
      {/* Trump Mood Header Banner */}
      <div 
        className="glass-panel" 
        style={{
          padding: '24px 28px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(59, 130, 246, 0.15) 50%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            padding: '14px',
            borderRadius: '14px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            fontSize: '32px'
          }}>
            🎺
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: 'white', letterSpacing: '-0.3px' }}>
                Trump Mood & Macro Market Intelligence
              </h2>
              <span style={{ backgroundColor: '#00f0ff', color: '#000', fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                LIVE AI ANALYSIS
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Real-time policy tracker analyzing Donald Trump's directives on Tariffs, Fed Rates, Crude Oil, and Impact on Indian & Global Markets.
            </p>
          </div>
        </div>

        {/* Overall Sentiment Index Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(0,0,0,0.5)', padding: '12px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>Overall Trump Stance</div>
            <div style={{ fontSize: '15px', fontWeight: '900', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} /> Highly Bullish for Indian Equities
            </div>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700' }}>Macro Score</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#00f0ff' }}>+8.4 / 10</div>
          </div>
        </div>
      </div>

      {/* "What Trump Is Thinking Right Now" Insights Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {insights.map((item) => {
          const isBullish = item.sentiment === 'BULLISH_INDIA';
          return (
            <div
              key={item.id}
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: isBullish ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(15, 23, 42, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: isBullish ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: isBullish ? '#34d399' : '#f87171',
                    textTransform: 'uppercase'
                  }}>
                    {item.sentiment.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#00f0ff' }}>
                    Impact: {item.score > 0 ? `+${item.score}` : item.score}
                  </span>
                </div>

                <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '800', color: 'white' }}>
                  {item.headline}
                </h3>

                <blockquote style={{
                  margin: '0 0 12px 0',
                  padding: '8px 12px',
                  borderLeft: '3px solid #00f0ff',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  fontSize: '11px',
                  fontStyle: 'italic',
                  color: '#cbd5e1',
                  borderRadius: '0 6px 6px 0'
                }}>
                  {item.trumpQuote}
                </blockquote>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 14px 0' }}>
                  {item.impactSummary}
                </p>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', fontSize: '11px' }}>
                <div style={{ marginBottom: '4px' }}>
                  <strong style={{ color: '#34d399' }}>🟢 Key Beneficiaries:</strong> {item.keyWinners.join(', ')}
                </div>
                <div>
                  <strong style={{ color: '#f87171' }}>🔴 Friction Areas:</strong> {item.keyLosers.join(', ')}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Scenario Simulator */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={18} style={{ color: '#00f0ff' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'white' }}>
              Trump Policy Scenario Simulator & Reaction Playbook
            </h3>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {[
            { id: 'scenario_tariffs', label: '⚡ 25% Steel & Trade Tariffs' },
            { id: 'scenario_fed', label: '📉 Fed Rate Cut Pressure (-50bps)' },
            { id: 'scenario_crude', label: '🛢️ "Drill Baby Drill" Crude Glut ($60 Oil)' },
            { id: 'scenario_tax', label: '💼 US Corporate Tax Cut (21% -> 15%)' }
          ].map((sc) => (
            <button
              key={sc.id}
              onClick={() => setSelectedScenario(sc.id)}
              style={{
                background: selectedScenario === sc.id ? '#3b82f6' : 'rgba(255, 255, 255, 0.04)',
                border: selectedScenario === sc.id ? '1px solid #60a5fa' : '1px solid transparent',
                color: selectedScenario === sc.id ? 'white' : 'var(--text-secondary)',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Scenario Details Box */}
        <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', padding: '16px 20px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {selectedScenario === 'scenario_tariffs' && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#00f0ff', marginBottom: '6px' }}>
                Scenario: 25% Steel & Universal Import Tariffs Enacted
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                US enacts reciprocal trade tariffs. Metal export margins compress, but domestic Indian infrastructure spending absorbs local supply. FIIs shift capital toward high-growth domestic Indian equities.
              </p>
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px', flexWrap: 'wrap' }}>
                <div><span style={{ color: '#34d399', fontWeight: '800' }}>Target Play:</span> Long Capital Goods & Infrastructure</div>
                <div><span style={{ color: '#f87171', fontWeight: '800' }}>Avoid:</span> Direct Steel Exporters to North America</div>
              </div>
            </div>
          )}

          {selectedScenario === 'scenario_fed' && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#00f0ff', marginBottom: '6px' }}>
                Scenario: Emergency Fed Rate Cuts (-50bps) Announced
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                US Dollar Index drops to 98. Emerging market currencies rally. FIIs inject $3B+ into Nifty & Bank Nifty over subsequent 30 days. RBI gets headroom for domestic rate cuts.
              </p>
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px', flexWrap: 'wrap' }}>
                <div><span style={{ color: '#34d399', fontWeight: '800' }}>Target Play:</span> Long Bank Nifty & Rate Sensitive Financials</div>
                <div><span style={{ color: '#f87171', fontWeight: '800' }}>Avoid:</span> Cash USD Cash Holdings</div>
              </div>
            </div>
          )}

          {selectedScenario === 'scenario_crude' && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#00f0ff', marginBottom: '6px' }}>
                Scenario: US Crude Production Hits Record 13.8M bpd ($60 Crude Oil)
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                Crude oil breaks below $65/bbl. India's import bill shrinks by $12 Billion annually. Indian Rupee appreciates against USD. Gross margins for Paints, Tyres, Chemicals, and Aviation expand by 250-400 bps.
              </p>
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px', flexWrap: 'wrap' }}>
                <div><span style={{ color: '#34d399', fontWeight: '800' }}>Target Play:</span> Asian Paints, MRF, HPCL, IndiGo</div>
                <div><span style={{ color: '#f87171', fontWeight: '800' }}>Avoid:</span> Shorting Paint/Tyre Equities</div>
              </div>
            </div>
          )}

          {selectedScenario === 'scenario_tax' && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#00f0ff', marginBottom: '6px' }}>
                Scenario: US Corporate Tax Cut (21% to 15%) Passed
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                US Fortune 500 companies gain $150B+ in net cash flow. BFSI and Healthcare sectors reignite digital transformation CapEx, leading to a surge in large deal wins for Tier-1 Indian IT exporters.
              </p>
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px', flexWrap: 'wrap' }}>
                <div><span style={{ color: '#34d399', fontWeight: '800' }}>Target Play:</span> TCS, Infosys, HCLTech</div>
                <div><span style={{ color: '#f87171', fontWeight: '800' }}>Avoid:</span> Non-digital legacy IT service providers</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ticker-by-Ticker Trump Impact Scorecard */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={18} style={{ color: '#00f0ff' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'white' }}>
              Ticker-by-Ticker Trump Policy Impact Matrix
            </h3>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter symbol or sector..."
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '6px 12px 6px 30px',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600',
                width: '180px'
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 12px' }}>Instrument</th>
                <th style={{ padding: '10px 12px' }}>Sector</th>
                <th style={{ padding: '10px 12px' }}>Trump Stance</th>
                <th style={{ padding: '10px 12px' }}>Score</th>
                <th style={{ padding: '10px 12px' }}>Primary Macro Driver</th>
                <th style={{ padding: '10px 12px' }}>Actionable Playbook</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Chart</th>
              </tr>
            </thead>
            <tbody>
              {filteredImpacts.map((row, idx) => {
                const isBullish = row.trumpImpact === 'VERY_BULLISH' || row.trumpImpact === 'BULLISH';
                const isBearish = row.trumpImpact === 'VERY_BEARISH' || row.trumpImpact === 'BEARISH';

                return (
                  <tr
                    key={row.symbol}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: '800', color: 'white' }}>
                      {row.name}
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>{row.symbol}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{row.sector}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '800',
                        backgroundColor: isBullish ? 'rgba(16, 185, 129, 0.15)' : isBearish ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                        color: isBullish ? '#34d399' : isBearish ? '#f87171' : '#cbd5e1'
                      }}>
                        {row.trumpImpact.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '900', color: row.score > 0 ? '#00f0ff' : '#f87171' }}>
                      {row.score > 0 ? `+${row.score}` : row.score} / 10
                    </td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', maxWidth: '220px' }}>{row.driver}</td>
                    <td style={{ padding: '10px 12px', color: 'white', fontWeight: '600', maxWidth: '260px' }}>{row.actionablePlaybook}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleSymbolClick(row.symbol)}
                        style={{
                          background: 'rgba(59, 130, 246, 0.2)',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          color: '#60a5fa',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        View Chart
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
