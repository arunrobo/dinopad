import type { GameInstance, GameConfig, PlayerInGame, ButtonInput, Particle } from './types';
import { buildResults, createParticle, updateParticles, renderParticles } from './types';
import type { Side } from '../../engine/utils';
import { shuffle } from '../../engine/utils';
import { createTurnState, getCurrentSide, advanceTurn, type TurnState } from '../../engine/turnManager';
import { audioManager } from '../../engine/audioManager';

const FOSSILS = ['🦴', '🦷', '🐚', '🌿', '🪨', '🐾', '🦶', '💎', '🥚', '🌋', '🦎', '🐉'];

type FlipDir = 'leftToRight' | 'rightToLeft' | 'topToBottom' | 'bottomToTop';
interface PreviewFlipAnim { active: boolean; elapsed: number; delay: number; duration: number; dir: FlipDir; }
interface Card { id: number; icon: string; pairId: number; flipped: boolean; matched: boolean; x: number; y: number; w: number; h: number; previewFlip: PreviewFlipAnim; }
type Phase = 'preview' | 'previewFlipOut' | 'selectFirst' | 'selectSecond' | 'showMismatch' | 'finished';

const PREVIEW_SECONDS = 4;

export function createGame2(): GameInstance {
  let players: PlayerInGame[] = [];
  let turn: TurnState;
  let cards: Card[] = [];
  let phase: Phase = 'selectFirst';
  let cursorIdx = 0;
  let cursorTimer = 0;
  let cursorSpeed = 0.7;
  let firstCard: number | null = null;
  let secondCard: number | null = null;
  let mismatchTimer = 0;
  let particles: Particle[] = [];
  let turnMessage = '';
  let stats = new Map<string, Record<string, number>>();
  let totalPairs = 0;
  let matchedCount = 0;
  let finishDelay = 0;
  let fastMode = false;
  let lastW = 0, lastH = 0, lastKidMode = false;
  let boardTheme = 'jungle';
  let complexity: 'low' | 'medium' = 'low';
  let matchPulseTimer = 0;
  let lastMatchedPair: number[] = [];
  type RingBurst = { x: number; y: number; targetR: number; life: number; maxLife: number; color: string };
  let ringBursts: RingBurst[] = [];
  let globalTime = 0;
  let previewTimer = PREVIEW_SECONDS;

  function randomFlipDir(): FlipDir {
    const dirs: FlipDir[] = ['leftToRight', 'rightToLeft', 'topToBottom', 'bottomToTop'];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }

  function buildCards(w: number, h: number, kid: boolean) {
    const isMedium = complexity === 'medium';
    const pairs = isMedium ? 10 : (kid ? 6 : 8);
    totalPairs = pairs;
    const icons = FOSSILS.slice(0, pairs);
    const data = shuffle([...icons, ...icons]);
    const cols = isMedium ? 5 : 4;
    const rows = isMedium ? 4 : (kid ? 3 : 4);
    const gap = isMedium ? 6 : 8;
    const m = Math.min(w, h) * (isMedium ? 0.05 : 0.07);
    const gw = w - m * 2, gh = h - m * 2;
    const cs = Math.floor(Math.min(gw / cols - gap, gh / rows - gap));
    const totalGridW = cols * cs + (cols - 1) * gap;
    const totalGridH = rows * cs + (rows - 1) * gap;
    const startX = (w - totalGridW) / 2;
    const startY = (h - totalGridH) / 2;
    lastW = w; lastH = h; lastKidMode = kid;
    cards = data.map((icon, i) => ({
      id: i, icon, pairId: icons.indexOf(icon), flipped: false, matched: false,
      x: startX + (i % cols) * (cs + gap) + cs / 2,
      y: startY + Math.floor(i / cols) * (cs + gap) + cs / 2,
      w: cs, h: cs,
      previewFlip: { active: false, elapsed: 0, delay: 0, duration: 0.42, dir: randomFlipDir() },
    }));
  }

  function unmatchedIndices() { return cards.map((c, i) => c.matched ? -1 : i).filter(i => i >= 0); }

  function setUnmatchedCardsFlipped(flipped: boolean) {
    cards.forEach(c => {
      if (!c.matched) c.flipped = flipped;
    });
  }

  function startPreviewFlipOut() {
    phase = 'previewFlipOut';
    turnMessage = 'Ready...';
    cards.forEach(c => {
      if (c.matched) return;
      c.flipped = true;
      c.previewFlip.active = true;
      c.previewFlip.elapsed = 0;
      c.previewFlip.delay = Math.random() * 0.2;
      c.previewFlip.duration = 0.36 + Math.random() * 0.2;
      c.previewFlip.dir = randomFlipDir();
    });
    audioManager.play('whoosh');
  }

  function drawCardFront(ctx: CanvasRenderingContext2D, c: Card, isCur: boolean) {
    if (isCur) { ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 14; }
    ctx.fillStyle = '#FFF8F2';
    ctx.beginPath(); ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 10); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.strokeStyle = isCur ? '#FFD700' : '#C8A07A'; ctx.lineWidth = isCur ? 2.5 : 1.5;
    ctx.beginPath(); ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 10); ctx.stroke();
    ctx.fillStyle = '#1a1a1a'; ctx.font = `${c.h * 0.52}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.icon, c.x, c.y);
  }

  function drawCardBack(ctx: CanvasRenderingContext2D, c: Card, isCur: boolean) {
    const bg = ctx.createRadialGradient(c.x - c.w * 0.15, c.y - c.h * 0.15, 0, c.x, c.y, c.w * 0.82);
    bg.addColorStop(0, isCur ? '#C060F8' : '#8B35D4');
    bg.addColorStop(1, isCur ? '#5828C0' : '#3A0D80');
    if (isCur) { ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 16 + 5 * Math.sin(globalTime * 6); }
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 10); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.strokeStyle = isCur ? '#FFD700' : '#6A28B0'; ctx.lineWidth = isCur ? 2.5 : 1.5;
    ctx.beginPath(); ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(c.x - c.w / 2 + 3, c.y - c.h / 2 + 3, c.w - 6, c.h - 6, 8); ctx.stroke();
    ctx.globalAlpha = 0.2; ctx.font = `${c.h * 0.46}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🦕', c.x, c.y);
    ctx.globalAlpha = 1;
  }

  function drawPreviewFlipOut(ctx: CanvasRenderingContext2D, c: Card, isCur: boolean) {
    const a = c.previewFlip;
    const raw = (a.elapsed - a.delay) / a.duration;
    if (raw <= 0) {
      drawCardFront(ctx, c, isCur);
      return;
    }
    if (raw >= 1) {
      drawCardBack(ctx, c, isCur);
      return;
    }

    const p = Math.max(0, Math.min(1, raw));
    const squeeze = Math.max(0.06, Math.abs(Math.cos(p * Math.PI)));
    const showFront = p < 0.5;
    const axisY = a.dir === 'leftToRight' || a.dir === 'rightToLeft';
    const sign = (a.dir === 'leftToRight' || a.dir === 'topToBottom') ? 1 : -1;
    const shear = (1 - squeeze) * 0.2 * sign;
    const drift = (1 - squeeze) * (axisY ? c.w * 0.1 : c.h * 0.1) * sign;

    ctx.save();
    ctx.translate(c.x, c.y);
    if (axisY) {
      ctx.transform(1, 0, shear, 1, drift, 0);
      ctx.scale(squeeze, 1);
    } else {
      ctx.transform(1, shear, 0, 1, 0, drift);
      ctx.scale(1, squeeze);
    }
    ctx.translate(-c.x, -c.y);
    if (showFront) drawCardFront(ctx, c, isCur);
    else drawCardBack(ctx, c, isCur);
    ctx.restore();
  }

  function getBoardBounds() {
    if (!cards.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const c of cards) {
      minX = Math.min(minX, c.x - c.w / 2);
      maxX = Math.max(maxX, c.x + c.w / 2);
      minY = Math.min(minY, c.y - c.h / 2);
      maxY = Math.max(maxY, c.y + c.h / 2);
    }
    return { minX, maxX, minY, maxY };
  }

  function advCursor() {
    const u = unmatchedIndices(); if (!u.length) return;
    const pos = u.indexOf(cursorIdx);
    cursorIdx = pos >= 0 ? u[(pos + 1) % u.length] : u[0];
  }

  return {
    init(cfg, w, h) {
      players = cfg.players;
      boardTheme = cfg.boardTheme;
      complexity = cfg.complexity ?? 'low';
      turn = createTurnState(players.map(p => p.side), cfg.turnDirection);
      buildCards(w, h, cfg.kidMode);
      cursorSpeed = cfg.kidMode ? 1.0 : 0.7;
      players.forEach(p => { p.score = 0; stats.set(p.id, { pairs: 0, misses: 0 }); });
      phase = 'preview';
      previewTimer = PREVIEW_SECONDS;
      setUnmatchedCardsFlipped(true);
      turnMessage = 'Memorize the fossils!';
      cursorIdx = 0;
      matchedCount = 0;
      matchPulseTimer = 0; lastMatchedPair = []; ringBursts = []; globalTime = 0;
    },

    update(dt, inputs) {
      globalTime += dt;
      particles = updateParticles(particles, dt);
      if (matchPulseTimer > 0) matchPulseTimer -= dt;
      ringBursts = ringBursts.filter(rb => { rb.life -= dt; return rb.life > 0; });
      if (phase === 'finished') { finishDelay -= dt; return; }

      if (phase === 'preview') {
        previewTimer = Math.max(0, previewTimer - dt);
        if (previewTimer <= 0) {
          startPreviewFlipOut();
        }
        return;
      }

      if (phase === 'previewFlipOut') {
        let stillAnimating = false;
        cards.forEach(c => {
          const a = c.previewFlip;
          if (!a.active) return;
          a.elapsed += dt;
          const raw = (a.elapsed - a.delay) / a.duration;
          if (raw < 0.5) {
            c.flipped = true;
            stillAnimating = true;
            return;
          }
          if (raw < 1) {
            c.flipped = false;
            stillAnimating = true;
            return;
          }
          c.flipped = false;
          a.active = false;
        });

        if (!stillAnimating) {
          phase = 'selectFirst';
          turnMessage = 'TAP to pick a card!';
        }
        return;
      }

      const side = getCurrentSide(turn);
      const input = inputs.get(side);
      const cp = players.find(p => p.side === side)!;

      cursorTimer += dt;
      const spd = fastMode ? cursorSpeed * 0.4 : cursorSpeed;
      if (cursorTimer >= spd && (phase === 'selectFirst' || phase === 'selectSecond')) { cursorTimer = 0; advCursor(); }
      if (input && input.holdTime > 0.8) fastMode = !fastMode;

      switch (phase) {
        case 'selectFirst':
          if (input?.justPressed) {
            const c = cards[cursorIdx];
            if (c && !c.matched && !c.flipped) { c.flipped = true; firstCard = cursorIdx; phase = 'selectSecond'; turnMessage = 'Pick the match!'; audioManager.play('tap'); advCursor(); }
          }
          break;
        case 'selectSecond':
          if (input?.justPressed) {
            const c = cards[cursorIdx];
            if (c && !c.matched && !c.flipped && cursorIdx !== firstCard) {
              c.flipped = true; secondCard = cursorIdx;
              const c1 = cards[firstCard!], c2 = cards[secondCard];
              if (c1.pairId === c2.pairId) {
                c1.matched = true; c2.matched = true; matchedCount++; cp.score++;
                stats.get(cp.id)!.pairs++; audioManager.play('match'); turnMessage = 'MATCH! 🎉 Go again!';
                for (let pi = 0; pi < 24; pi++) { particles.push(createParticle(c1.x, c1.y, cp.color)); particles.push(createParticle(c2.x, c2.y, cp.color)); }
                matchPulseTimer = 0.7; lastMatchedPair = [c1.id, c2.id];
                [c1, c2].forEach(mc => { const rc = [cp.color, '#FFD700', '#ffffff']; for (let ri = 0; ri < 3; ri++) ringBursts.push({ x: mc.x, y: mc.y, targetR: mc.w * (0.45 + ri * 0.38), life: 0.5, maxLife: 0.5, color: rc[ri] }); });
                firstCard = null; secondCard = null;
                if (matchedCount >= totalPairs) { phase = 'finished'; finishDelay = 2; turnMessage = 'All fossils found! 🏆'; audioManager.play('win'); }
                else phase = 'selectFirst';
              } else {
                stats.get(cp.id)!.misses++; audioManager.play('oops'); turnMessage = 'No match...'; mismatchTimer = 1.0; phase = 'showMismatch';
              }
            }
          }
          break;
        case 'showMismatch':
          mismatchTimer -= dt;
          if (mismatchTimer <= 0) {
            if (firstCard !== null) cards[firstCard].flipped = false;
            if (secondCard !== null) cards[secondCard].flipped = false;
            firstCard = null; secondCard = null;
            turn = advanceTurn(turn); phase = 'selectFirst'; turnMessage = 'TAP to pick a card!';
          }
          break;
      }
    },

    render(ctx, w, h) {
      if (Math.abs(w - lastW) > 0.5 || Math.abs(h - lastH) > 0.5) {
        buildCards(w, h, lastKidMode);
        if (phase === 'preview') setUnmatchedCardsFlipped(true);
        matchPulseTimer = 0;
        lastMatchedPair = [];
        ringBursts = [];
      }
      const bgColor = boardTheme === 'desert' ? '#1a0e04' : boardTheme === 'iceage' ? '#060e18' : '#081418';
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, w, h);
      // Subtle grid pattern
      ctx.strokeStyle = boardTheme === 'desert' ? 'rgba(160,110,30,0.08)' : boardTheme === 'iceage' ? 'rgba(80,140,200,0.08)' : 'rgba(40,120,80,0.08)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 32) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (let gy = 0; gy < h; gy += 32) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

      const pf = matchPulseTimer / 0.7; // 1→0 during pulse
      // Two-pass render: pass 0 = all cards except cursor, pass 1 = cursor card on top
      for (let pass = 0; pass < 2; pass++) { cards.forEach((c, i) => {
        const isCur = i === cursorIdx && (phase === 'selectFirst' || phase === 'selectSecond');
        if (pass === 0 && isCur) return;  // defer cursor card
        if (pass === 1 && !isCur) return; // skip non-cursor cards in second pass
        const isPulse = lastMatchedPair.includes(i) && matchPulseTimer > 0;
        if (c.matched) {
          const pulseScl = isPulse ? 1 + 0.32 * Math.sin(Math.PI * (1 - pf)) : 1;
          ctx.save();
          ctx.translate(c.x, c.y); ctx.scale(pulseScl, pulseScl); ctx.translate(-c.x, -c.y);
          if (isPulse) { ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 24 * pf; }
          ctx.fillStyle = isPulse ? 'rgba(255,210,50,0.4)' : 'rgba(50,210,110,0.18)';
          ctx.beginPath(); ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 10); ctx.fill();
          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
          ctx.strokeStyle = isPulse ? `rgba(255,215,0,${pf})` : 'rgba(50,210,110,0.55)';
          ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 10); ctx.stroke();
          ctx.fillStyle = isPulse ? '#fff' : 'rgba(255,255,255,0.82)';
          ctx.font = `${c.h * 0.52}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.icon, c.x, c.y);
          ctx.restore();
          return;
        }
        const scl = isCur ? 1.08 : 1;
        ctx.save();
        ctx.translate(c.x, c.y); ctx.scale(scl, scl); ctx.translate(-c.x, -c.y);
        if (c.previewFlip.active) {
          drawPreviewFlipOut(ctx, c, isCur);
        } else if (c.flipped) {
          drawCardFront(ctx, c, isCur);
        } else {
          drawCardBack(ctx, c, isCur);
        }
        ctx.restore();
      }); } // end two-pass loop

      // Expanding ring bursts on match
      for (const rb of ringBursts) {
        const prog = 1 - rb.life / rb.maxLife;
        const curR = rb.targetR * Math.min(1, prog * 1.6);
        const alpha = (rb.life / rb.maxLife) * 0.85;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.strokeStyle = rb.color;
        ctx.lineWidth = 3.5 * (rb.life / rb.maxLife);
        ctx.beginPath(); ctx.arc(rb.x, rb.y, Math.max(1, curR), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      renderParticles(ctx, particles);

      if (phase === 'preview') {
        const { minX, maxX, minY } = getBoardBounds();
        const count = Math.max(1, Math.ceil(previewTimer));
        const radius = Math.max(22, Math.min(36, Math.min(w, h) * 0.06));
        const desiredLeftX = minX - radius - 14;
        const desiredRightX = maxX + radius + 14;
        const x = desiredRightX + radius <= w - 8 ? desiredRightX : Math.max(radius + 8, desiredLeftX);
        const y = Math.max(radius + 10, minY + radius * 0.15);

        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(8, 16, 32, 0.72)';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFD166';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.floor(radius * 1.15)}px Fredoka One, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(count), x, y + 1);
        ctx.restore();
      }
    },

    getCurrentTurnSide() { return getCurrentSide(turn); },
    shouldPauseTurnTimer() { return phase === 'preview' || phase === 'previewFlipOut'; },
    getTurnMessage() { return turnMessage; },
    getPlayerStates() { return players; },
    isFinished() { return phase === 'finished' && finishDelay <= 0; },
    getResults() { return buildResults(1, false, players, stats); },
    cleanup() {},
  };
}
