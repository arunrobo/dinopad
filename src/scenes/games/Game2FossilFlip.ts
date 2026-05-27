import type { GameInstance, GameConfig, PlayerInGame, ButtonInput, Particle } from './types';
import { buildResults, createParticle, updateParticles, renderParticles } from './types';
import type { Side } from '../../engine/utils';
import { shuffle } from '../../engine/utils';
import { createTurnState, getCurrentSide, advanceTurn, type TurnState } from '../../engine/turnManager';
import { audioManager } from '../../engine/audioManager';

const FOSSILS = ['🦴', '🦷', '🐚', '🌿', '🪨', '🐾', '🦶', '💎', '🥚', '🌋', '🦎', '🐉'];

interface Card { id: number; icon: string; pairId: number; flipped: boolean; matched: boolean; x: number; y: number; w: number; h: number; }
type Phase = 'selectFirst' | 'selectSecond' | 'showMismatch' | 'finished';

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

  function buildCards(w: number, h: number, kid: boolean) {
    const pairs = kid ? 6 : 10;
    totalPairs = pairs;
    const icons = FOSSILS.slice(0, pairs);
    const data = shuffle([...icons, ...icons]);
    const cols = kid ? 4 : 5;
    const rows = kid ? 3 : 4;
    const m = Math.min(w, h) * 0.06;
    const gw = w - m * 2, gh = h - m * 2;
    const cw = gw / cols - 6, ch = gh / rows - 6;
    cards = data.map((icon, i) => ({
      id: i, icon, pairId: icons.indexOf(icon), flipped: false, matched: false,
      x: m + (i % cols) * (cw + 6) + cw / 2,
      y: m + Math.floor(i / cols) * (ch + 6) + ch / 2,
      w: cw, h: ch,
    }));
  }

  function unmatchedIndices() { return cards.map((c, i) => c.matched ? -1 : i).filter(i => i >= 0); }

  function advCursor() {
    const u = unmatchedIndices(); if (!u.length) return;
    const pos = u.indexOf(cursorIdx);
    cursorIdx = pos >= 0 ? u[(pos + 1) % u.length] : u[0];
  }

  return {
    init(cfg, w, h) {
      players = cfg.players;
      turn = createTurnState(players.map(p => p.side), cfg.turnDirection);
      buildCards(w, h, cfg.kidMode);
      cursorSpeed = cfg.kidMode ? 1.0 : 0.7;
      players.forEach(p => { p.score = 0; stats.set(p.id, { pairs: 0, misses: 0 }); });
      phase = 'selectFirst'; turnMessage = 'TAP to pick a card!'; cursorIdx = 0; matchedCount = 0;
    },

    update(dt, inputs) {
      particles = updateParticles(particles, dt);
      if (phase === 'finished') { finishDelay -= dt; return; }
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
                stats.get(cp.id)!.pairs++; audioManager.play('powerup'); turnMessage = 'MATCH! 🎉 Go again!';
                for (let i = 0; i < 8; i++) { particles.push(createParticle(c1.x, c1.y, cp.color)); particles.push(createParticle(c2.x, c2.y, cp.color)); }
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
      ctx.fillStyle = '#1a2a3a'; ctx.fillRect(0, 0, w, h);
      cards.forEach((c, i) => {
        if (c.matched) {
          ctx.fillStyle = 'rgba(76,175,80,0.15)'; ctx.beginPath(); ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 8); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = `${c.h * 0.4}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.icon, c.x, c.y); return;
        }
        const isCur = i === cursorIdx && (phase === 'selectFirst' || phase === 'selectSecond');
        if (c.flipped) {
          ctx.fillStyle = '#f5f0e0'; ctx.beginPath(); ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 8); ctx.fill();
          ctx.strokeStyle = '#8B7355'; ctx.lineWidth = 2; ctx.stroke();
          ctx.font = `${c.h * 0.45}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#333'; ctx.fillText(c.icon, c.x, c.y);
        } else {
          ctx.fillStyle = isCur ? '#5C7A9D' : '#3a5a7a'; ctx.beginPath(); ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 8); ctx.fill();
          ctx.strokeStyle = isCur ? '#FFD700' : '#2a4a6a'; ctx.lineWidth = isCur ? 3 : 1.5; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = `${c.h * 0.3}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🦴', c.x, c.y);
        }
        if (isCur) {
          ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.roundRect(c.x - c.w / 2 - 3, c.y - c.h / 2 - 3, c.w + 6, c.h + 6, 10); ctx.stroke(); ctx.setLineDash([]);
        }
      });
      renderParticles(ctx, particles);
    },

    getCurrentTurnSide() { return getCurrentSide(turn); },
    getTurnMessage() { return turnMessage; },
    getPlayerStates() { return players; },
    isFinished() { return phase === 'finished' && finishDelay <= 0; },
    getResults() { return buildResults(1, false, players, stats); },
    cleanup() {},
  };
}
