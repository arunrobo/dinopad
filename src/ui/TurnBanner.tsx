import { useEffect, useState } from 'react';
import { getDinoSVG } from '../engine/assets';

interface Props {
  playerName: string;
  avatarId: number;
  color: string;
  message?: string;
  timerValue?: number;
  timerMax?: number;
}

export default function TurnBanner({ playerName, avatarId, color, message, timerValue, timerMax }: Props) {
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => { setAnimKey(k => k + 1); }, [playerName]);

  const showTimer = timerMax && timerMax > 0 && timerValue !== undefined && timerValue > 0;
  const timerPct = showTimer ? (timerValue! / timerMax!) * 100 : 0;
  const timerUrgent = showTimer && timerValue! <= 5;

  return (
    <div key={animKey} className="turn-banner" style={{
      position: 'absolute',
      bottom: 'calc(min(50px, 7vh) + env(safe-area-inset-bottom))', right: 'calc(8px + env(safe-area-inset-right))',
      zIndex: 40, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: '6px',
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      borderRadius: '16px',
      padding: '3px 12px 3px 3px',
      border: `2px solid ${color}88`,
      boxShadow: `0 2px 10px ${color}44`,
    }}>
      {/* Compact avatar */}
      <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: -2,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          boxShadow: `0 0 8px ${color}66`,
          animation: 'turnGlow 1.5s ease-in-out infinite',
        }} />
        <div
          style={{ width: 36, height: 36 }}
          dangerouslySetInnerHTML={{ __html: getDinoSVG(avatarId, color, 36) }}
        />
      </div>

      {/* Name + message */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <div style={{
          color, fontWeight: 800,
          fontFamily: "'Fredoka One', cursive",
          fontSize: 'clamp(0.8rem, 2.5vw, 1.1rem)',
          textShadow: `0 0 6px ${color}66`,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
        }}>
          {playerName}'s Turn!
        </div>
        {message && (
          <div style={{
            fontSize: 'clamp(0.5rem, 1.5vw, 0.7rem)',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
          }}>
            {message}
          </div>
        )}
      </div>

      {/* Timer bar */}
      {showTimer && (
        <div style={{
          width: 50, height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.15)',
          overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${timerPct}%`,
            background: timerUrgent
              ? 'linear-gradient(90deg, #FF4444, #FF8800)'
              : `linear-gradient(90deg, ${color}, ${color}88)`,
            transition: 'width 0.3s linear',
            animation: timerUrgent ? 'timerPulse 0.5s ease-in-out infinite' : undefined,
          }} />
        </div>
      )}
    </div>
  );
}
