import { useRef, useEffect, useCallback } from 'react';
import type { Side } from '../engine/utils';

interface Props { onCanvas: (canvas: HTMLCanvasElement) => void; activeSides: Side[]; }

const EDGE = 'min(44px, 6vh)';
const edgeSz = (side: 'top' | 'bottom' | 'left' | 'right') => {
  if (side === 'top')    return `calc(${EDGE} + env(safe-area-inset-top))`;
  if (side === 'bottom') return `calc(${EDGE} + env(safe-area-inset-bottom))`;
  if (side === 'left')   return `calc(${EDGE} + env(safe-area-inset-left))`;
  return `calc(${EDGE} + env(safe-area-inset-right))`;
};

export default function CenterCanvas({ onCanvas, activeSides }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  const resize = useCallback(() => {
    const c = ref.current;
    const w = wrapRef.current;
    if (!c || !w) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = w.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    c.style.width = rect.width + 'px';
    c.style.height = rect.height + 'px';
    const ctx = c.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    const c = ref.current;
    const w = wrapRef.current;
    if (!c || !w) return;
    resize();
    onCanvas(c);
    const ro = new ResizeObserver(resize);
    ro.observe(w);
    window.addEventListener('resize', resize);
    return () => { ro.disconnect(); window.removeEventListener('resize', resize); };
  }, [onCanvas, resize]);

  const has = (s: Side) => activeSides.includes(s);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'absolute',
        top: has('top') ? edgeSz('top') : 'env(safe-area-inset-top)',
        bottom: has('bottom') ? edgeSz('bottom') : 'env(safe-area-inset-bottom)',
        left: has('left') ? edgeSz('left') : 'env(safe-area-inset-left)',
        right: has('right') ? edgeSz('right') : 'env(safe-area-inset-right)',
      }}
    >
      <canvas ref={ref} style={{ display: 'block' }} />
    </div>
  );
}
