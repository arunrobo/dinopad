let rafId = 0;
let lastTime = 0;
let callback: ((dt: number) => void) | null = null;

function loop(now: number) {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  callback?.(dt);
}

export function startGameLoop(cb: (dt: number) => void) {
  callback = cb;
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);
}

export function stopGameLoop() {
  cancelAnimationFrame(rafId);
  callback = null;
}
