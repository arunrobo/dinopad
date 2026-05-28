import type { GameInstance, GameConfig, PlayerInGame, ButtonInput, Particle } from './types';
import { buildResults, createParticle, updateParticles, renderParticles } from './types';
import type { Side } from '../../engine/utils';
import { randInt, randRange, lerp } from '../../engine/utils';
import { createTurnState, getCurrentSide, advanceTurn, type TurnState } from '../../engine/turnManager';
import { drawDinoOnCanvas } from '../../engine/assets';
import { audioManager } from '../../engine/audioManager';

/* ── Theme palettes ── */
interface ThemePalette {
  bg: string; tileA: string; tileB: string; border: string;
  ladderCol: string; slideCol: string; startCol: string;
  ladderBg0: string; ladderBg1: string; // tile gradient for ladder tiles
  slideBg0: string;  slideBg1: string;  // tile gradient for slide tiles
  ladderEmoji: string; slideEmoji: string; slideVerb: string; slideThing: string;
  tileGlow: string;
}
const THEMES: Record<string, ThemePalette> = {
  jungle: {
    bg: '#1a3a12', tileA: '#2d5a22', tileB: '#3a7030', border: 'rgba(0,0,0,0.25)',
    ladderCol: 'rgba(80,220,80,0.9)',  slideCol: 'rgba(230,50,50,0.92)', startCol: '#FFD700',
    ladderBg0: 'rgba(100,255,80,0.38)', ladderBg1: 'rgba(255,220,0,0.28)',
    slideBg0:  'rgba(255,50,50,0.40)',  slideBg1:  'rgba(220,90,0,0.32)',
    ladderEmoji: '🌿', slideEmoji: '🐊', slideVerb: 'Croc attack', slideThing: '🐊',
    tileGlow: 'rgba(76,200,60,0.16)',
  },
  desert: {
    bg: '#7a4808', tileA: '#a06218', tileB: '#c07e2a', border: 'rgba(200,140,20,0.2)',
    ladderCol: 'rgba(255,220,60,0.9)', slideCol: 'rgba(230,50,50,0.92)', startCol: '#FFD700',
    ladderBg0: 'rgba(255,230,80,0.38)', ladderBg1: 'rgba(100,220,80,0.28)',
    slideBg0:  'rgba(255,55,55,0.40)',  slideBg1:  'rgba(200,80,0,0.32)',
    ladderEmoji: '🌵', slideEmoji: '🦂', slideVerb: 'Scorpion sting', slideThing: '🦂',
    tileGlow: 'rgba(255,200,50,0.16)',
  },
  iceage: {
    bg: '#0d2040', tileA: '#1e4070', tileB: '#2a5490', border: 'rgba(150,220,255,0.18)',
    ladderCol: 'rgba(80,230,200,0.9)', slideCol: 'rgba(230,50,50,0.92)', startCol: '#80DEEA',
    ladderBg0: 'rgba(80,230,200,0.35)', ladderBg1: 'rgba(180,255,220,0.25)',
    slideBg0:  'rgba(255,60,60,0.40)',  slideBg1:  'rgba(180,50,200,0.28)',
    ladderEmoji: '❄️', slideEmoji: '🐺', slideVerb: 'Wolf chase', slideThing: '🐺',
    tileGlow: 'rgba(120,210,255,0.14)',
  },
};

/* ── Confetti helper ── */
const CONFETTI_COLORS = ['#FF4444', '#FFD700', '#4CAF50', '#2196F3', '#E91E63', '#FF9800', '#9C27B0', '#00BCD4'];
function spawnConfetti(particles: Particle[], cx: number, cy: number, count: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 160;
    const col = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 1.0 + Math.random() * 0.8, maxLife: 1.8, color: col, size: 3 + Math.random() * 4 });
  }
}

/* ── Footprint trail ── */
interface Footprint { x: number; y: number; age: number; maxAge: number; angle: number; }

/* ── Slide wobble ── */
interface SlideAnim { playerId: string; fromX: number; fromY: number; toX: number; toY: number; t: number; dur: number; }

interface Tile { idx: number; x: number; y: number; link?: number; type: 'normal' | 'ladder' | 'slide'; }
type Phase = 'waitTap' | 'rolling' | 'moving' | 'climbAnim' | 'slideAnim' | 'landEffect' | 'stayPut' | 'finished';

