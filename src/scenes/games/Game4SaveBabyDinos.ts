import type { GameInstance, GameConfig, PlayerInGame, Particle } from './types';
import { buildResults, createParticle, updateParticles, renderParticles } from './types';
import type { Side } from '../../engine/utils';
import { lerp, randRange } from '../../engine/utils';
import { createTurnState, getCurrentSide, advanceTurn, type TurnState } from '../../engine/turnManager';
import { drawDinoOnCanvas } from '../../engine/assets';
import { audioManager } from '../../engine/audioManager';

// ─────────────────────────────────────────────────────────────────────────────
// Game 4 — Baby Dino Spotlight Rescue
//
// A spotlight beam sweeps around a ring of baby dinos.
// Each baby has a danger bar that fills over time — reaching 1 = captured.
// TAP when the beam touches a baby → rescue it (flies to the Safe Home).
// HOLD 0.7s → slow the beam to 28% speed for 2.5 s (once per turn).
// Turn timer: 7 s — if you don't rescue in time, turn passes.
// One random baby is "golden" (👑) and worth 2 pts.
// Spotlight speed increases each round.
// ─────────────────────────────────────────────────────────────────────────────

const BABY_COLORS = ['#FF8A65','#FFB74D','#AED581','#80CBC4','#CE93D8','#F48FB1','#90CAF9','#FFCC80'];
const BG_THEMES: Record<string, string> = { jungle: '#071a07', desert: '#1a0e04', iceage: '#060c1a' };
const TURN_DURATION = 7;

interface BabyDino {
  id: number;
  slotAngle: number;   // fixed position on ring (radians)
  x: number; y: number;
  dangerRate: number;  // fraction per second
  danger: number;      // 0 → 1; reaches 1 = captured
  rescued: boolean;
  lost: boolean;
  dino: number;
  color: string;
  golden: boolean;     // worth 2 pts, shows crown
  rescueFly: number;   // -1 = idle; 0→1 = flying animation
  lostTimer: number;   // counts down from 1.5 (fade-out)
}

type Phase = 'play' | 'finished';

