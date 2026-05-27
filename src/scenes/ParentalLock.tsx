import { useState, useEffect, useCallback, useRef } from 'react';

interface Props {
  lockedUntil: number;   // timestamp when cooldown ends
  totalCooldownMs: number;
  onUnlock: () => void;
}

interface Challenge {
  question: string;
  answer: number;
}

function makeMathChallenge(): Challenge {
  // 50% multiplication (3-digit × 2-digit), 50% division (4-digit ÷ 2-digit, exact)
  if (Math.random() < 0.5) {
    const a = 100 + Math.floor(Math.random() * 900); // 100–999
    const b = 12  + Math.floor(Math.random() * 88);  // 12–99
    return { question: `${a} × ${b}`, answer: a * b };
  } else {
    const divisor  = 12 + Math.floor(Math.random() * 88); // 12–99
    const quotient = 12 + Math.floor(Math.random() * 88); // 12–99
    return { question: `${divisor * quotient} ÷ ${divisor}`, answer: quotient };
  }
}

function fmtTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const DINO_MSGS = [
  'Your dinos need rest too! 🌿',
  'Even T-Rex takes naps! 💤',
  'Recharge for more adventures! 🌟',
  'Dinos are resting in their nests 🥚',
];

export default function ParentalLock({ lockedUntil, totalCooldownMs, onUnlock }: Props) {
  const [remaining, setRemaining] = useState(() => Math.max(0, lockedUntil - Date.now()));
  const [showChallenge, setShowChallenge] = useState(false);
  const [challenge, setChallenge] = useState<Challenge>(makeMathChallenge);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dinoMsg] = useState(() => DINO_MSGS[Math.floor(Math.random() * DINO_MSGS.length)]);

  useEffect(() => {
    const tick = () => {
      const rem = Math.max(0, lockedUntil - Date.now());
      setRemaining(rem);
      if (rem === 0) onUnlock();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil, onUnlock]);

  const openChallenge = useCallback(() => {
    setChallenge(makeMathChallenge());
    setInput('');
    setError('');
    setAttempts(0);
    setShowChallenge(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const submitAnswer = useCallback(() => {
    const val = parseInt(input.trim(), 10);
    if (!isNaN(val) && val === challenge.answer) {
      onUnlock();
      return;
    }
    const next = attempts + 1;
    setAttempts(next);
    const msgs = [
      'Not quite — try again! 🔢',
      'Hmm, wrong answer! 🤔',
      'Almost? Give it another go! 🦕',
      'Still incorrect — stay sharp! 🧠',
    ];
    setError(msgs[Math.min(next - 1, msgs.length - 1)]);
    setInput('');
    // Regenerate question every 3 wrong attempts so a watching child can't memorise
    if (next % 3 === 0) {
      setChallenge(makeMathChallenge());
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, challenge.answer, attempts, onUnlock]);

  const progress = Math.min(1, 1 - remaining / totalCooldownMs);
  const nearEnd = remaining < 5 * 60 * 1000;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      background: 'linear-gradient(160deg, #0a1508 0%, #1a3a15 45%, #0d2010 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontFamily: "'Nunito', system-ui, sans-serif",
      gap: '18px', padding: '32px', overflow: 'hidden',
    }}>
      {/* Decorative background dinos */}
      <div style={{ position: 'absolute', bottom: '6%', left: '5%', fontSize: '3.5rem', opacity: 0.12, animation: 'float 7s ease-in-out infinite' }}>🦕</div>
      <div style={{ position: 'absolute', bottom: '8%', right: '5%', fontSize: '3.5rem', opacity: 0.12, animation: 'float 9s ease-in-out infinite 2s', transform: 'scaleX(-1)' }}>🦖</div>
      <div style={{ position: 'absolute', top: '6%', right: '10%', fontSize: '2.5rem', opacity: 0.1, animation: 'float 6s ease-in-out infinite 1s' }}>🌿</div>

      {/* Lock icon */}
      <div style={{ fontSize: 'clamp(3rem, 8vw, 4.5rem)', lineHeight: 1 }}>🔒</div>

      {/* Title */}
      <div style={{
        fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 900, color: '#FFD700',
        fontFamily: "'Fredoka One', cursive",
        textShadow: '2px 2px 0 #b8860b, 0 0 24px rgba(255,215,0,0.25)',
        textAlign: 'center', letterSpacing: '1px',
      }}>
        Time's Up, Dinos! 🦕
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 'clamp(0.85rem, 2.2vw, 1rem)', opacity: 0.75,
        textAlign: 'center', maxWidth: 380, lineHeight: 1.6,
        fontFamily: "'Nunito', sans-serif",
      }}>
        You've had an amazing dino adventure today!<br />
        <span style={{ color: '#a8d5a2' }}>{dinoMsg}</span>
      </div>

      {/* Countdown card */}
      <div style={{
        background: 'rgba(0,0,0,0.45)', borderRadius: '22px', padding: '22px 48px',
        border: '2px solid rgba(255,215,0,0.2)', textAlign: 'center',
        boxShadow: '0 6px 32px rgba(0,0,0,0.5)', minWidth: 260,
      }}>
        <div style={{
          fontSize: '0.7rem', opacity: 0.55, letterSpacing: '2.5px',
          textTransform: 'uppercase', marginBottom: '8px', fontFamily: "'Nunito', sans-serif",
        }}>
          Available again in
        </div>
        <div style={{
          fontSize: 'clamp(2.8rem, 9vw, 4.5rem)', fontFamily: "'Fredoka One', cursive",
          color: nearEnd ? '#69F0AE' : '#FFD700',
          letterSpacing: '4px', lineHeight: 1,
          transition: 'color 2s',
          textShadow: nearEnd ? '0 0 16px rgba(105,240,174,0.4)' : '0 0 16px rgba(255,215,0,0.3)',
        }}>
          {fmtTime(remaining)}
        </div>

        {/* Progress bar */}
        <div style={{
          marginTop: '14px', background: 'rgba(255,255,255,0.08)',
          borderRadius: '10px', height: '7px', width: '100%', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '10px',
            width: `${progress * 100}%`,
            background: nearEnd
              ? 'linear-gradient(90deg, #69F0AE, #00BFA5)'
              : 'linear-gradient(90deg, #4CAF50, #8BC34A)',
            transition: 'width 1s linear, background 2s',
          }} />
        </div>
      </div>

      {/* Parent unlock button */}
      <button
        onClick={openChallenge}
        style={{
          marginTop: '4px', padding: '13px 34px',
          borderRadius: '50px', border: '2px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.8)',
          cursor: 'pointer', fontFamily: "'Fredoka One', cursive",
          fontSize: 'clamp(0.85rem, 2.2vw, 1rem)', letterSpacing: '0.5px',
          transition: 'background 0.2s, border-color 0.2s, transform 0.1s',
        }}
        onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
        onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
      >
        🔑 Parent Unlock
      </button>

      {/* Math challenge modal */}
      {showChallenge && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 8100,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowChallenge(false); }}
        >
          <div style={{
            background: 'linear-gradient(160deg, #1e4a18, #0d2a0a)',
            borderRadius: '28px', padding: '36px 44px',
            border: '2px solid rgba(255,215,0,0.35)',
            boxShadow: '0 16px 56px rgba(0,0,0,0.7)',
            width: '100%', maxWidth: '440px', textAlign: 'center',
            animation: 'bounceIn 0.3s ease',
          }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>🧮</div>

            <div style={{
              fontSize: 'clamp(1.3rem, 3.5vw, 1.6rem)', color: '#FFD700',
              fontFamily: "'Fredoka One', cursive", marginBottom: '4px',
            }}>
              Parent Challenge
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.55, marginBottom: '24px', fontFamily: "'Nunito', sans-serif" }}>
              Solve this to unlock more playtime
            </div>

            {/* Question */}
            <div style={{
              fontSize: 'clamp(1.8rem, 5.5vw, 2.6rem)', fontFamily: "'Fredoka One', cursive",
              color: 'white', letterSpacing: '3px',
              background: 'rgba(0,0,0,0.35)', borderRadius: '16px',
              padding: '18px 24px', marginBottom: '22px',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {challenge.question} = ?
            </div>

            {/* Answer input */}
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="-?[0-9]*"
              value={input}
              onChange={e => { setInput(e.target.value.replace(/[^0-9-]/g, '')); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') submitAnswer(); if (e.key === 'Escape') setShowChallenge(false); }}
              placeholder="Type your answer…"
              style={{
                width: '100%', padding: '14px 18px', borderRadius: '14px',
                border: `2px solid ${error ? '#ef5350' : 'rgba(255,255,255,0.2)'}`,
                background: 'rgba(255,255,255,0.08)', color: 'white',
                fontSize: '1.25rem', textAlign: 'center', outline: 'none',
                fontFamily: "'Nunito', sans-serif", marginBottom: error ? '8px' : '20px',
                boxSizing: 'border-box', transition: 'border-color 0.2s',
              }}
            />

            {error && (
              <div style={{
                color: '#ff8a80', fontSize: '0.85rem', marginBottom: '16px',
                fontFamily: "'Nunito', sans-serif",
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowChallenge(false)}
                style={{
                  padding: '12px 26px', borderRadius: '40px',
                  border: '2px solid rgba(255,255,255,0.18)',
                  background: 'transparent', color: 'rgba(255,255,255,0.65)',
                  cursor: 'pointer', fontFamily: "'Fredoka One', cursive",
                  fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancel
              </button>
              <button
                onClick={submitAnswer}
                style={{
                  padding: '12px 30px', borderRadius: '40px', border: 'none',
                  background: 'linear-gradient(135deg, #4CAF50, #27AE60)',
                  color: 'white', cursor: 'pointer',
                  fontFamily: "'Fredoka One', cursive",
                  fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                  boxShadow: '0 4px 14px rgba(76,175,80,0.45)',
                  transition: 'transform 0.1s, box-shadow 0.2s',
                }}
                onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
                onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ✓ Submit
              </button>
            </div>

            {attempts > 0 && (
              <div style={{ marginTop: '16px', fontSize: '0.75rem', opacity: 0.4, fontFamily: "'Nunito', sans-serif" }}>
                {attempts} incorrect {attempts === 1 ? 'attempt' : 'attempts'}
                {attempts % 3 === 0 ? ' — new question!' : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
