import type { GameInstance, GameConfig, PlayerInGame, ButtonInput, Particle } from './types';
import { buildResults, createParticle, updateParticles, renderParticles } from './types';
import type { Side } from '../../engine/utils';
import { randRange, dist } from '../../engine/utils';
import { createTurnState, getCurrentSide, advanceTurn, type TurnState } from '../../engine/turnManager';
import { audioManager } from '../../engine/audioManager';

interface Baby { id: number; x: number; y: number; vx: number; vy: number; rescued: boolean; lost: boolean; }
interface Hazard { x: number; y: number; radius: number; type: 'tar' | 'river'; }
type Phase = 'play' | 'finished';

export function createGame4(): GameInstance {
  let players: PlayerInGame[] = [];
  let turn: TurnState;
  let babies: Baby[] = [];
  let hazards: Hazard[] = [];
  let phase: Phase = 'play';
  let particles: Particle[] = [];
  let turnMessage = '';
  let stats = new Map<string, Record<string, number>>();
  let round = 0, maxRounds = 12, rescueGoal = 6;
  let totalRescued = 0, totalLost = 0;
  let shieldCDs = new Map<string, number>();
  let finishDelay = 0;
  let kidMode = false;
  let gW = 0, gH = 0;
  let acted = false;

  function spawnBabies(w: number, h: number, n: number) {
    const m = Math.min(w, h) * 0.15;
    for (let i = 0; i < n; i++)
      babies.push({ id: babies.length, x: randRange(m, w - m), y: randRange(m, h - m), vx: randRange(-20, 20), vy: randRange(-20, 20), rescued: false, lost: false });
  }

  function spawnHazards(w: number, h: number) {
    hazards = [];
    const n = kidMode ? 2 : 3;
    const m = Math.min(w, h) * 0.2;
    const pts = [{ x: m * 0.5, y: h / 2 }, { x: w - m * 0.5, y: h / 2 }, { x: w / 2, y: h - m * 0.4 }];
    for (let i = 0; i < n; i++) hazards.push({ ...pts[i], radius: kidMode ? 35 : 45, type: i % 2 === 0 ? 'tar' : 'river' });
  }

  function nearestBaby(): Baby | null {
    let best: Baby | null = null, md = Infinity;
    for (const b of babies) {
      if (b.rescued || b.lost) continue;
      let mh = Infinity;
      for (const h of hazards) { const d = dist(b.x, b.y, h.x, h.y); if (d < mh) mh = d; }
      if (mh < md) { md = mh; best = b; }
    }
    return best;
  }

  function driftBabies(dt: number) {
    for (const b of babies) {
      if (b.rescued || b.lost) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < 20 || b.x > gW - 20) b.vx *= -0.8;
      if (b.y < 20 || b.y > gH - 20) b.vy *= -0.8;
      b.x = Math.max(10, Math.min(gW - 10, b.x));
      b.y = Math.max(10, Math.min(gH - 10, b.y));
      for (const h of hazards) {
        const d = dist(b.x, b.y, h.x, h.y);
        if (d < 200 && d > 0) { const pull = kidMode ? 3 : 8; b.vx += ((h.x - b.x) / d) * pull * dt; b.vy += ((h.y - b.y) / d) * pull * dt; }
        if (d < h.radius) { b.lost = true; totalLost++; audioManager.play('oops'); for (let i = 0; i < 5; i++) particles.push(createParticle(b.x, b.y, '#FF4444')); }
      }
    }
  }

  function endTurn() {
    round++;
    if (totalRescued >= rescueGoal || round >= maxRounds) {
      phase = 'finished'; finishDelay = 2.5;
      const won = totalRescued >= rescueGoal;
      turnMessage = won ? 'Team wins! 🎉' : `Time up! Saved ${totalRescued}/${rescueGoal}`;
      audioManager.play(won ? 'win' : 'lose'); return;
    }
    turn = advanceTurn(turn); acted = false;
    setTimeout(() => { turnMessage = 'TAP = rescue! HOLD = shield!'; }, 600);
  }

  return {
    init(cfg, w, h) {
      players = cfg.players; kidMode = cfg.kidMode; gW = w; gH = h;
      maxRounds = kidMode ? 16 : 12; rescueGoal = kidMode ? 5 : 8;
      turn = createTurnState(players.map(p => p.side), cfg.turnDirection);
      spawnHazards(w, h); babies = []; spawnBabies(w, h, rescueGoal + 4);
      players.forEach(p => { p.score = 0; stats.set(p.id, { rescues: 0, shields: 0 }); shieldCDs.set(p.id, 0); });
      round = 0; totalRescued = 0; totalLost = 0; phase = 'play'; acted = false;
      turnMessage = 'TAP = rescue! HOLD = shield!';
    },

    update(dt, inputs) {
      particles = updateParticles(particles, dt);
      if (phase === 'finished') { finishDelay -= dt; return; }
      driftBabies(dt);
      for (const [id, cd] of shieldCDs) if (cd > 0) shieldCDs.set(id, cd - dt);
      const side = getCurrentSide(turn);
      const input = inputs.get(side);
      const cp = players.find(p => p.side === side)!;

      if (input?.justPressed && !acted) {
        const baby = nearestBaby();
        if (baby) {
          baby.rescued = true; totalRescued++; cp.score++; stats.get(cp.id)!.rescues++;
          audioManager.play('rescue'); turnMessage = `Baby rescued! 🥚 (${totalRescued}/${rescueGoal})`;
          for (let i = 0; i < 8; i++) particles.push(createParticle(baby.x, baby.y, '#4CAF50'));
          acted = true; endTurn();
        }
      }
      if (input && input.holdTime > 0.6 && !acted) {
        const cd = shieldCDs.get(cp.id) || 0;
        if (cd <= 0) {
          shieldCDs.set(cp.id, 3); stats.get(cp.id)!.shields++; audioManager.play('shield'); turnMessage = 'Shield! Babies pushed!';
          for (const b of babies) {
            if (b.rescued || b.lost) continue;
            for (const h of hazards) {
              const d = dist(b.x, b.y, h.x, h.y);
              if (d < 120 && d > 0) { b.vx += ((b.x - h.x) / d) * 80; b.vy += ((b.y - h.y) / d) * 80; }
            }
            for (let i = 0; i < 3; i++) particles.push(createParticle(b.x, b.y, '#29B6F6'));
          }
          acted = true; endTurn();
        } else { turnMessage = `Shield cooling down...`; }
      }
    },

    render(ctx, w, h) {
      ctx.fillStyle = '#1a3a1a'; ctx.fillRect(0, 0, w, h);
      hazards.forEach(hz => {
        const g = ctx.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.radius);
        g.addColorStop(0, hz.type === 'tar' ? 'rgba(50,30,10,0.9)' : 'rgba(30,100,200,0.8)');
        g.addColorStop(1, hz.type === 'tar' ? 'rgba(50,30,10,0.2)' : 'rgba(30,100,200,0.1)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,0,0,0.4)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(hz.type === 'tar' ? '🪨' : '🌊', hz.x, hz.y);
      });
      babies.forEach(b => {
        if (b.lost) return;
        if (b.rescued) {
          ctx.fillStyle = 'rgba(76,175,80,0.3)'; ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✓', b.x, b.y); return;
        }
        ctx.fillStyle = '#F5F0DC'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 10, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#C8B896'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#D4C9A8'; ctx.beginPath(); ctx.arc(b.x - 3, b.y - 3, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(b.x + 4, b.y + 2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(b.x - 2, b.y - 8, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(b.x + 2, b.y - 8, 1.5, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(w / 2 - 80, 8, 160, 30, 6); ctx.fill();
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`Round ${round + 1}/${maxRounds}  🥚 ${totalRescued}/${rescueGoal}`, w / 2, 23);
      renderParticles(ctx, particles);
    },

    getCurrentTurnSide() { return getCurrentSide(turn); },
    getTurnMessage() { return turnMessage; },
    getPlayerStates() { return players; },
    isFinished() { return phase === 'finished' && finishDelay <= 0; },
    getResults() { return buildResults(3, true, players, stats, totalRescued); },
    cleanup() {},
  };
}
