import { useRef, useCallback, type ReactNode } from 'react';
import type { Side } from '../engine/utils';
import { getSideAngle } from '../engine/utils';
import { inputManager } from '../engine/inputManager';
import { audioManager } from '../engine/audioManager';
import { getDinoSVG } from '../engine/assets';

interface Props {
  side: Side;
  color: string;
  active: boolean;
  playerName?: string;
  avatarId?: number;
  score?: number;
  children?: ReactNode;
  label?: string;
}

export default function BigEdgeButton({ side, color, active, playerName, avatarId, score, children, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handleDown = useCallback((e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    inputManager.setPressed(side, true);
    audioManager.play('tap');
  }, [side, active]);

  const handleUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    inputManager.setPressed(side, false);
  }, [side]);

  const isHoriz = side === 'top' || side === 'bottom';
  const isVert = !isHoriz;

  const posStyle: React.CSSProperties = (() => {
    const sz = 'min(44px, 6vh)';
    switch (side) {
      case 'bottom': return { bottom: 0, left: 0, right: 0, height: `calc(${sz} + env(safe-area-inset-bottom))`, paddingBottom: 'env(safe-area-inset-bottom)' };
      case 'top':    return { top: 0, left: 0, right: 0, height: `calc(${sz} + env(safe-area-inset-top))`, paddingTop: 'env(safe-area-inset-top)' };
      case 'left':   return { top: 0, left: 0, bottom: 0, width: `calc(${sz} + env(safe-area-inset-left))`, paddingLeft: 'env(safe-area-inset-left)' };
      case 'right':  return { top: 0, right: 0, bottom: 0, width: `calc(${sz} + env(safe-area-inset-right))`, paddingRight: 'env(safe-area-inset-right)' };
    }
  })();

  const rotation = getSideAngle(side);
  const needsFlip = side === 'top';
  // Left reads top-to-bottom, right reads bottom-to-top
  const vertRotate = side === 'left' ? 90 : side === 'right' ? -90 : needsFlip ? 180 : 0;

  const avSize = isVert ? 20 : 24;
  const fontActive = 'clamp(0.55rem, 1.8vw, 0.8rem)';
  const fontInactive = 'clamp(0.5rem, 1.5vw, 0.7rem)';
  const iconSize = 'clamp(0.8rem, 2.5vw, 1.2rem)';

  return (
    <div
      ref={ref}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onPointerLeave={handleUp}
      className={active ? 'edge-btn-active' : 'edge-btn-wait'}
      style={{
        position: 'absolute',
        ...posStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active
          ? `linear-gradient(${rotation}deg, ${color}dd, ${color}88)`
          : 'rgba(30,30,30,0.75)',
        cursor: active ? 'pointer' : 'default',
        touchAction: 'none',
        zIndex: 20,
        transition: 'background 0.3s, opacity 0.3s, box-shadow 0.3s',
        opacity: active ? 1 : 0.5,
        border: active ? `2px solid ${color}` : '1px solid rgba(80,80,80,0.3)',
        boxShadow: active
          ? `inset 0 0 20px ${color}44, 0 0 12px ${color}55`
          : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Content always in a row: Icon | Name | Score | Finger — rotated for orientation */}
      <div
        style={{
          transform: vertRotate ? `rotate(${vertRotate}deg)` : undefined,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '5px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {avatarId !== undefined && (
          <div
            style={{ width: avSize, height: avSize, flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: getDinoSVG(avatarId, color, avSize) }}
          />
        )}
        {active ? (
          children || (<>
            {playerName && <span style={{ fontSize: fontActive, fontWeight: 800, fontFamily: "'Fredoka One', cursive", color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{playerName}</span>}
            {score !== undefined && <span style={{ fontSize: fontActive, fontWeight: 800, fontFamily: "'Fredoka One', cursive", color }}>{score}</span>}
            <span className="pulse-icon" style={{ fontSize: iconSize }}>👆</span>
          </>)
        ) : (<>
          {playerName && <span style={{ fontSize: fontInactive, fontFamily: "'Fredoka One', cursive", color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>{playerName}</span>}
          {score !== undefined && <span style={{ fontSize: fontInactive, fontFamily: "'Fredoka One', cursive", color: `${color}99`, fontWeight: 700 }}>{score}</span>}
          <span style={{ fontSize: fontInactive, fontFamily: "'Nunito', sans-serif", color: 'rgba(255,255,255,0.3)', fontWeight: 'bold', letterSpacing: '1px' }}>{label || 'WAIT'}</span>
        </>)}
      </div>
    </div>
  );
}
