import type { Side } from '../../engine/utils';
import type { GameResultsData, PlayerResult } from '../../state/store';

export interface PlayerInGame {
  id: string;
  name: string;
  avatarId: number;
  color: string;
  side: Side;
  score: number;
  lives: number;
}

export interface GameConfig {
  players: PlayerInGame[];
  kidMode: boolean;
  turnDirection: 'clockwise' | 'counter-clockwise';
  turnTimer: number;
  boardTheme: 'jungle' | 'desert' | 'iceage';
}

export interface ButtonInput {
  pressed: boolean;
  justPressed: boolean;
  justReleased: boolean;
  holdTime: number;
}

export interface GameInstance {
  init(config: GameConfig, w: number, h: number): void;
  update(dt: number, inputs: Map<Side, ButtonInput>): void;
  render(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  getCurrentTurnSide(): Side;
  getTurnMessage?(): string;
  getPlayerStates(): PlayerInGame[];
  isFinished(): boolean;
  getResults(): GameResultsData;
  cleanup(): void;
}

export const GAME_NAMES = ['Dino Ladder', 'Fossil Flip', 'Volcano Dice Dash', 'Save Baby Dinos'];

/* ── Particle helpers ── */
export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

export function createParticle(x: number, y: number, color: string): Particle {
  const a = Math.random() * Math.PI * 2;
  const s = 30 + Math.random() * 80;
  return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, maxLife: 0.5 + Math.random() * 0.5, color, size: 2 + Math.random() * 4 };
}

export function updateParticles(particles: Particle[], dt: number): Particle[] {
  return particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.life -= dt; return p.life > 0; });
}

export function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  particles.forEach(p => {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

export function buildResults(
  gameId: number, coop: boolean, players: PlayerInGame[],
  statsMap: Map<string, Record<string, number>>, sharedScore?: number,
): GameResultsData {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const pr: PlayerResult[] = sorted.map((p, i) => ({
    id: p.id, name: p.name, avatarId: p.avatarId, color: p.color, side: p.side,
    score: p.score, rank: i + 1, stats: statsMap.get(p.id) || {},
  }));
  return { gameId, gameName: GAME_NAMES[gameId], coop, sharedScore, playerResults: pr };
}
