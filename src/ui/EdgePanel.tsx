import type { Side } from '../engine/utils';
import { getSideAngle } from '../engine/utils';
import { getDinoSVG } from '../engine/assets';

interface Props {
  side: Side;
  playerName: string;
  avatarId: number;
  color: string;
  score: number;
  active: boolean;
  lives?: number;
}

export default function EdgePanel({ side, playerName, avatarId, color, score, active, lives }: Props) {
  const rotation = getSideAngle(side);

  const posStyle: React.CSSProperties = (() => {
    const btn = 'min(120px, 15vh)';
    const pan = 'min(60px, 8vh)';
    switch (side) {
      case 'bottom': return { bottom: `calc(${btn})`, left: 0, right: 0, height: pan };
      case 'top':    return { top: `calc(${btn})`, left: 0, right: 0, height: pan };
      case 'left':   return { top: 0, left: `calc(${btn})`, bottom: 0, width: pan };
      case 'right':  return { top: 0, right: `calc(${btn})`, bottom: 0, width: pan };
    }
  })();

  return (
    <div style={{
      position: 'absolute', ...posStyle,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      background: active
        ? `linear-gradient(${rotation}deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))`
        : 'rgba(0,0,0,0.25)',
      zIndex: 15, pointerEvents: 'none', transition: 'all 0.3s',
      borderTop: side === 'bottom' ? `2px solid ${color}44` : undefined,
      borderBottom: side === 'top' ? `2px solid ${color}44` : undefined,
      borderLeft: side === 'right' ? `2px solid ${color}44` : undefined,
      borderRight: side === 'left' ? `2px solid ${color}44` : undefined,
    }}>
      <div style={{
        transform: `rotate(${rotation}deg)`,
        display: 'flex', alignItems: 'center', gap: '8px',
        opacity: active ? 1 : 0.4, transition: 'opacity 0.3s',
      }}>
        <div
          style={{ width: 32, height: 32, flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: getDinoSVG(avatarId, color, 32) }}
        />
        <span style={{
          color: 'white', fontSize: 'clamp(0.7rem, 2vw, 0.95rem)', fontWeight: 'bold',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)', maxWidth: '80px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{playerName}</span>
        <span style={{
          color, fontSize: 'clamp(0.8rem, 2.5vw, 1.1rem)', fontWeight: 'bold',
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }}>{score}</span>
        {lives !== undefined && lives > 0 && (
          <span style={{ fontSize: '0.75rem' }}>{'❤️'.repeat(Math.max(0, lives))}</span>
        )}
      </div>
    </div>
  );
}
