import type { GameInstance, GameConfig, PlayerInGame, ButtonInput, Particle } from './types';
import { buildResults, createParticle, updateParticles, renderParticles } from './types';
import type { Side } from '../../engine/utils';
import { randInt } from '../../engine/utils';
import { createTurnState, getCurrentSide, advanceTurn, type TurnState } from '../../engine/turnManager';
import { drawDinoOnCanvas } from '../../engine/assets';
import { audioManager } from '../../engine/audioManager';

const TRACK_LEN = 30;
interface TrackTile { x: number; y: number; type: 'normal' | 'eggBonus' | 'pteraLift' | 'lavaRock'; }
type Phase = 'waitTap' | 'rolling' | 'moving' | 'event' | 'skipTurn' | 'finished';

export function createGame3(): GameInstance {
  let players: PlayerInGame[] = [];
  let turn: TurnState;
  let track: TrackTile[] = [];
  let positions = new Map<string, number>();
  let phase: Phase = 'waitTap';
  let diceValue = 0, diceAnimTimer = 0, diceDisplay = 1;
  let moveStepsLeft = 0, moveTimer = 0, currentMovingId = '';
  let particles: Particle[] = [];
  let turnMessage = '';
  let stats = new Map<string, Record<string, number>>();
  let winner: string | null = null;
  let finishDelay = 0;
  let globalTime = 0;
  let skipped = new Set<string>();
  let kidMode = false;
  let isRisky = false;
  let eventTimer = 0;

  function buildTrack(w: number, h: number) {
    track = [];
    const m = Math.min(w, h) * 0.1;
    const uw = w - m * 2, uh = h - m * 2;
    for (let i = 0; i < TRACK_LEN; i++) {
      const t = i / (TRACK_LEN - 1);
      let type: TrackTile['type'] = 'normal';
      if (i > 2 && i < TRACK_LEN - 2) {
        const r = Math.random();
        if (r < 0.1) type = 'eggBonus';
        else if (r < 0.18) type = 'pteraLift';
        else if (r < 0.28) type = 'lavaRock';
      }
      track.push({ x: m + t * uw, y: h / 2 + Math.sin(t * Math.PI * 3) * uh * 0.25, type });
    }
  }

  function getTP(idx: number) { return track[Math.max(0, Math.min(TRACK_LEN - 1, idx))]; }
  function addStat(pid: string, k: string, v: number) { const s = stats.get(pid) || {}; s[k] = (s[k] || 0) + v; stats.set(pid, s); }

  return {
    init(cfg, w, h) {
      players = cfg.players; kidMode = cfg.kidMode;
      turn = createTurnState(players.map(p => p.side), cfg.turnDirection);
      buildTrack(w, h); positions = new Map(); skipped = new Set();
      players.forEach(p => { positions.set(p.id, 0); stats.set(p.id, { safeRolls: 0, riskyRolls: 0, stumbles: 0, bonuses: 0 }); });
      phase = 'waitTap'; turnMessage = 'TAP = safe, HOLD = risky!'; winner = null;
    },

    update(dt, inputs) {
      globalTime += dt;
      particles = updateParticles(particles, dt);
      if (winner) { finishDelay -= dt; return; }
      const side = getCurrentSide(turn);
      const input = inputs.get(side);
      const cp = players.find(p => p.side === side)!;

      if (phase === 'waitTap' && skipped.has(cp.id)) {
        skipped.delete(cp.id); turnMessage = `${cp.name} skipped!`; phase = 'skipTurn'; eventTimer = 1.0; return;
      }

      switch (phase) {
        case 'skipTurn':
          eventTimer -= dt;
          if (eventTimer <= 0) { turn = advanceTurn(turn); phase = 'waitTap'; turnMessage = 'TAP = safe, HOLD = risky!'; }
          break;
        case 'waitTap':
          if (input?.justPressed) { isRisky = false; phase = 'rolling'; diceAnimTimer = 0.6; audioManager.play('tap'); }
          else if (input && input.holdTime > 0.6) { isRisky = true; phase = 'rolling'; diceAnimTimer = 0.6; audioManager.play('burst'); turnMessage = 'RISKY ROLL! 🔥'; }
          break;
        case 'rolling':
          diceAnimTimer -= dt; diceDisplay = randInt(1, 6);
          if (diceAnimTimer <= 0) {
            diceValue = randInt(1, 6);
            if (isRisky) {
              const bonus = randInt(1, 3);
              const stumble = Math.random() < 0.35;
              addStat(cp.id, 'riskyRolls', 1);
              if (stumble && !kidMode) {
                diceValue = Math.max(0, diceValue - 2); turnMessage = `Stumble! Only ${diceValue}`;
                addStat(cp.id, 'stumbles', 1); audioManager.play('oops');
                if (Math.random() < 0.3) { skipped.add(cp.id); turnMessage += ' + skip next!'; }
              } else { diceValue += bonus; turnMessage = `Risky win! +${bonus} = ${diceValue}!`; audioManager.play('powerup'); }
            } else { addStat(cp.id, 'safeRolls', 1); turnMessage = `Rolled ${diceValue}!`; audioManager.play('powerup'); }
            diceDisplay = diceValue; currentMovingId = cp.id; moveStepsLeft = diceValue; moveTimer = 0; phase = 'moving';
          }
          break;
        case 'moving':
          moveTimer -= dt;
          if (moveTimer <= 0 && moveStepsLeft > 0) {
            const pos = Math.min((positions.get(currentMovingId) || 0) + 1, TRACK_LEN - 1);
            positions.set(currentMovingId, pos); moveStepsLeft--; moveTimer = 0.15; audioManager.play('tap');
            if (pos >= TRACK_LEN - 1) moveStepsLeft = 0;
          }
          if (moveStepsLeft <= 0 && moveTimer <= 0) { phase = 'event'; eventTimer = 0; }
          break;
        case 'event': {
          const pos = positions.get(currentMovingId) || 0;
          if (pos >= TRACK_LEN - 1) {
            winner = currentMovingId; cp.score = 100; audioManager.play('win');
            const wp = getTP(pos); for (let i = 0; i < 20; i++) particles.push(createParticle(wp.x, wp.y, cp.color));
            turnMessage = `${cp.name} WINS! 🏆`; phase = 'finished'; finishDelay = 2; break;
          }
          const tile = track[pos]; const tp = getTP(pos);
          if (tile) {
            switch (tile.type) {
              case 'eggBonus': {
                const b = randInt(2, 3); positions.set(currentMovingId, Math.min(pos + b, TRACK_LEN - 1));
                addStat(cp.id, 'bonuses', 1); audioManager.play('rescue'); turnMessage = `Egg bonus! +${b}! 🥚`;
                for (let i = 0; i < 8; i++) particles.push(createParticle(tp.x, tp.y, '#FFD700')); tile.type = 'normal'; break;
              }
              case 'pteraLift': {
                const l = randInt(3, 5); positions.set(currentMovingId, Math.min(pos + l, TRACK_LEN - 1));
                addStat(cp.id, 'bonuses', 1); audioManager.play('jump'); turnMessage = `Pterodactyl lift! +${l}! 🐉`;
                for (let i = 0; i < 10; i++) particles.push(createParticle(tp.x, tp.y, '#26C6DA')); tile.type = 'normal'; break;
              }
              case 'lavaRock':
                if (!kidMode) {
                  const pen = randInt(1, 2); positions.set(currentMovingId, Math.max(0, pos - pen));
                  audioManager.play('oops'); turnMessage = `Lava rock! -${pen}! 🌋`;
                  for (let i = 0; i < 8; i++) particles.push(createParticle(tp.x, tp.y, '#FF4444'));
                }
                tile.type = 'normal'; break;
            }
          }
          turn = advanceTurn(turn); phase = 'waitTap';
          setTimeout(() => { turnMessage = 'TAP = safe, HOLD = risky!'; }, 800);
          break;
        }
      }
    },

    render(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#1a0a0a'); g.addColorStop(0.5, '#3a1a0a'); g.addColorStop(1, '#5a2a0a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,200,100,0.3)'; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); track.forEach((t, i) => i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y)); ctx.stroke();
      track.forEach((t, i) => {
        let tc = '#4a3a2a', em = '';
        if (t.type === 'eggBonus') { tc = '#8B7355'; em = '🥚'; }
        else if (t.type === 'pteraLift') { tc = '#2a6a7a'; em = '🐉'; }
        else if (t.type === 'lavaRock') { tc = '#8a2a0a'; em = '🌋'; }
        ctx.fillStyle = tc; ctx.beginPath(); ctx.arc(t.x, t.y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,100,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
        if (em) { ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(em, t.x, t.y); }
        if (i === 0) { ctx.fillStyle = '#FFD700'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('START', t.x, t.y + 22); }
        if (i === TRACK_LEN - 1) { ctx.fillStyle = '#FFD700'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('FINISH', t.x, t.y + 22); }
      });
      players.forEach((p, i) => {
        const pos = positions.get(p.id) || 0; const tp = getTP(pos);
        drawDinoOnCanvas(ctx, p.avatarId, tp.x, tp.y - 20 + i * 6, 28, p.color);
      });
      const dx = w - 60, dy = h / 2, ds = 44;
      const rolling3 = phase === 'rolling';
      const wobble3 = rolling3 ? Math.sin(globalTime * 20) * 0.12 : 0;
      const isOrange = isRisky;
      const pipColor = isOrange ? '#fff' : '#1a1a1a';

      ctx.save(); ctx.translate(dx, dy);
      if (rolling3) ctx.rotate(wobble3);

      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;

      // Main face with radial gradient
      const fg3 = ctx.createRadialGradient(-ds * 0.2, -ds * 0.2, 0, 0, 0, ds * 0.8);
      if (isOrange) { fg3.addColorStop(0, '#FF8B55'); fg3.addColorStop(1, '#CC4400'); }
      else { fg3.addColorStop(0, '#ffffff'); fg3.addColorStop(1, '#dcdcdc'); }
      ctx.fillStyle = fg3;
      ctx.beginPath(); ctx.roundRect(-ds / 2, -ds / 2, ds, ds, 6); ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      // Border
      ctx.strokeStyle = isOrange ? '#993300' : '#aaa'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(-ds / 2, -ds / 2, ds, ds, 6); ctx.stroke();
      // Inner bevel
      ctx.strokeStyle = isOrange ? 'rgba(255,200,150,0.4)' : 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(-ds / 2 + 2, -ds / 2 + 2, ds - 4, ds - 4, 4); ctx.stroke();

      // Pips
      if (phase === 'rolling' || diceValue > 0) {
        const v3 = diceDisplay, pr3 = ds * 0.075, off3 = ds * 0.26;
        const pip3 = (px: number, py: number) => {
          ctx.fillStyle = pipColor;
          ctx.beginPath(); ctx.arc(px, py, pr3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = isOrange ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)';
          ctx.beginPath(); ctx.arc(px - pr3 * 0.3, py - pr3 * 0.3, pr3 * 0.35, 0, Math.PI * 2); ctx.fill();
        };
        if (v3 === 1 || v3 === 3 || v3 === 5) pip3(0, 0);
        if (v3 >= 2) { pip3(-off3, -off3); pip3(off3, off3); }
        if (v3 >= 4) { pip3(off3, -off3); pip3(-off3, off3); }
        if (v3 === 6) { pip3(-off3, 0); pip3(off3, 0); }
      }
      ctx.restore();
      renderParticles(ctx, particles);
    },

    getCurrentTurnSide() { return getCurrentSide(turn); },
    getTurnMessage() { return turnMessage; },
    getPlayerStates() { return players.map(p => ({ ...p, score: positions.get(p.id) || 0 })); },
    isFinished() { return winner !== null && finishDelay <= 0; },
    getResults() { players.forEach(p => { p.score = positions.get(p.id) || 0; }); return buildResults(2, false, players, stats); },
    cleanup() {},
  };
}