export function createGame1(): GameInstance {
  let players: PlayerInGame[] = [];
  let turn: TurnState;
  let tiles: Tile[] = [];
  let gridSize = 7;
  let totalTiles = 49;
  let positions = new Map<string, number>();
  let phase: Phase = 'waitTap';
  let diceValue = 0;
  let diceAnimTimer = 0;
  let diceDisplay = 1;
  let diceSettleTimer = 0;
  type FloatNum = { x: number; y: number; text: string; color: string; life: number; maxLife: number };
  let floatNums: FloatNum[] = [];
  let moveStepsLeft = 0;
  let moveTimer = 0;
  let currentMovingId = '';
  let particles: Particle[] = [];
  let turnMessage = '';
  let usedRoar = new Set<string>();
  let stats = new Map<string, Record<string, number>>();
  let winner: string | null = null;
  let finishDelay = 0;
  let stayPutTimer = 0;
  let tileSize = 0;
  let boardX = 0;
  let boardY = 0;
  let theme: ThemePalette = THEMES.jungle;
  let boardThemeName = 'jungle';
  let complexity: 'low' | 'medium' = 'low';
  let globalTime = 0;

  // Footprint trails (persistent decoration along ladder paths)
  let footprints: Footprint[] = [];
  // Slide wobble animation
  let slideAnim: SlideAnim | null = null;
  // Climb animation
  let climbAnim: SlideAnim | null = null;

  let lastW = 0, lastH = 0;

  /** Recalculate tile positions to fit current canvas — does NOT re-randomize links/types */
  function layoutBoard(w: number, h: number) {
    const diceGap = Math.min(80, w * 0.08);
    const availW = w - diceGap;
    const pad = 10;
    const fitW = availW - pad * 2;
    const fitH = h - pad * 2;
    const bs = Math.min(fitW, fitH);
    tileSize = bs / gridSize;
    boardX = pad + (fitW - bs) / 2;
    boardY = pad + (fitH - bs) / 2;
    for (let i = 0; i < tiles.length; i++) {
      const row = Math.floor(i / gridSize);
      const col = row % 2 === 0 ? i % gridSize : gridSize - 1 - (i % gridSize);
      tiles[i].x = boardX + col * tileSize + tileSize / 2;
      tiles[i].y = boardY + (gridSize - 1 - row) * tileSize + tileSize / 2;
    }
    // Regenerate footprints for new positions
    rebuildFootprints();
  }

  function rebuildFootprints() {
    footprints = []; // footprints replaced by richer ladder graphics
  }

  function buildBoard(w: number, h: number) {
    lastW = w; lastH = h;
    tiles = [];
    for (let i = 0; i < totalTiles; i++) {
      tiles.push({ idx: i, x: 0, y: 0, type: 'normal' });
    }
    // Randomize ladders and slides
    const used = new Set<number>([0, totalTiles - 1]);
    const ladders = gridSize === 5 ? 3 : 5;
    const slides = gridSize === 5 ? 2 : 4;
    for (let i = 0; i < ladders; i++) {
      let from = 0, to = 0, tries = 0;
      do { from = randInt(1, totalTiles - gridSize - 1); to = from + randInt(gridSize, gridSize * 2); if (to >= totalTiles - 1) to = totalTiles - 2; tries++; }
      while ((used.has(from) || used.has(to) || to <= from) && tries < 50);
      if (tries < 50) { tiles[from].link = to; tiles[from].type = 'ladder'; used.add(from); used.add(to); }
    }
    for (let i = 0; i < slides; i++) {
      let from = 0, to = 0, tries = 0;
      do { from = randInt(gridSize + 1, totalTiles - 2); to = from - randInt(gridSize, gridSize * 2); if (to < 1) to = 1; tries++; }
      while ((used.has(from) || used.has(to) || to >= from) && tries < 50);
      if (tries < 50) { tiles[from].link = to; tiles[from].type = 'slide'; used.add(from); used.add(to); }
    }
    // Layout positions and footprints
    layoutBoard(w, h);
  }

  function getTilePos(idx: number) {
    if (idx <= 0) return { x: tiles[0].x, y: tiles[0].y + tileSize };
    if (idx >= totalTiles) return tiles[totalTiles - 1];
    return tiles[idx];
  }

  function addStat(pid: string, key: string, val: number) {
    const s = stats.get(pid) || {}; s[key] = (s[key] || 0) + val; stats.set(pid, s);
  }

  /** Get animated position for a player (handles climb/slide anims) */
  function getPlayerDrawPos(pid: string, basePos: number): { x: number; y: number } {
    if (climbAnim && climbAnim.playerId === pid) {
      const t = Math.min(1, climbAnim.t / climbAnim.dur);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out quad
      return { x: lerp(climbAnim.fromX, climbAnim.toX, eased), y: lerp(climbAnim.fromY, climbAnim.toY, eased) };
    }
    if (slideAnim && slideAnim.playerId === pid) {
      const t = Math.min(1, slideAnim.t / slideAnim.dur);
      const eased = t * (2 - t); // ease out quad
      const wobble = Math.sin(t * Math.PI * 6) * (1 - t) * tileSize * 0.15;
      return { x: lerp(slideAnim.fromX, slideAnim.toX, eased) + wobble, y: lerp(slideAnim.fromY, slideAnim.toY, eased) };
    }
    const tp = getTilePos(basePos);
    return { x: tp.x, y: tp.y };
  }

  return {
    init(cfg: GameConfig, w: number, h: number) {
      players = cfg.players;
      gridSize = cfg.complexity === 'medium' ? 7 : (cfg.kidMode ? 5 : 7);
      totalTiles = gridSize * gridSize;
      complexity = cfg.complexity ?? 'low';
      theme = THEMES[cfg.boardTheme] || THEMES.jungle;
      boardThemeName = cfg.boardTheme;
      turn = createTurnState(players.map(p => p.side), cfg.turnDirection);
      buildBoard(w, h);
      positions = new Map(); usedRoar = new Set();
      players.forEach(p => { positions.set(p.id, 0); stats.set(p.id, { ladders: 0, slides: 0, rolls: 0 }); });
      phase = 'waitTap'; turnMessage = 'TAP to roll!'; winner = null; globalTime = 0;
      slideAnim = null; climbAnim = null; floatNums = [];
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

      // Animate climb/slide
      if (phase === 'climbAnim' && climbAnim) {
        climbAnim.t += dt;
        // Spawn trail particles during climb
        if (Math.random() < 0.4) {
          const t = Math.min(1, climbAnim.t / climbAnim.dur);
          const px = lerp(climbAnim.fromX, climbAnim.toX, t);
          const py = lerp(climbAnim.fromY, climbAnim.toY, t);
          particles.push(createParticle(px, py, theme.ladderCol));
        }
        if (climbAnim.t >= climbAnim.dur) {
          climbAnim = null;
          // Confetti burst on climb
          const pos = positions.get(currentMovingId) || 0;
          const tp = getTilePos(pos);
          spawnConfetti(particles, tp.x, tp.y, 25);
          audioManager.play('sparkle');
          turn = advanceTurn(turn); phase = 'waitTap';
          setTimeout(() => { turnMessage = 'TAP to roll!'; }, 800);
        }
        return;
      }
      if (phase === 'slideAnim' && slideAnim) {
        slideAnim.t += dt;
        // Mud/ice splatter during slide
        if (Math.random() < 0.35) {
          const t = Math.min(1, slideAnim.t / slideAnim.dur);
          const px = lerp(slideAnim.fromX, slideAnim.toX, t);
          const py = lerp(slideAnim.fromY, slideAnim.toY, t);
          particles.push(createParticle(px, py, theme.slideCol));
        }
        if (slideAnim.t >= slideAnim.dur) {
          slideAnim = null;
          turn = advanceTurn(turn); phase = 'waitTap';
          setTimeout(() => { turnMessage = 'TAP to roll!'; }, 800);
        }
        return;
      }

      switch (phase) {
        case 'waitTap':
          if (input?.justPressed) { phase = 'rolling'; diceAnimTimer = 1.5; diceValue = 0; audioManager.play('tap'); }
          break;
        case 'rolling':
          diceAnimTimer -= dt; diceDisplay = randInt(1, 6);
          if (diceAnimTimer <= 0) {
            diceValue = randInt(1, 6); diceDisplay = diceValue; addStat(cp.id, 'rolls', 1);
            if (input && input.holdTime > 0.5 && !usedRoar.has(cp.id)) {
              usedRoar.add(cp.id); diceValue = randInt(1, 6); diceDisplay = diceValue;
              audioManager.play('burst'); turnMessage = `DINO ROAR! → ${diceValue}!`;
            } else { audioManager.play('powerup'); turnMessage = `Rolled ${diceValue}!`; }            // Medium: Stay Put rule — must roll exact number to land on final tile
            const curPos1 = positions.get(cp.id) || 0;
            if (complexity === 'medium' && curPos1 + diceValue > totalTiles - 1) {
              audioManager.play('oops');
              turnMessage = `Need exactly ${totalTiles - 1 - curPos1} to finish — too high! ⏸️`;
              diceDisplay = diceValue; diceSettleTimer = 0.5; stayPutTimer = 1.4;
              floatNums.push({ x: boardX + gridSize * tileSize + 40, y: lastH / 2, text: `${diceValue}`, color: cp.color, life: 1.1, maxLife: 1.1 });
              phase = 'stayPut'; break;
            }            currentMovingId = cp.id; moveStepsLeft = diceValue; moveTimer = 0; phase = 'moving'; diceSettleTimer = 0.5;
            floatNums.push({ x: boardX + gridSize * tileSize + 40, y: lastH / 2, text: `${diceValue}`, color: cp.color, life: 1.1, maxLife: 1.1 });
          }
          break;
        case 'moving':
          moveTimer -= dt;
          if (moveTimer <= 0 && moveStepsLeft > 0) {
            const cur = positions.get(currentMovingId) || 0;
            const np = Math.min(cur + 1, totalTiles - 1);
            positions.set(currentMovingId, np); moveStepsLeft--; moveTimer = 0.38; audioManager.play('step');
            if (np >= totalTiles - 1) moveStepsLeft = 0;
          }
          if (moveStepsLeft <= 0 && moveTimer <= 0) phase = 'landEffect';
          break;
        case 'stayPut':
          stayPutTimer -= dt;
          if (stayPutTimer <= 0) { turn = advanceTurn(turn); phase = 'waitTap'; turnMessage = 'TAP to roll!'; }
          break;
        case 'landEffect': {
          const pos = positions.get(currentMovingId) || 0;
          if (pos >= totalTiles - 1) {
            winner = currentMovingId; cp.score = 100; audioManager.play('win');
            const wp = getTilePos(pos);
            spawnConfetti(particles, wp.x, wp.y, 50);
            // Extra wide confetti burst for victory
            spawnConfetti(particles, wp.x - tileSize, wp.y, 20);
            spawnConfetti(particles, wp.x + tileSize, wp.y, 20);
            turnMessage = `${cp.name} WINS! 🏆`; phase = 'finished'; finishDelay = 2; break;
          }
          const tile = tiles[pos];
          if (tile?.link !== undefined) {
            const from = getTilePos(pos);
            const to = getTilePos(tile.link);
            if (tile.type === 'ladder') {
              positions.set(currentMovingId, tile.link); addStat(cp.id, 'ladders', 1);
              audioManager.play('climb'); turnMessage = `Climbed a trail! ${theme.ladderEmoji}`;
              climbAnim = { playerId: currentMovingId, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, t: 0, dur: 1.4 };
              phase = 'climbAnim';
            } else {
              positions.set(currentMovingId, tile.link); addStat(cp.id, 'slides', 1);
              audioManager.play('descend'); turnMessage = `${theme.slideVerb}! ${theme.slideThing}`;
              slideAnim = { playerId: currentMovingId, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, t: 0, dur: 1.0 };
              phase = 'slideAnim';
            }
          } else {
            turn = advanceTurn(turn); phase = 'waitTap';
            setTimeout(() => { turnMessage = 'TAP to roll!'; }, 800);
          }
          break;
        }
      }
    },

    render(ctx, w, h) {
      // Adapt board layout if canvas size changed
      if (w !== lastW || h !== lastH) { lastW = w; lastH = h; layoutBoard(w, h); }
      // Background with gradient
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, theme.bg);
      bgGrad.addColorStop(1, theme.bg + 'cc');
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, w, h);

      // Theme background decorations
      const decos = boardThemeName === 'jungle' ? ['🌿','🌴','🌱','🍃'] : boardThemeName === 'desert' ? ['🌵','🏜️','🪨','🌵'] : ['❄️','🏔️','🌨️','⛄'];
      ctx.font = `${Math.min(tileSize * 0.55, 28)}px sans-serif`;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      const decoOffsets = [{ x: 0.02, y: 0.15 }, { x: 0.04, y: 0.7 }, { x: 0.96, y: 0.2 }, { x: 0.94, y: 0.75 }];
      decoOffsets.forEach((d, i) => {
        ctx.globalAlpha = 0.28 + 0.1 * Math.sin(globalTime * 0.7 + i * 1.2);
        ctx.fillText(decos[i % decos.length], w * d.x, h * d.y);
      });
      ctx.globalAlpha = 1;

      // Board tiles
      for (let i = 0; i < totalTiles; i++) {
        const t = tiles[i];
        const even = Math.floor(i / gridSize) % 2 === 0;
        const tx = t.x - tileSize / 2 + 1, ty = t.y - tileSize / 2 + 1, tw = tileSize - 2, th = tileSize - 2;

        // Base checkerboard fill
        ctx.fillStyle = (i + (even ? 0 : 1)) % 2 === 0 ? theme.tileA : theme.tileB;
        ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 4); ctx.fill();

        if (t.type === 'ladder') {
          // Bright gold-green gradient fill — clearly positive
          const lg = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
          lg.addColorStop(0, theme.ladderBg0); lg.addColorStop(1, theme.ladderBg1);
          ctx.fillStyle = lg; ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 4); ctx.fill();
          // Pulsing gold border
          const pulse = 0.7 + 0.3 * Math.sin(globalTime * 2.8 + i * 0.6);
          ctx.strokeStyle = `rgba(255,215,0,${pulse})`; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 4); ctx.stroke();
        } else if (t.type === 'slide') {
          // Bright red-orange gradient fill — clearly dangerous
          const sg = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
          sg.addColorStop(0, theme.slideBg0); sg.addColorStop(1, theme.slideBg1);
          ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 4); ctx.fill();
          // Pulsing red border
          const pulse = 0.7 + 0.3 * Math.sin(globalTime * 3.2 + i * 0.8);
          ctx.strokeStyle = `rgba(230,50,50,${pulse})`; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 4); ctx.stroke();
        } else {
          ctx.strokeStyle = theme.border; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 4); ctx.stroke();
        }

        // Special tile: big centred emoji + directional label
        if (t.type === 'ladder') {
          const bob = Math.sin(globalTime * 2.5 + i) * tileSize * 0.03;
          ctx.font = `${tileSize * 0.44}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.95;
          ctx.fillText(theme.ladderEmoji, t.x, t.y - tileSize * 0.1 + bob);
          ctx.globalAlpha = 1;
          // ⬆ UP label in gold
          ctx.font = `bold ${tileSize * 0.17}px 'Fredoka One', cursive`;
          ctx.fillStyle = '#FFE040';
          ctx.fillText('⬆ UP!', t.x, t.y + tileSize * 0.32);
        } else if (t.type === 'slide') {
          const shake = Math.sin(globalTime * 5 + i) * tileSize * 0.02;
          ctx.font = `${tileSize * 0.44}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.95;
          ctx.fillText(theme.slideEmoji, t.x + shake, t.y - tileSize * 0.1);
          ctx.globalAlpha = 1;
          // ⬇ DOWN label in red
          ctx.font = `bold ${tileSize * 0.17}px 'Fredoka One', cursive`;
          ctx.fillStyle = '#FF6060';
          ctx.fillText('⬇ BACK!', t.x, t.y + tileSize * 0.32);
        } else {
          // Tile number on normal tiles
          ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.font = `${tileSize * 0.2}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`${i + 1}`, t.x, t.y);
        }

        // Small tile number in corner for special tiles
        if (t.type !== 'normal') {
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = `${tileSize * 0.15}px sans-serif`;
          ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.fillText(`${i + 1}`, tx + 4, ty + 3);
        }

        if (i === 0) { ctx.fillStyle = theme.startCol; ctx.font = `bold ${tileSize * 0.2}px 'Fredoka One', cursive`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('START', t.x, t.y); }
        if (i === totalTiles - 1) { ctx.fillStyle = theme.startCol; ctx.font = `bold ${tileSize * 0.2}px 'Fredoka One', cursive`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FINISH', t.x, t.y); }
      }

      // Subtle gold footprints along ladder paths
      ctx.save();
      for (const fp of footprints) {
        const pulse = 0.2 + 0.15 * Math.sin(globalTime * 2.5 + fp.x * 0.05 + fp.y * 0.03);
        ctx.globalAlpha = pulse;
        ctx.save();
        ctx.translate(fp.x, fp.y); ctx.rotate(fp.angle);
        const fs = tileSize * 0.1;
        ctx.fillStyle = 'rgba(255,220,80,0.9)';
        ctx.beginPath(); ctx.ellipse(0, 0, fs * 0.55, fs, 0, 0, Math.PI * 2); ctx.fill();
        for (let ti = -1; ti <= 1; ti++) {
          ctx.beginPath(); ctx.arc(ti * fs * 0.35, -fs * 1.0, fs * 0.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Connection paths — ladder rungs (gold) and slide arrows (red)
      tiles.forEach(t => {
        if (t.link === undefined) return;
        const tgt = tiles[t.link]; if (!tgt) return;
        const angle = Math.atan2(tgt.y - t.y, tgt.x - t.x);
        const perp = angle + Math.PI / 2;
        const dist = Math.hypot(tgt.x - t.x, tgt.y - t.y);

        if (t.type === 'ladder') {
          // ── Rich 3D cartoon ladder ────────────────────────────────────────
          // Offset start/end toward tile edges so rails don't cover the character
          const edgePush = tileSize * 0.3;
          const startX = t.x   + Math.cos(angle) * edgePush;
          const startY = t.y   + Math.sin(angle) * edgePush;
          const endX   = tgt.x - Math.cos(angle) * edgePush;
          const endY   = tgt.y - Math.sin(angle) * edgePush;
          const rail = tileSize * 0.18;  // half-gap between rails (wider)
          const l1x = startX + Math.cos(perp)*rail, l1y = startY + Math.sin(perp)*rail;
          const l2x = endX   + Math.cos(perp)*rail, l2y = endY   + Math.sin(perp)*rail;
          const r1x = startX - Math.cos(perp)*rail, r1y = startY - Math.sin(perp)*rail;
          const r2x = endX   - Math.cos(perp)*rail, r2y = endY   - Math.sin(perp)*rail;
          const rungExt  = rail + tileSize * 0.04; // rungs extend slightly past rails
          const innerDist = Math.hypot(endX - startX, endY - startY);
          const numRungs = Math.max(3, Math.floor(innerDist / (tileSize * 0.48)));

          ctx.save();
          ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);

          // 1. Wide soft glow halo around whole ladder
          ctx.strokeStyle = 'rgba(140,255,100,0.22)'; ctx.lineWidth = 22;
          ctx.beginPath(); ctx.moveTo(l1x, l1y); ctx.lineTo(l2x, l2y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r1x, r1y); ctx.lineTo(r2x, r2y); ctx.stroke();

          // 2. Rail dark outlines (creates cartoon border + shadow)
          ctx.strokeStyle = 'rgba(50,30,0,0.88)'; ctx.lineWidth = 12;
          ctx.beginPath(); ctx.moveTo(l1x, l1y); ctx.lineTo(l2x, l2y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r1x, r1y); ctx.lineTo(r2x, r2y); ctx.stroke();

          // 3. Rail main colour — warm amber-brown (bamboo/wood feel)
          ctx.strokeStyle = '#C89020'; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(l1x, l1y); ctx.lineTo(l2x, l2y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r1x, r1y); ctx.lineTo(r2x, r2y); ctx.stroke();

          // 4. Rail highlight — bright strip on inner edge
          const hlOff = 2.5;
          ctx.strokeStyle = 'rgba(255,235,140,0.8)'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(l1x - Math.cos(perp)*hlOff, l1y - Math.sin(perp)*hlOff);
          ctx.lineTo(l2x - Math.cos(perp)*hlOff, l2y - Math.sin(perp)*hlOff); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(r1x + Math.cos(perp)*hlOff, r1y + Math.sin(perp)*hlOff);
          ctx.lineTo(r2x + Math.cos(perp)*hlOff, r2y + Math.sin(perp)*hlOff); ctx.stroke();

          // 5. Rung dark outlines (slightly wider, extend past rails for depth)
          ctx.strokeStyle = 'rgba(50,30,0,0.88)'; ctx.lineWidth = 11;
          for (let r = 1; r < numRungs; r++) {
            const frac = r / numRungs;
            const cx = lerp(startX, endX, frac), cy = lerp(startY, endY, frac);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(perp)*rungExt, cy + Math.sin(perp)*rungExt);
            ctx.lineTo(cx - Math.cos(perp)*rungExt, cy - Math.sin(perp)*rungExt); ctx.stroke();
          }

          // 6. Rung main colour — bright yellow (high contrast with amber rails)
          ctx.strokeStyle = '#FFE040'; ctx.lineWidth = 7;
          for (let r = 1; r < numRungs; r++) {
            const frac = r / numRungs;
            const cx = lerp(startX, endX, frac), cy = lerp(startY, endY, frac);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(perp)*rungExt, cy + Math.sin(perp)*rungExt);
            ctx.lineTo(cx - Math.cos(perp)*rungExt, cy - Math.sin(perp)*rungExt); ctx.stroke();
          }

          // 7. Rung top highlight (edge-lighting)
          ctx.strokeStyle = 'rgba(255,255,210,0.65)'; ctx.lineWidth = 2.5;
          for (let r = 1; r < numRungs; r++) {
            const frac = r / numRungs;
            const edgeOff = tileSize * 0.012;
            const cx = lerp(startX, endX, frac) - Math.cos(angle)*edgeOff;
            const cy = lerp(startY, endY, frac) - Math.sin(angle)*edgeOff;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(perp)*rail, cy + Math.sin(perp)*rail);
            ctx.lineTo(cx - Math.cos(perp)*rail, cy - Math.sin(perp)*rail); ctx.stroke();
          }

          // 8. End caps — filled circles at bottom of each rail
          for (const [ex, ey] of [[l1x, l1y], [r1x, r1y]] as [number,number][]) {
            ctx.fillStyle = 'rgba(50,30,0,0.85)'; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#C89020';            ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255,235,140,0.8)'; ctx.beginPath(); ctx.arc(ex - 1.5, ey - 1.5, 2, 0, Math.PI*2); ctx.fill();
          }

          ctx.restore();
        } else {
          // ── Draw vivid red slide: thick curved arrow ──────────────────────
          const wob = Math.sin(globalTime * 2.2) * tileSize * 0.18;
          const cxM = (t.x + tgt.x) / 2 + Math.cos(perp) * wob;
          const cyM = (t.y + tgt.y) / 2 + Math.sin(perp) * wob;

          ctx.save();
          ctx.shadowColor = 'rgba(230,50,50,0.7)'; ctx.shadowBlur = 10;
          ctx.strokeStyle = theme.slideCol; ctx.lineWidth = 5; ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.quadraticCurveTo(cxM, cyM, tgt.x, tgt.y); ctx.stroke();
          // White inner line for contrast
          ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
          ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.quadraticCurveTo(cxM, cyM, tgt.x, tgt.y); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
          // Arrow at destination (bottom of slide)
          ctx.save();
          ctx.translate(tgt.x, tgt.y);
          ctx.rotate(angle + Math.PI / 2);
          const as = tileSize * 0.18;
          ctx.fillStyle = '#FF3333';
          ctx.shadowColor = 'rgba(230,50,50,0.8)'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(0, as); ctx.lineTo(as * 0.6, -as * 0.3); ctx.lineTo(-as * 0.6, -as * 0.3); ctx.closePath(); ctx.fill();
          ctx.restore();
          // Danger emoji pulses along slide path
          for (let s = 0; s < 2; s++) {
            const frac = (s + 1) / 3;
            const t2 = frac;
            const ex = (1-t2)*(1-t2)*t.x + 2*(1-t2)*t2*cxM + t2*t2*tgt.x;
            const ey = (1-t2)*(1-t2)*t.y + 2*(1-t2)*t2*cyM + t2*t2*tgt.y;
            ctx.globalAlpha = 0.55 + 0.3 * Math.sin(globalTime * 4 + s * 2.5);
            ctx.font = `${tileSize * 0.22}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(theme.slideEmoji, ex, ey);
          }
          ctx.globalAlpha = 1;
        }
      });

      // Players — centered on tile with small offset for multi-player
      players.forEach((p, i) => {
        const pos = positions.get(p.id) || 0;
        const dp = getPlayerDrawPos(p.id, pos);
        const off = (i - (players.length - 1) / 2) * tileSize * 0.12;
        const ax = dp.x + off;
        const ay = dp.y + off * 0.5;
        drawDinoOnCanvas(ctx, p.avatarId, ax, ay, tileSize * 0.5, p.color);

        // Name pill below avatar
        const fontSize = Math.max(9, tileSize * 0.14);
        const label = p.name.length > 8 ? p.name.slice(0, 7) + '\u2026' : p.name;
        ctx.save();
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const tw = ctx.measureText(label).width;
        const pw = tw + 10, ph = fontSize + 6;
        const nameY = ay + tileSize * 0.27;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(10,10,10,0.82)';
        ctx.beginPath();
        ctx.roundRect(ax - pw / 2, nameY, pw, ph, ph / 2);
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, ax, nameY + 3);
        ctx.restore();
      });

      // ── Enhanced Dice ─────────────────────────────────────────────────────
      const dx = boardX + gridSize * tileSize + 40, dy = h / 2, ds = 52;
      const isRolling = phase === 'rolling';
      const rollProgress = isRolling ? Math.max(0, 1 - diceAnimTimer / 1.5) : 1;
      const settleProgress = diceSettleTimer > 0 ? (0.5 - diceSettleTimer) / 0.5 : 1;
      const bounceScale = diceSettleTimer > 0 ? 1 + 0.22 * Math.sin(Math.PI * settleProgress) : 1;

      // Face-flip spin (simulate tumbling in 3D)
      const flipSpeed = isRolling ? 14 + (1 - rollProgress) * 10 : 0;
      const flipAmp = isRolling ? (1 - rollProgress * 0.65) : 0;
      const squishX = isRolling ? (Math.abs(Math.cos(globalTime * flipSpeed)) * flipAmp + (1 - flipAmp)) : 1;
      const diceRotation = isRolling ? Math.sin(globalTime * flipSpeed * 0.7) * 0.3 * flipAmp : 0;

      ctx.save();
      ctx.translate(dx, dy);
      ctx.scale(bounceScale, bounceScale);

      // Motion trail — only during early rolling phase
      if (isRolling && rollProgress < 0.55) {
        const trailFade = (0.55 - rollProgress) / 0.55;
        for (let ti = 1; ti <= 2; ti++) {
          const ang = globalTime * flipSpeed * 0.65 - ti * 0.5;
          ctx.save();
          ctx.globalAlpha = trailFade * 0.18 / ti;
          ctx.translate(Math.cos(ang) * 9 * ti, Math.sin(ang * 0.55) * 5 * ti);
          ctx.scale(squishX * 0.85, 0.88);
          ctx.fillStyle = '#d0d0d0';
          ctx.beginPath(); ctx.roundRect(-ds / 2, -ds / 2, ds, ds, 7); ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }

      // Apply flip + rotation
      ctx.scale(squishX, 1);
      ctx.rotate(diceRotation);

      // Glow
      if (isRolling) {
        const glowCol = rollProgress > 0.65 ? '#FFD700' : '#80B0FF';
        ctx.shadowColor = glowCol; ctx.shadowBlur = 18 + 7 * Math.sin(globalTime * 10);
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      } else if (diceSettleTimer > 0) {
        const ga = diceSettleTimer / 0.5;
        ctx.shadowColor = `rgba(255,215,0,${ga})`; ctx.shadowBlur = 22 * ga;
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
      }

      // Main face gradient
      const faceGrad = ctx.createRadialGradient(-ds * 0.2, -ds * 0.2, 0, 0, 0, ds * 0.8);
      if (isRolling && rollProgress > 0.65) {
        faceGrad.addColorStop(0, '#fff8e1'); faceGrad.addColorStop(1, '#ffe082');
      } else {
        faceGrad.addColorStop(0, '#ffffff'); faceGrad.addColorStop(1, '#dcdcdc');
      }
      ctx.fillStyle = faceGrad;
      ctx.beginPath(); ctx.roundRect(-ds / 2, -ds / 2, ds, ds, 7); ctx.fill();

      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      // Border — golden when settling or final phase of roll
      const borderGolden = diceSettleTimer > 0 || (isRolling && rollProgress > 0.7);
      ctx.strokeStyle = borderGolden
        ? `rgba(255,215,0,${diceSettleTimer > 0 ? Math.min(1, diceSettleTimer * 2.5) : 0.75})`
        : '#aaa';
      ctx.lineWidth = borderGolden ? 2.5 : 1.5;
      ctx.beginPath(); ctx.roundRect(-ds / 2, -ds / 2, ds, ds, 7); ctx.stroke();

      // Inner bevel highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(-ds / 2 + 2, -ds / 2 + 2, ds - 4, ds - 4, 5); ctx.stroke();

      // Pips
      if (isRolling || diceValue > 0) {
        const v = diceDisplay, pr = ds * 0.115, poff = ds * 0.26;
        const drawPip = (px: number, py: number) => {
          ctx.fillStyle = '#1a1a1a';
          ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath(); ctx.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.35, 0, Math.PI * 2); ctx.fill();
        };
        if (v === 1 || v === 3 || v === 5) drawPip(0, 0);
        if (v >= 2) { drawPip(-poff, -poff); drawPip(poff, poff); }
        if (v >= 4) { drawPip(poff, -poff); drawPip(-poff, poff); }
        if (v === 6) { drawPip(-poff, 0); drawPip(poff, 0); }
      }

      ctx.restore();

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
    getResults() { players.forEach(p => { p.score = positions.get(p.id) || 0; }); return buildResults(0, false, players, stats); },
    cleanup() {},
  };
}
