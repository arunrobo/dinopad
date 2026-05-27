import type { GameInstance, GameConfig, PlayerInGame, ButtonInput, Particle } from './types';
import { buildResults, createParticle, updateParticles, renderParticles } from './types';
import type { Side } from '../../engine/utils';
import { randRange, dist } from '../../engine/utils';
import { createTurnState, getCurrentSide, advanceTurn, type TurnState } from '../../engine/turnManager';
import { drawDinoOnCanvas } from '../../engine/assets';
import { audioManager } from '../../engine/audioManager';

const BABY_COLORS = ['#FF8A65','#FFB74D','#AED581','#80CBC4','#CE93D8','#F48FB1','#90CAF9','#FFCC80'];
const BG_THEMES: Record<string, string> = { jungle: '#0e2a0e', desert: '#1e0e04', iceage: '#080e1e' };

interface Baby { id: number; x: number; y: number; vx: number; vy: number; rescued: boolean; lost: boolean; dino: number; color: string; }
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
  let boardTheme = 'jungle';
  let gW = 0, gH = 0;
  let acted = false;
  let pendingTurn = false, pendingTurnTimer = 0;
  let globalTime = 0;

  function spawnBabies(w: number, h: number, n: number) {
    const m = Math.min(w, h) * 0.15;
    for (let i = 0; i < n; i++) {
      const idx = babies.length;
      babies.push({ id: idx, x: randRange(m, w - m), y: randRange(m, h - m),
        vx: randRange(-12, 12), vy: randRange(-12, 12),
        rescued: false, lost: false, dino: idx % 8, color: BABY_COLORS[idx % BABY_COLORS.length] });
    }
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
        if (d < 200 && d > 0) { const pull = kidMode ? 2 : 4; b.vx += ((h.x - b.x) / d) * pull * dt; b.vy += ((h.y - b.y) / d) * pull * dt; }
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
      players = cfg.players; kidMode = cfg.kidMode; boardTheme = cfg.boardTheme; gW = w; gH = h;
      maxRounds = kidMode ? 16 : 12; rescueGoal = kidMode ? 5 : 8;
      turn = createTurnState(players.map(p => p.side), cfg.turnDirection);
      spawnHazards(w, h); babies = []; spawnBabies(w, h, rescueGoal + 4);
      players.forEach(p => { p.score = 0; stats.set(p.id, { rescues: 0, shields: 0 }); shieldCDs.set(p.id, 0); });
      round = 0; totalRescued = 0; totalLost = 0; phase = 'play'; acted = false; pendingTurn = false; globalTime = 0;
      turnMessage = 'TAP = rescue! HOLD = shield!';
    },

    update(dt, inputs) {
      globalTime += dt;
      particles = updateParticles(particles, dt);
      if (phase === 'finished') { finishDelay -= dt; return; }

      // Pending turn delay (show rescue/shield effect before advancing)
      if (pendingTurn) {
        pendingTurnTimer -= dt;
        driftBabies(dt);
        if (pendingTurnTimer <= 0) { pendingTurn = false; endTurn(); }
        return;
      }

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
          acted = true; pendingTurn = true; pendingTurnTimer = 1.4;
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
          acted = true; pendingTurn = true; pendingTurnTimer = 1.2;
        } else { turnMessage = `Shield cooling down...`; }
      }
    },

    render(ctx, w, h) {
      // Themed background
      ctx.fillStyle = BG_THEMES[boardTheme] || BG_THEMES.jungle; ctx.fillRect(0, 0, w, h);

      // Subtle background pattern
      const bgDeco = boardTheme === 'desert' ? ['🌵','🏜️'] : boardTheme === 'iceage' ? ['❄️','🧊'] : ['🌿','🌱'];
      ctx.font = `${Math.min(w, h) * 0.04}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [[0.1, 0.2], [0.85, 0.15], [0.08, 0.78], [0.88, 0.82]].forEach(([x, y], di) => {
        ctx.globalAlpha = 0.18 + 0.06 * Math.sin(globalTime * 0.6 + di);
        ctx.fillText(bgDeco[di % bgDeco.length], w * x, h * y);
      });
      ctx.globalAlpha = 1;

      // ── Hazards ────────────────────────────────────────────────────────
      hazards.forEach(hz => {
        // Animated pulsing danger ring
        const pulse = 1 + 0.08 * Math.sin(globalTime * 2.5);
        const outerR = hz.radius * 1.5 * pulse;
        const gradOuter = ctx.createRadialGradient(hz.x, hz.y, hz.radius * 0.4, hz.x, hz.y, outerR);
        gradOuter.addColorStop(0, 'rgba(255,60,60,0)');
        gradOuter.addColorStop(1, 'rgba(255,60,60,0.12)');
        ctx.fillStyle = gradOuter; ctx.beginPath(); ctx.arc(hz.x, hz.y, outerR, 0, Math.PI * 2); ctx.fill();

        // Main hazard fill
        const g = ctx.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.radius);
        const isWater = hz.type === 'river';
        g.addColorStop(0, isWater ? 'rgba(30,100,220,0.92)' : 'rgba(40,24,8,0.92)');
        g.addColorStop(1, isWater ? 'rgba(20,60,160,0.55)' : 'rgba(30,18,4,0.55)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2); ctx.fill();

        // Dashed danger border
        const bc = 0.5 + 0.4 * Math.abs(Math.sin(globalTime * 3));
        ctx.strokeStyle = `rgba(255,60,60,${bc})`; ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

        // Hazard emoji + glow
        ctx.shadowColor = isWater ? '#2979FF' : '#FF6D00'; ctx.shadowBlur = 12;
        ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const em = boardTheme === 'iceage' ? (isWater ? '🧊' : '❄️') : boardTheme === 'desert' ? (isWater ? '🌊' : '🏜️') : (isWater ? '🌊' : '🪨');
        ctx.fillText(em, hz.x, hz.y);
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      });

      // ── Nearest baby highlight ─────────────────────────────────────────
      const nearest = nearestBaby();
      if (nearest) {
        const pulseR = 20 + 4 * Math.sin(globalTime * 5);
        ctx.strokeStyle = `rgba(255,255,0,${0.5 + 0.4 * Math.abs(Math.sin(globalTime * 5))})`;
        ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(nearest.x, nearest.y, pulseR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── Babies ────────────────────────────────────────────────────────
      babies.forEach(b => {
        if (b.lost) return;
        if (b.rescued) {
          // Rescued — show small green checkmark
          ctx.fillStyle = 'rgba(76,175,80,0.35)';
          ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '14px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✓', b.x, b.y);
          return;
        }
        // Wobble when near hazard
        let nearHazardFactor = 0;
        for (const hz of hazards) {
          const d = dist(b.x, b.y, hz.x, hz.y);
          if (d < hz.radius * 2.5) nearHazardFactor = Math.max(nearHazardFactor, 1 - d / (hz.radius * 2.5));
        }
        const wobble = nearHazardFactor * 2 * Math.sin(globalTime * 12 + b.id);
        // Draw baby dino using drawDinoOnCanvas (size 22)
        ctx.save(); ctx.translate(b.x + wobble, b.y); ctx.rotate(wobble * 0.1);
        drawDinoOnCanvas(ctx, b.dino, 0, -4, 22, b.color);
        ctx.restore();
        // Scared eyes when near hazard
        if (nearHazardFactor > 0.4) {
          ctx.fillStyle = 'rgba(255,80,80,0.7)'; ctx.font = '8px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('😱', b.x + wobble, b.y - 14);
        }
      });

      // ── Active player indicator (top-left) ────────────────────────────
      const side = getCurrentSide(turn);
      const cp = players.find(p => p.side === side);
      if (cp && !pendingTurn) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.roundRect(8, 8, 100, 36, 8); ctx.fill();
        ctx.strokeStyle = cp.color; ctx.lineWidth = 1.5; ctx.stroke();
        drawDinoOnCanvas(ctx, cp.avatarId, 26, 26, 28, cp.color);
        ctx.fillStyle = 'white'; ctx.font = `bold ${Math.max(9, Math.min(h * 0.022, 11))}px sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(cp.name.slice(0, 7), 46, 26);
      } else if (cp && pendingTurn) {
        // Show success feedback
        ctx.fillStyle = 'rgba(76,175,80,0.7)';
        ctx.beginPath(); ctx.roundRect(8, 8, 100, 36, 8); ctx.fill();
        ctx.fillStyle = 'white'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✓ Saved!', 58, 26);
      }

      // ── Baby count & round HUD (top-right) ────────────────────────────
      const hudW = 140, hudH = 38, hudX = w - hudW - 8, hudY = 8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.roundRect(hudX, hudY, hudW, hudH, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#FFD700'; ctx.font = `bold ${Math.max(11, Math.min(h * 0.028, 14))}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`🥚 ${totalRescued}/${rescueGoal}  Round ${round + 1}/${maxRounds}`, hudX + hudW / 2, hudY + hudH / 2);

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
