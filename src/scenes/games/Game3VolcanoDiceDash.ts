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

interface ThemePalette3 {
  bgA: string; bgB: string;
  trackFill: string; trackEdge: string;
  tileDark: string; tileLight: string;
  startGlow: string; finishGlow: string;
}

const THEMES3: Record<string, ThemePalette3> = {
  jungle: {
    bgA: '#0c2e0c', bgB: '#1a4e1a',
    trackFill: '#5a3a1a', trackEdge: '#3a2010',
    tileDark: '#2d5a1d', tileLight: '#3a8030',
    startGlow: '#4CAF50', finishGlow: '#FFD700',
  },
  desert: {
    bgA: '#6a3e06', bgB: '#a86010',
    trackFill: '#c8a040', trackEdge: '#8c6010',
    tileDark: '#7a5010', tileLight: '#b07828',
    startGlow: '#FFD700', finishGlow: '#FF9800',
  },
  iceage: {
    bgA: '#081828', bgB: '#122a48',
    trackFill: '#3a7aaa', trackEdge: '#1e4e78',
    tileDark: '#1e3a5a', tileLight: '#2e5a8a',
    startGlow: '#80DEEA', finishGlow: '#E1F5FE',
  },
};

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
  let boardTheme = 'jungle';
  let lastW = 0, lastH = 0;
  let diceSettleTimer = 0;
  type FloatNum = { x: number; y: number; text: string; color: string; life: number; maxLife: number };
  let floatNums: FloatNum[] = [];

  function buildTrack(w: number, h: number) {
    lastW = w; lastH = h;
    const m = Math.min(w, h) * 0.10;
    const uw = w - m * 2, uh = h - m * 2;
    const oldTypes = track.map(t => t.type);
    track = [];
    for (let i = 0; i < TRACK_LEN; i++) {
      const t = i / (TRACK_LEN - 1);
      let type: TrackTile['type'] = 'normal';
      if (oldTypes[i]) { type = oldTypes[i]; }
      else if (i > 2 && i < TRACK_LEN - 2) {
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
      players = cfg.players; kidMode = cfg.kidMode; boardTheme = cfg.boardTheme;
      turn = createTurnState(players.map(p => p.side), cfg.turnDirection);
      track = []; // force full rebuild with fresh random types
      buildTrack(w, h); positions = new Map(); skipped = new Set();
      players.forEach(p => { positions.set(p.id, 0); stats.set(p.id, { safeRolls: 0, riskyRolls: 0, stumbles: 0, bonuses: 0 }); });
      phase = 'waitTap'; turnMessage = 'TAP = safe · HOLD = risky!'; winner = null; globalTime = 0; floatNums = [];
    },

    update(dt, inputs) {
      globalTime += dt;
      particles = updateParticles(particles, dt);
      if (diceSettleTimer > 0) diceSettleTimer = Math.max(0, diceSettleTimer - dt);
      floatNums = floatNums.filter(fn => { fn.life -= dt; return fn.life > 0; });
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
          if (input?.justPressed) { isRisky = false; phase = 'rolling'; diceAnimTimer = 1.2; audioManager.play('tap'); }
          else if (input && input.holdTime > 0.6) { isRisky = true; phase = 'rolling'; diceAnimTimer = 1.2; audioManager.play('burst'); turnMessage = 'RISKY ROLL! 🔥'; }
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
            diceDisplay = diceValue; currentMovingId = cp.id; moveStepsLeft = diceValue; moveTimer = 0; phase = 'moving'; diceSettleTimer = 0.5;
            floatNums.push({ x: lastW - 58, y: lastH * 0.46, text: `${diceValue}`, color: cp.color, life: 1.1, maxLife: 1.1 });
          }
          break;
        case 'moving':
          moveTimer -= dt;
          if (moveTimer <= 0 && moveStepsLeft > 0) {
            const pos = Math.min((positions.get(currentMovingId) || 0) + 1, TRACK_LEN - 1);
            positions.set(currentMovingId, pos); moveStepsLeft--; moveTimer = 0.22; audioManager.play('tap');
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
                  audioManager.play('oops'); turnMessage = `Obstacle! -${pen}! ⚠️`;
                  for (let i = 0; i < 10; i++) particles.push(createParticle(tp.x, tp.y, '#FF4444'));
                }
                tile.type = 'normal'; break;
            }
          }
          turn = advanceTurn(turn); phase = 'waitTap';
          setTimeout(() => { turnMessage = 'TAP = safe · HOLD = risky!'; }, 900);
          break;
        }
      }
    },

    render(ctx, w, h) {
      if (w !== lastW || h !== lastH) buildTrack(w, h);

      const th = THEMES3[boardTheme] || THEMES3.jungle;

      // ── Background ──────────────────────────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, th.bgA); bgGrad.addColorStop(1, th.bgB);
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, w, h);

      // Decorative background emojis
      const decoSz = Math.min(w, h) * 0.055;
      ctx.font = `${decoSz}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const bgDecos = boardTheme === 'desert' ? ['🌵','🏜️','🌵','🪨','🌵','🏜️']
        : boardTheme === 'iceage' ? ['❄️','🏔️','❄️','🧊','❄️','🏔️']
        : ['🌿','🌴','🌿','🦋','🌱','🌴'];
      const bPos = [
        { x: 0.04, y: 0.13 }, { x: 0.05, y: 0.84 }, { x: 0.36, y: 0.07 },
        { x: 0.36, y: 0.91 }, { x: 0.70, y: 0.09 }, { x: 0.72, y: 0.89 },
      ];
      bPos.forEach(({ x, y }, di) => {
        ctx.globalAlpha = 0.28 + 0.08 * Math.sin(globalTime * 0.7 + di * 0.9);
        ctx.fillText(bgDecos[di % bgDecos.length], w * x, h * y);
      });
      ctx.globalAlpha = 1;

      // ── Track ────────────────────────────────────────────────────────────
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // Shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 42;
      ctx.beginPath(); track.forEach((t, i) => i === 0 ? ctx.moveTo(t.x + 2, t.y + 4) : ctx.lineTo(t.x + 2, t.y + 4)); ctx.stroke();
      // Edge/border
      ctx.strokeStyle = th.trackEdge; ctx.lineWidth = 36;
      ctx.beginPath(); track.forEach((t, i) => i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y)); ctx.stroke();
      // Main fill
      ctx.strokeStyle = th.trackFill; ctx.lineWidth = 28;
      ctx.beginPath(); track.forEach((t, i) => i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y)); ctx.stroke();
      // Center dashes
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.setLineDash([10, 12]);
      ctx.beginPath(); track.forEach((t, i) => i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y)); ctx.stroke(); ctx.setLineDash([]);

      // ── Tiles ─────────────────────────────────────────────────────────────
      track.forEach((t, i) => {
        const isSpecial = t.type !== 'normal';
        const isMile = i % 5 === 0 && i > 0 && i < TRACK_LEN - 1;
        const r = isSpecial ? 17 : isMile ? 15 : 11;
        if (isSpecial) {
          const gc = t.type === 'eggBonus' ? '#FFD700' : t.type === 'pteraLift' ? '#26C6DA' : '#FF5722';
          ctx.shadowColor = gc; ctx.shadowBlur = 7 + 5 * Math.sin(globalTime * 3.5 + i);
        }
        const tileFill = isSpecial
          ? (t.type === 'eggBonus' ? '#7a6030' : t.type === 'pteraLift' ? '#155060' : '#5a1505')
          : isMile ? th.tileLight : th.tileDark;
        ctx.fillStyle = tileFill;
        ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = isSpecial ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)';
        ctx.lineWidth = isSpecial ? 2 : 1; ctx.stroke();
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
        if (!isSpecial && i > 0 && i < TRACK_LEN - 1) {
          ctx.fillStyle = isMile ? 'rgba(255,215,0,0.9)' : 'rgba(255,255,255,0.5)';
          ctx.font = `bold ${isMile ? 9 : 7}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`${i + 1}`, t.x, t.y);
        }
        if (isSpecial) {
          const em = t.type === 'eggBonus' ? '🥚' : t.type === 'pteraLift' ? '🐉' : '⚠️';
          ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(em, t.x, t.y);
        }
        // START marker
        if (i === 0) {
          ctx.shadowColor = th.startGlow; ctx.shadowBlur = 18;
          ctx.fillStyle = th.startGlow;
          ctx.beginPath(); ctx.arc(t.x, t.y, 18, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
          ctx.fillStyle = '#000'; ctx.font = "bold 9px 'Fredoka One', cursive";
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('START', t.x, t.y);
        }
        // FINISH marker
        if (i === TRACK_LEN - 1) {
          const pulse = 1 + 0.08 * Math.sin(globalTime * 4.5);
          ctx.shadowColor = th.finishGlow; ctx.shadowBlur = 20;
          ctx.fillStyle = th.finishGlow;
          ctx.beginPath(); ctx.arc(t.x, t.y, 20 * pulse, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
          ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('🏆', t.x, t.y);
          ctx.fillStyle = th.finishGlow;
          ctx.font = `bold ${Math.max(10, Math.min(h * 0.025, 14))}px 'Fredoka One', cursive`;
          ctx.textBaseline = 'top'; ctx.fillText('FINISH', t.x, t.y + 22);
        }
      });

      // ── Players ───────────────────────────────────────────────────────────
      players.forEach((p, i) => {
        const pos = positions.get(p.id) || 0;
        const tp = getTP(pos);
        const xOff = (i - (players.length - 1) / 2) * 26;
        const yOff = -36; const av = 32;
        // Connector
        ctx.strokeStyle = p.color + '66'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(tp.x + xOff, tp.y + yOff + av / 2); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        ctx.setLineDash([]);
        // Avatar
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
        drawDinoOnCanvas(ctx, p.avatarId, tp.x + xOff, tp.y + yOff, av, p.color);
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent';
        // Name tag
        const label = p.name.length > 7 ? p.name.slice(0, 6) + '…' : p.name;
        const fs = Math.max(9, Math.min(h * 0.022, 12));
        ctx.font = `bold ${fs}px sans-serif`;
        const tw2 = ctx.measureText(label).width;
        const tagX = tp.x + xOff, tagY = tp.y + yOff + av / 2 + 3;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.beginPath(); ctx.roundRect(tagX - tw2 / 2 - 5, tagY, tw2 + 10, fs + 6, 4); ctx.fill();
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(label, tagX, tagY + 2);
      });

      // ── Progress bar (bottom) ─────────────────────────────────────────────
      const pbY = h - 20, pbX1 = 26, pbX2 = w - 92;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.roundRect(pbX1 - 18, pbY - 7, pbX2 - pbX1 + 60, 20, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pbX1, pbY + 3); ctx.lineTo(pbX2, pbY + 3); ctx.stroke();
      for (let mi = 0; mi < TRACK_LEN; mi += 5) {
        const mx = pbX1 + (pbX2 - pbX1) * (mi / (TRACK_LEN - 1));
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx, pbY - 1); ctx.lineTo(mx, pbY + 7); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '7px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('GO', pbX1 - 9, pbY + 3); ctx.fillText('🏆', pbX2 + 11, pbY + 3);
      players.forEach((p, i) => {
        const pos = positions.get(p.id) || 0;
        const pct = pos / (TRACK_LEN - 1);
        const px = pbX1 + (pbX2 - pbX1) * pct + (i - (players.length - 1) / 2) * 5;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(px, pbY + 3, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
      });

      // ── Enhanced Dice (2D) ──────────────────────────────────────────────
      const dx = w - 58, dy = h * 0.46, ds = 48;
      const rolling3 = phase === 'rolling';
      const rp3 = rolling3 ? Math.max(0, 1 - diceAnimTimer / 1.2) : 1;
      const set3 = diceSettleTimer > 0 ? (0.5 - diceSettleTimer) / 0.5 : 1;
      const bounce3 = diceSettleTimer > 0 ? 1 + 0.22 * Math.sin(Math.PI * set3) : 1;
      const flip3 = rolling3 ? 14 + (1 - rp3) * 10 : 0;
      const amp3 = rolling3 ? (1 - rp3 * 0.65) : 0;
      const sq3 = rolling3 ? (Math.abs(Math.cos(globalTime * flip3)) * amp3 + (1 - amp3)) : 1;
      const rot3 = rolling3 ? Math.sin(globalTime * flip3 * 0.7) * 0.3 * amp3 : 0;
      const isOrange = isRisky;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.scale(bounce3, bounce3);
      // Motion trail
      if (rolling3 && rp3 < 0.55) {
        const tf = (0.55 - rp3) / 0.55;
        for (let ti = 1; ti <= 2; ti++) {
          const ang = globalTime * flip3 * 0.65 - ti * 0.5;
          ctx.save();
          ctx.globalAlpha = tf * 0.18 / ti;
          ctx.translate(Math.cos(ang) * 9 * ti, Math.sin(ang * 0.55) * 5 * ti);
          ctx.scale(sq3 * 0.85, 0.88);
          ctx.fillStyle = isOrange ? '#cc7750' : '#d0d0d0';
          ctx.beginPath(); ctx.roundRect(-ds / 2, -ds / 2, ds, ds, 7); ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      ctx.scale(sq3, 1);
      ctx.rotate(rot3);
      // Glow
      if (rolling3) {
        const gc = rp3 > 0.65 ? (isOrange ? '#FF6600' : '#FFD700') : (isOrange ? '#FF9944' : '#80B0FF');
        ctx.shadowColor = gc; ctx.shadowBlur = 18 + 7 * Math.sin(globalTime * 10);
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      } else if (diceSettleTimer > 0) {
        const ga3 = diceSettleTimer / 0.5;
        ctx.shadowColor = `rgba(255,215,0,${ga3})`; ctx.shadowBlur = 22 * ga3;
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
      }
      // Face gradient
      const fg3 = ctx.createRadialGradient(-ds * 0.2, -ds * 0.2, 0, 0, 0, ds * 0.8);
      if (isOrange) {
        if (rolling3 && rp3 > 0.65) { fg3.addColorStop(0, '#FFCC88'); fg3.addColorStop(1, '#BB4400'); }
        else { fg3.addColorStop(0, '#FF8B55'); fg3.addColorStop(1, '#CC4400'); }
      } else {
        if (rolling3 && rp3 > 0.65) { fg3.addColorStop(0, '#fff8e1'); fg3.addColorStop(1, '#ffe082'); }
        else { fg3.addColorStop(0, '#ffffff'); fg3.addColorStop(1, '#dcdcdc'); }
      }
      ctx.fillStyle = fg3;
      ctx.beginPath(); ctx.roundRect(-ds / 2, -ds / 2, ds, ds, 7); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      // Border — golden on settle
      const bg3 = diceSettleTimer > 0 || (rolling3 && rp3 > 0.7);
      ctx.strokeStyle = bg3 ? `rgba(255,215,0,${diceSettleTimer > 0 ? Math.min(1, diceSettleTimer * 2.5) : 0.75})` : (isOrange ? '#993300' : '#aaa');
      ctx.lineWidth = bg3 ? 2.5 : 1.5;
      ctx.beginPath(); ctx.roundRect(-ds / 2, -ds / 2, ds, ds, 7); ctx.stroke();
      ctx.strokeStyle = isOrange ? 'rgba(255,200,150,0.3)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(-ds / 2 + 2, -ds / 2 + 2, ds - 4, ds - 4, 5); ctx.stroke();
      // Pips
      if (rolling3 || diceValue > 0) {
        const v3 = diceDisplay, pr3 = ds * 0.115, off3 = ds * 0.26;
        const pipColor = isOrange ? '#fff' : '#1a1a1a';
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
      if (phase === 'waitTap') {
        const hintFs = Math.max(9, Math.min(h * 0.022, 12));
        ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = `bold ${hintFs}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('TAP: safe', dx, dy + ds / 2 + 6);
        ctx.fillStyle = 'rgba(255,200,100,0.8)';
        ctx.fillText('HOLD: risky 🔥', dx, dy + ds / 2 + 20);
      }

      // Floating number burst from dice
      for (const fn of floatNums) {
        const p = 1 - fn.life / fn.maxLife;
        const yOff = p < 0.25 ? 0 : -(((p - 0.25) / 0.75) ** 0.7) * 68;
        const scale = p < 0.25 ? (p / 0.25) * 2.2 : 2.2 - ((p - 0.25) / 0.75) * 0.7;
        const alpha = p < 0.25 ? 1 : 1 - (p - 0.25) / 0.75;
        const fSize = Math.round(30 * Math.max(scale, 0.1));
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.font = `bold ${fSize}px 'Fredoka One', cursive`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, fSize * 0.12);
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(fn.text, fn.x, fn.y + yOff);
        ctx.fillStyle = fn.color;
        ctx.fillText(fn.text, fn.x, fn.y + yOff);
        ctx.restore();
      }

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