export function createGame4(): GameInstance {
  let players: PlayerInGame[] = [];
  let turn: TurnState;
  let babies: BabyDino[] = [];
  let phase: Phase = 'play';
  let particles: Particle[] = [];
  let turnMessage = '';
  let stats = new Map<string, Record<string, number>>();
  let round = 0, maxRounds = 14, rescueGoal = 7;
  let totalRescued = 0, totalLost = 0;
  let pendingTurn = false, pendingTurnTimer = 0;
  let globalTime = 0, finishDelay = 0;
  let kidMode = false, boardTheme = 'jungle';
  let gW = 0, gH = 0, acted = false, turnTimeLeft = TURN_DURATION;

  // Spotlight state
  let spotAngle = -Math.PI / 2;
  let spotSpeed = 1.0;     // rad/s — increases each round
  let slowMoTimer = 0;     // seconds of slowed beam remaining
  let slowMoCooldown = 0;  // > 0 → can't slow again this turn

  // Layout (computed in setupLayout)
  let ringR = 0, cx = 0, cy = 0, safeR = 0;

  function setupLayout(w: number, h: number) {
    gW = w; gH = h;
    cx = w / 2; cy = h / 2;
    ringR = Math.min(w, h) * 0.33;
    safeR = Math.min(w, h) * 0.12;
  }

  function spawnBabies(n: number) {
    babies = [];
    const goldenSlot = Math.floor(Math.random() * n);
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
      babies.push({
        id: i, slotAngle: angle,
        x: cx + Math.cos(angle) * ringR,
        y: cy + Math.sin(angle) * ringR,
        dangerRate: (kidMode ? 0.026 : 0.048) * randRange(0.55, 1.45),
        danger: randRange(0, 0.12),
        rescued: false, lost: false,
        dino: i % 8, color: BABY_COLORS[i % BABY_COLORS.length],
        golden: i === goldenSlot,
        rescueFly: -1, lostTimer: -1,
      });
    }
  }

  // Return the baby currently under the spotlight (within ±~22°), or null
  function getSpotlitBaby(): BabyDino | null {
    let best: BabyDino | null = null, bestGap = Infinity;
    for (const b of babies) {
      if (b.rescued || b.lost) continue;
      let gap = Math.abs(b.slotAngle - spotAngle) % (Math.PI * 2);
      if (gap > Math.PI) gap = Math.PI * 2 - gap;
      if (gap < bestGap) { bestGap = gap; best = b; }
    }
    return best && bestGap < 0.38 ? best : null;
  }

  function checkFinished(): boolean {
    const alive = babies.filter(b => !b.rescued && !b.lost).length;
    if (totalRescued >= rescueGoal || alive === 0 || round >= maxRounds) {
      phase = 'finished'; finishDelay = 2.5;
      const won = totalRescued >= rescueGoal;
      turnMessage = won ? '🎉 Team wins! Amazing rescue!' : `Only saved ${totalRescued}/${rescueGoal}…`;
      audioManager.play(won ? 'win' : 'lose');
      return true;
    }
    return false;
  }

  function doRescue(b: BabyDino) {
    const side = getCurrentSide(turn);
    const cp = players.find(p => p.side === side)!;
    b.rescued = true; b.rescueFly = 0;
    totalRescued++;
    const pts = b.golden ? 2 : 1;
    cp.score += pts;
    stats.get(cp.id)!.rescues++;
    audioManager.play('rescue');
    const count = b.golden ? 14 : 8;
    for (let i = 0; i < count; i++)
      particles.push(createParticle(b.x, b.y, b.golden ? '#FFD700' : '#4CAF50'));
    turnMessage = b.golden ? `⭐ Golden baby! +2 pts!` : `Baby rescued! 🥚 ${totalRescued}/${rescueGoal}`;
    acted = true; pendingTurn = true; pendingTurnTimer = 1.0;
  }

  return {
    init(cfg, w, h) {
      players = cfg.players; kidMode = cfg.kidMode; boardTheme = cfg.boardTheme;
      maxRounds = kidMode ? 18 : 14;
      rescueGoal = kidMode ? 5 : 7;
      turn = createTurnState(players.map(p => p.side), cfg.turnDirection);
      setupLayout(w, h);
      spawnBabies(kidMode ? 6 : 8);
      players.forEach(p => { p.score = 0; stats.set(p.id, { rescues: 0 }); });
      round = 0; totalRescued = 0; totalLost = 0; phase = 'play'; acted = false;
      pendingTurn = false; globalTime = 0;
      spotAngle = -Math.PI / 2; spotSpeed = 1.0;
      slowMoTimer = 0; slowMoCooldown = 0; turnTimeLeft = TURN_DURATION;
      turnMessage = '🔦 Tap when the beam hits a baby!';
    },

    update(dt, inputs) {
      globalTime += dt;
      particles = updateParticles(particles, dt);
      if (phase === 'finished') { finishDelay -= dt; return; }

      // Animate fly-to-center and lost fade
      for (const b of babies) {
        if (b.rescueFly >= 0 && b.rescueFly < 1) b.rescueFly = Math.min(1, b.rescueFly + dt * 1.4);
        if (b.lostTimer > 0) b.lostTimer -= dt;
      }

      // Danger always fills (even during pending turn)
      for (const b of babies) {
        if (b.rescued || b.lost) continue;
        b.danger = Math.min(1, b.danger + b.dangerRate * dt);
        if (b.danger >= 1) {
          b.lost = true; b.lostTimer = 1.5; totalLost++;
          audioManager.play('oops');
          for (let i = 0; i < 7; i++) particles.push(createParticle(b.x, b.y, '#FF4444'));
          if (checkFinished()) return;
        }
      }

      if (slowMoCooldown > 0) slowMoCooldown -= dt;
      if (slowMoTimer > 0) slowMoTimer -= dt;

      // Advance spotlight
      const eff = slowMoTimer > 0 ? spotSpeed * 0.28 : spotSpeed;
      spotAngle += eff * dt;
      if (spotAngle > Math.PI) spotAngle -= Math.PI * 2;

      if (pendingTurn) {
        pendingTurnTimer -= dt;
        if (pendingTurnTimer <= 0) {
          pendingTurn = false; round++;
          if (!checkFinished()) {
            turn = advanceTurn(turn); acted = false;
            slowMoTimer = 0; slowMoCooldown = 0;
            spotSpeed = Math.min(2.4, 1.0 + round * 0.1);
            turnTimeLeft = TURN_DURATION;
            turnMessage = '🔦 Tap when the beam hits a baby!';
          }
        }
        return;
      }

      // Turn timer
      if (!acted) {
        turnTimeLeft -= dt;
        if (turnTimeLeft <= 0) {
          turnMessage = '⏱️ Too slow! Danger grows!';
          acted = true; pendingTurn = true; pendingTurnTimer = 1.0;
        }
      }

      const side = getCurrentSide(turn);
      const input = inputs.get(side);
      if (!input || acted) return;

      // HOLD: slow beam (once per turn)
      if (input.holdTime > 0.7 && slowMoCooldown <= 0) {
        slowMoTimer = 2.5; slowMoCooldown = 999;
        audioManager.play('shield');
        turnMessage = '🐢 Beam slowing!';
      }

      // TAP: rescue spotlit baby
      if (input.justPressed) {
        const lit = getSpotlitBaby();
        if (lit) {
          doRescue(lit);
        } else {
          audioManager.play('oops');
          turnMessage = '❌ Miss! Wait for the beam!';
        }
      }
    },

    render(ctx, w, h) {
      const fs = Math.min(w, h);

      // ── Background ──────────────────────────────────────────────────────
      ctx.fillStyle = BG_THEMES[boardTheme] || BG_THEMES.jungle;
      ctx.fillRect(0, 0, w, h);

      // Ambient deco
      const decos = boardTheme === 'iceage' ? ['❄️','⛄','🌨️','❄️','🌟','❄️']
                  : boardTheme === 'desert'  ? ['🌵','🌟','🏜️','🌵','⭐','🌵']
                                             : ['🌿','🌟','🌱','🌿','⭐','🌱'];
      ctx.font = `${fs * 0.032}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [[0.06,0.1],[0.91,0.08],[0.04,0.9],[0.93,0.88],[0.5,0.04],[0.5,0.97]].forEach(([x,y],i) => {
        ctx.globalAlpha = 0.12 + 0.07 * Math.sin(globalTime * 0.5 + i);
        ctx.fillText(decos[i], w*x, h*y);
      });
      ctx.globalAlpha = 1;

      // ── Ring guide ──────────────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1.5; ctx.setLineDash([6, 10]);
      ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      // ── Spotlight beam ──────────────────────────────────────────────────
      const litBaby = getSpotlitBaby();
      const beamHalf = 0.33;
      const beamLen = ringR * 1.18;

      ctx.save();
      // Outer soft glow
      ctx.globalAlpha = litBaby ? 0.10 : 0.05;
      ctx.fillStyle = '#FFFFC0';
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, beamLen, spotAngle - beamHalf * 1.7, spotAngle + beamHalf * 1.7);
      ctx.closePath(); ctx.fill();
      // Inner bright beam wedge
      ctx.globalAlpha = litBaby ? 0.30 : 0.14;
      ctx.fillStyle = '#FFFF88';
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, beamLen, spotAngle - beamHalf, spotAngle + beamHalf);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // Center beam ray line
      ctx.save();
      ctx.strokeStyle = litBaby ? 'rgba(255,255,160,0.55)' : 'rgba(255,255,160,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(spotAngle) * beamLen, cy + Math.sin(spotAngle) * beamLen);
      ctx.stroke(); ctx.restore();

      // Flashlight nub at center edge
      const srcX = cx + Math.cos(spotAngle) * (safeR + 4);
      const srcY = cy + Math.sin(spotAngle) * (safeR + 4);
      ctx.save();
      ctx.fillStyle = litBaby ? 'rgba(255,255,200,0.88)' : 'rgba(255,255,200,0.38)';
      ctx.shadowColor = '#FFFF80'; ctx.shadowBlur = litBaby ? 14 : 4;
      ctx.beginPath(); ctx.arc(srcX, srcY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore();

      // ── Safe zone (center) ──────────────────────────────────────────────
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, safeR);
      sg.addColorStop(0, 'rgba(70,200,70,0.55)');
      sg.addColorStop(0.65, 'rgba(30,140,30,0.28)');
      sg.addColorStop(1, 'rgba(10,60,10,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(cx, cy, safeR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(90,230,90,${0.4 + 0.25 * Math.sin(globalTime * 2)})`;
      ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(cx, cy, safeR * 0.82, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(160,255,160,0.92)';
      ctx.font = `${fs * 0.042}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🏠', cx, cy - fs * 0.015);
      ctx.font = `bold ${fs * 0.022}px sans-serif`;
      ctx.fillStyle = 'rgba(180,255,180,0.85)';
      ctx.fillText('SAFE', cx, cy + fs * 0.024);

      // Rescued baby icons orbiting inside safe zone
      const rescuedDone = babies.filter(b => b.rescued && b.rescueFly >= 1);
      rescuedDone.forEach((b, i) => {
        const a = (i / Math.max(rescuedDone.length, 1)) * Math.PI * 2 - Math.PI / 2 + globalTime * 0.35;
        const iconR = safeR * 0.52;
        ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.golden ? '⭐' : '✅', cx + Math.cos(a) * iconR, cy + Math.sin(a) * iconR);
      });

      // Turn timer arc around safe zone edge
      if (!pendingTurn && !acted) {
        const tFrac = Math.max(0, turnTimeLeft / TURN_DURATION);
        ctx.strokeStyle = tFrac > 0.45 ? 'rgba(100,220,100,0.78)'
                        : tFrac > 0.22  ? 'rgba(255,185,0,0.88)'
                                        : 'rgba(255,55,55,0.95)';
        ctx.lineWidth = 4.5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, safeR + 10, -Math.PI / 2, -Math.PI / 2 + tFrac * Math.PI * 2);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }

      // ── Babies ──────────────────────────────────────────────────────────
      babies.forEach(b => {
        // Lost fade-out
        if (b.lost) {
          if (b.lostTimer > 0) {
            ctx.globalAlpha = Math.min(1, b.lostTimer / 0.6);
            ctx.font = `${fs * 0.048}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('💔', b.x, b.y);
            ctx.globalAlpha = 1;
          }
          return;
        }

        // Fly-to-center rescue animation
        if (b.rescued) {
          if (b.rescueFly >= 0 && b.rescueFly < 1) {
            const t = b.rescueFly;
            ctx.globalAlpha = Math.max(0, 1 - t * 0.85);
            ctx.save(); ctx.translate(lerp(b.x, cx, t), lerp(b.y, cy, t));
            drawDinoOnCanvas(ctx, b.dino, 0, -4, 26, b.golden ? '#FFD700' : b.color);
            ctx.restore(); ctx.globalAlpha = 1;
          }
          return;
        }

        const bx = b.x, by = b.y;
        const isLit = litBaby?.id === b.id;

        // Danger glow (grows and reddens as danger → 1)
        if (b.danger > 0.15) {
          const da = (b.danger - 0.15) / 0.85;
          const dr = 18 + b.danger * 16;
          const pulse = b.danger > 0.65 ? 1 + 0.18 * Math.sin(globalTime * 9 + b.id) : 1;
          ctx.fillStyle = b.danger > 0.65
            ? `rgba(255,50,50,${da * 0.72})`
            : `rgba(255,150,40,${da * 0.52})`;
          ctx.beginPath(); ctx.arc(bx, by, dr * pulse, 0, Math.PI * 2); ctx.fill();
        }

        // Spotlight highlight ring + TAP prompt
        if (isLit) {
          const ringAlpha = 0.55 + 0.45 * Math.abs(Math.sin(globalTime * 8));
          ctx.strokeStyle = `rgba(255,255,70,${ringAlpha})`;
          ctx.lineWidth = 3.5; ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(bx, by, 30, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#FFE030';
          ctx.font = `bold ${fs * 0.027}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 5;
          ctx.fillText('TAP! 👆', bx, by - 32);
          ctx.shadowBlur = 0;
        }

        // Danger bar (above baby)
        const bw = 36, bh = 5, bxbar = bx - bw / 2, bybar = by - 33;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bxbar, bybar, bw, bh);
        ctx.fillStyle = b.danger < 0.4 ? '#66BB6A' : b.danger < 0.7 ? '#FFA726' : '#EF5350';
        ctx.fillRect(bxbar, bybar, bw * b.danger, bh);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
        ctx.strokeRect(bxbar, bybar, bw, bh);

        // Baby dino sprite (wobbles when endangered)
        const wobble = b.danger > 0.55 ? 2.5 * Math.sin(globalTime * 10 + b.id) : 0;
        ctx.save(); ctx.translate(bx + wobble, by);
        drawDinoOnCanvas(ctx, b.dino, 0, -4, 26, b.golden ? '#FFD700' : b.color);
        ctx.restore();

        // Golden crown
        if (b.golden) {
          ctx.font = `${fs * 0.024}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText('👑', bx, by - 40);
        }

        // Scared face when very endangered
        if (b.danger > 0.72) {
          const face = Math.floor(globalTime * 5) % 2 === 0 ? '😱' : '😨';
          ctx.font = `${fs * 0.026}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(face, bx, by - (b.golden ? 58 : 44));
        }
      });

      // ── Slow-beam active indicator ───────────────────────────────────────
      if (slowMoTimer > 0) {
        ctx.fillStyle = 'rgba(80,200,255,0.92)';
        ctx.font = `bold ${fs * 0.028}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6;
        ctx.fillText('🐢  SLOW BEAM!', cx, cy + safeR + 28);
        ctx.shadowBlur = 0;
      }

      // ── Player indicator ─────────────────────────────────────────────────
      const side = getCurrentSide(turn);
      const cp = players.find(p => p.side === side);
      if (cp) {
        ctx.fillStyle = pendingTurn ? 'rgba(55,160,55,0.88)' : 'rgba(0,0,0,0.65)';
        ctx.beginPath(); ctx.roundRect(8, 8, 116, 42, 8); ctx.fill();
        if (!pendingTurn) {
          ctx.strokeStyle = cp.color; ctx.lineWidth = 1.5; ctx.stroke();
          drawDinoOnCanvas(ctx, cp.avatarId, 30, 29, 30, cp.color);
          ctx.fillStyle = 'white'; ctx.font = `bold ${Math.max(10, fs * 0.022)}px sans-serif`;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(cp.name.slice(0, 8), 52, 29);
        } else {
          ctx.fillStyle = 'white'; ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('✓ Rescued!', 62, 29);
        }
      }

      // ── Progress HUD (top-right) ─────────────────────────────────────────
      const hudW = 152, hudH = 40, hudX = w - hudW - 8, hudY = 8;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath(); ctx.roundRect(hudX, hudY, hudW, hudH, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#FFD700'; ctx.font = `bold ${Math.max(11, fs * 0.026)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`🥚 ${totalRescued}/${rescueGoal}  Rd ${round + 1}/${maxRounds}`, hudX + hudW / 2, hudY + hudH / 2);

      // HOLD hint at bottom (only when available)
      if (slowMoCooldown <= 0 && !pendingTurn && !acted) {
        ctx.fillStyle = 'rgba(140,215,255,0.65)';
        ctx.font = `${fs * 0.022}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('HOLD = slow beam  🐢', cx, h - 10);
      }

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