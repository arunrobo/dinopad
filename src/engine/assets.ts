export interface DinoAvatarDef {
  id: number;
  name: string;
  emoji: string;
  baseColor: string;
}

export const DINO_AVATARS: DinoAvatarDef[] = [
  { id: 0, name: 'Rex', emoji: '🦖', baseColor: '#4CAF50' },
  { id: 1, name: 'Trixie', emoji: '🦕', baseColor: '#42A5F5' },
  { id: 2, name: 'Spike', emoji: '🐊', baseColor: '#FF9800' },
  { id: 3, name: 'Longneck', emoji: '🦒', baseColor: '#9C27B0' },
  { id: 4, name: 'Ptera', emoji: '🦅', baseColor: '#00BCD4' },
  { id: 5, name: 'Tank', emoji: '🐢', baseColor: '#795548' },
  { id: 6, name: 'Dash', emoji: '🐉', baseColor: '#F44336' },
  { id: 7, name: 'Crest', emoji: '🦜', baseColor: '#FFD600' },
  { id: 8, name: 'Dome', emoji: '🥚', baseColor: '#E91E63' },
  { id: 9, name: 'Sail', emoji: '⛵', baseColor: '#3F51B5' },
  { id: 10, name: 'Tiny', emoji: '🐣', baseColor: '#8BC34A' },
  { id: 11, name: 'Fang', emoji: '🐗', baseColor: '#FF5722' },
];

export function getDinoSVG(avatarId: number, playerColor: string, size: number): string {
  const d = DINO_AVATARS[avatarId % DINO_AVATARS.length];
  const r = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${r}" cy="${r}" r="${r - 1}" fill="${d.baseColor}" stroke="${playerColor}" stroke-width="3"/>
    <text x="${r}" y="${r + size * 0.12}" text-anchor="middle" font-size="${size * 0.5}" dominant-baseline="middle">${d.emoji}</text>
  </svg>`;
}

export function drawDinoOnCanvas(
  ctx: CanvasRenderingContext2D, avatarId: number,
  cx: number, cy: number, size: number, playerColor: string,
) {
  const d = DINO_AVATARS[avatarId % DINO_AVATARS.length];
  const r = size / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = d.baseColor;
  ctx.fill();
  ctx.strokeStyle = playerColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = 'white';
  ctx.font = `${size * 0.5}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.emoji, cx, cy + 1);
}
