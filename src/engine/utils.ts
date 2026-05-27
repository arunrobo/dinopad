export type Side = 'top' | 'bottom' | 'left' | 'right';

export const SIDES: Side[] = ['top', 'bottom', 'left', 'right'];

export const PLAYER_COLORS: string[] = [
  '#4A90D9', '#E74C3C', '#27AE60', '#F39C12',
  '#9B59B6', '#1ABC9C', '#E91E63', '#00BCD4',
];

export const SIDE_ASSIGNMENTS: Record<number, Side[]> = {
  1: ['bottom'],
  2: ['bottom', 'top'],
  3: ['bottom', 'left', 'right'],
  4: ['bottom', 'top', 'left', 'right'],
};

export const CLOCKWISE_ORDER: Side[] = ['bottom', 'right', 'top', 'left'];

export function getSideAngle(side: Side): number {
  switch (side) {
    case 'top': return 180;
    case 'bottom': return 0;
    case 'left': return 90;
    case 'right': return -90;
  }
}

export function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
export function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
export function randInt(lo: number, hi: number) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
export function randRange(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }
export function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
export function generateId(): string { return Math.random().toString(36).slice(2, 10); }

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function lightenHex(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.min(255, Math.round(c + (255 - c) * amt));
  return `#${f(r).toString(16).padStart(2, '0')}${f(g).toString(16).padStart(2, '0')}${f(b).toString(16).padStart(2, '0')}`;
}
export function darkenHex(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amt)));
  return `#${f(r).toString(16).padStart(2, '0')}${f(g).toString(16).padStart(2, '0')}${f(b).toString(16).padStart(2, '0')}`;
}
