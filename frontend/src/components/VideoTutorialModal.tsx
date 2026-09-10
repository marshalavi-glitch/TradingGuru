import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Award, 
  TrendingUp, 
  TrendingDown, 
  X,
  Sparkles,
  Zap,
  Layers,
  ShieldCheck,
  Target
} from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VideoTutorialModal: React.FC<VideoModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const slides = [
    {
      title: "Chapter 1: The 🤝 Bhaichara Work Master Terminal",
      subtitle: "The all-in-one institutional decision engine",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#60a5fa', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={20} /> What You See on the Screen:
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              When you or your friends open the dashboard, the <strong>🤝 Bhaichara Work</strong> tab is your home terminal. It automatically computes 10 institutional mathematical models and provides an instant green/red directive: <strong>BUY CALLS (CE)</strong> or <strong>BUY PUTS (PE)</strong>.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <strong style={{ color: '#10b981', fontSize: '13px' }}>🟢 BUY CALLS (CE)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Triggered when Straddle Skew &gt; +15% and institutions accumulate call blocks.</p>
            </div>
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <strong style={{ color: '#ef4444', fontSize: '13px' }}>🔴 BUY PUTS (PE)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Triggered when Straddle Skew &lt; -15% and institutions accumulate put blocks.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Chapter 2: ATM Straddle Skew & Live Option Prices",
      subtitle: "Reading real-time institutional option demand",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>NIFTY ATM Straddle Example:</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981' }}>Skew Spread: +25.0%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ATM Call (24550 CE)</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>₹136.25</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ATM Put (24550 PE)</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>₹81.75</div>
              </div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            <strong>The Rule:</strong> If the Call price is significantly higher than the Put price (Spread &gt; +15%), smart money is bidding up Calls. Focus strictly on buying Calls on dips to support!
          </p>
        </div>
      )
    },
    {
      title: "Chapter 3: 🔥 F&O Early Hunter (e.g. NTPC Rebound)",
      subtitle: "How to pick stock options with 88% win rates",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '14px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'white' }}>NTPC (Bullish Rebound)</span>
              <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '4px' }}>
                🔥 88% BIG BULLISH SURGE
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Zone: L6 (S2) / L6 (S2) Confluence | Straddle Skew: <strong>+40.7%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px' }}>
              <span style={{ fontSize: '12px', color: 'white' }}>Spot: ₹342.50</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981' }}>Buy NTPC 340 CE @ ₹9.25</span>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            <strong>How to Trade It:</strong>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
              <li><strong>Entry:</strong> Buy `NTPC 340 CE` at ₹9.25 on 5-minute green rejection candle.</li>
              <li><strong>Stop Loss:</strong> Set Option SL at ₹7.00.</li>
              <li><strong>Target:</strong> Target Matrix R2 at ₹15.50 (1 : 2.5 Risk-to-Reward).</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Chapter 4: Daily Matrix Navigation & Reversals",
      subtitle: "Using R6 down to S6 levels and Candlestick wicks",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <strong style={{ color: '#ef4444', fontSize: '13px' }}>🔴 Resistance Levels (R2 to R6)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Target zones for Call profits. Look for Shooting Star / Rejection wicks to scalp Puts (PE).</p>
            </div>
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <strong style={{ color: '#10b981', fontSize: '13px' }}>🟢 Support Levels (S2 to S6)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Target zones for Put profits. Look for Hammer / Double Bottom wicks to buy Calls (CE).</p>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            <strong>The Golden Rule:</strong> Never buy Calls into Resistance (R2/R3), and never buy Puts into Support (S2/S3)!
          </p>
        </div>
      )
    },
    {
      title: "Chapter 5: 3:47 PM Automated Post-Market Learning",
      subtitle: "Continuous self-improving trading intelligence",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'rgba(147, 51, 234, 0.1)', border: '1px solid rgba(147, 51, 234, 0.25)', padding: '14px', borderRadius: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#c084fc', fontSize: '15px' }}>
              🧠 What Happens Every Day at 3:47 PM IST:
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              The server automatically runs `market_learnings_fetcher.js`, logs all winning/losing trades, diagnoses any Stop Loss hits, and updates the permanent rulebook so the system gets smarter every single day.
            </p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '12px', color: 'white', textAlign: 'center' }}>
            🤝 <strong>Share with Friends:</strong> Simply show them the <strong>🤝 Bhaichara Work</strong> tab and this video walkthrough!
          </div>
        </div>
      )
    }
  ];

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(4, 5, 8, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '720px',
        borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(20, 24, 39, 0.95) 0%, rgba(15, 18, 30, 0.98) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '8px', borderRadius: '10px' }}>
              <Play size={18} color="#3b82f6" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'white' }}>
                🎬 Dashboard Interactive Video Walkthrough
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Slide {currentSlide + 1} of {slides.length} • Step-by-Step Server Training
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body / Slide Content */}
        <div style={{ padding: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: 'white' }}>
              {slides[currentSlide].title}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#60a5fa' }}>
              {slides[currentSlide].subtitle}
            </p>
          </div>

          <div style={{ marginTop: '8px' }}>
            {slides[currentSlide].content}
          </div>
        </div>

        {/* Modal Footer / Navigation Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', background: 'rgba(0, 0, 0, 0.2)' }}>
          <button
            onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
            disabled={currentSlide === 0}
            className="glass-button"
            style={{ 
              padding: '8px 16px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              borderRadius: '8px', 
              cursor: currentSlide === 0 ? 'not-allowed' : 'pointer',
              opacity: currentSlide === 0 ? 0.4 : 1
            }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          {/* Slide Dots */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {slides.map((_, idx) => (
              <div 
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                style={{
                  width: idx === currentSlide ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: idx === currentSlide ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (currentSlide < slides.length - 1) {
                setCurrentSlide(prev => prev + 1);
              } else {
                onClose();
              }
            }}
            className="btn-primary"
            style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', cursor: 'pointer', background: '#3b82f6', color: 'white', fontWeight: 'bold' }}
          >
            {currentSlide === slides.length - 1 ? 'Finish & Trade' : 'Next Chapter'} <ChevronRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
};
