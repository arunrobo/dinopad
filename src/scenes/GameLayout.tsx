import { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../state/store';
import type { Side } from '../engine/utils';
import { SIDE_ASSIGNMENTS } from '../engine/utils';
import { inputManager } from '../engine/inputManager';
import { audioManager } from '../engine/audioManager';
import { startGameLoop, stopGameLoop } from '../engine/gameLoop';
import type { GameInstance, GameConfig, PlayerInGame } from './games/types';
import { GAME_NAMES } from './games/types';
import { createGame1 } from './games/Game1DinoLadder';
import { createGame2 } from './games/Game2FossilFlip';
import { createGame3 } from './games/Game3VolcanoDiceDash';
import { createGame4 } from './games/Game4SaveBabyDinos';
import CenterCanvas from '../ui/CenterCanvas';
import BigEdgeButton from '../ui/BigEdgeButton';
import TurnBanner from '../ui/TurnBanner';
import Modal from '../ui/Modal';
import SettingsPanel from '../ui/SettingsPanel';

const CREATORS = [createGame1, createGame2, createGame3, createGame4];

export default function GameLayout() {
  const { state, dispatch } = useStore();
  const gameRef = useRef<GameInstance | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const turnTimerRef = useRef(0);
  const prevSideRef = useRef<Side | null>(null);
  const [activeSide, setActiveSide] = useState<Side>('bottom');
  const [turnMsg, setTurnMsg] = useState('');
  const [playerStates, setPlayerStates] = useState<PlayerInGame[]>([]);
  const [timerValue, setTimerValue] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [transition, setTransition] = useState(false);

  const { settings, selectedGame, selectedPlayerIds, playerProfiles } = state;
  const sides = SIDE_ASSIGNMENTS[selectedPlayerIds.length] || ['bottom'];

  const buildPlayers = useCallback((): PlayerInGame[] => {
    return selectedPlayerIds.map((pid, i) => {
      const p = playerProfiles.find(pr => pr.id === pid);
      return {
        id: pid,
        name: p?.name || `Player ${i + 1}`,
        avatarId: p?.avatarId ?? i,
        color: p?.color || '#4A90D9',
        side: sides[i],
        score: 0,
        lives: 3,
      };
    });
  }, [selectedPlayerIds, playerProfiles, sides]);

  const handleCanvas = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    const game = CREATORS[selectedGame]();
    gameRef.current = game;
    const rect = canvas.getBoundingClientRect();
    const players = buildPlayers();
    const cfg: GameConfig = {
      players,
      kidMode: settings.kidMode,
      turnDirection: settings.turnDirection,
      turnTimer: settings.turnTimer,
      boardTheme: settings.boardTheme,
      complexity: settings.complexity ?? 'low',
    };
    game.init(cfg, rect.width, rect.height);
    audioManager.startMusic();
    turnTimerRef.current = settings.turnTimer;
    setPlayerStates(players);

    startGameLoop((dt) => {
      inputManager.update(dt);
      const g = gameRef.current;
      if (!g) return;

      const curSide = g.getCurrentTurnSide();
      const pauseTurnTimer = g.shouldPauseTurnTimer?.() ?? false;

      // Zero non-active inputs
      const allInputs = inputManager.getAllInputs();
      const filtered = new Map<Side, import('./games/types').ButtonInput>();
      for (const [s, inp] of allInputs) {
        if (s === curSide) filtered.set(s, inp);
        else filtered.set(s, { pressed: false, justPressed: false, justReleased: false, holdTime: 0 });
      }

      // Turn timer
      if (settings.turnTimer > 0 && !g.isFinished() && !pauseTurnTimer) {
        turnTimerRef.current -= dt;
        if (turnTimerRef.current <= 5 && turnTimerRef.current > 4.9) audioManager.play('reminder');
        if (turnTimerRef.current <= 3) audioManager.play('tick');
        if (turnTimerRef.current <= 0) {
          // Auto-advance: simulate a tap so game advances turn
          filtered.set(curSide, { pressed: true, justPressed: true, justReleased: false, holdTime: 0 });
          turnTimerRef.current = settings.turnTimer;
        }
      } else if (pauseTurnTimer) {
        turnTimerRef.current = settings.turnTimer;
      }

      g.update(dt, filtered);
      inputManager.endFrame();

      // Detect turn change
      const newSide = g.getCurrentTurnSide();
      if (prevSideRef.current && newSide !== prevSideRef.current) {
        turnTimerRef.current = settings.turnTimer;
        audioManager.play('whoosh');
        setTimeout(() => audioManager.play('sparkle'), 200);
        setTransition(true);
        setTimeout(() => setTransition(false), 400);
      }
      prevSideRef.current = newSide;
      setActiveSide(newSide);
      setTurnMsg(g.getTurnMessage?.() || '');
      setTimerValue(Math.max(0, turnTimerRef.current));
      setPlayerStates(g.getPlayerStates());

      // Render
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) {
          const r = c.getBoundingClientRect();
          ctx.clearRect(0, 0, r.width, r.height);
          g.render(ctx, r.width, r.height);
        }
      }

      // Check finished
      if (g.isFinished()) {
        audioManager.stopMusic();
        stopGameLoop();
        dispatch({ type: 'SET_RESULTS', results: g.getResults() });
      }
    });
  }, [selectedGame, buildPlayers, settings, dispatch]);

  useEffect(() => {
    return () => {
      audioManager.stopMusic();
      stopGameLoop();
      gameRef.current?.cleanup();
      inputManager.reset();
    };
  }, []);

  const activePlayer = playerStates.find(p => p.side === activeSide);

  const activeSides = playerStates.map(p => p.side);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#111', overflow: 'hidden' }}>
      <CenterCanvas onCanvas={handleCanvas} activeSides={activeSides} />

      {/* Turn transition overlay */}
      {transition && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)',
          animation: 'fadeIn 0.3s ease-out',
        }} />
      )}

      {/* Edge buttons with integrated player info */}
      {playerStates.map(p => (
        <BigEdgeButton
          key={p.side}
          side={p.side}
          color={p.color}
          active={p.side === activeSide}
          playerName={p.name}
          avatarId={p.avatarId}
          score={p.score}
        />
      ))}

      {/* Turn banner */}
      {activePlayer && (
        <TurnBanner
          playerName={activePlayer.name}
          avatarId={activePlayer.avatarId}
          color={activePlayer.color}
          message={turnMsg}
          timerValue={settings.turnTimer > 0 ? timerValue : undefined}
          timerMax={settings.turnTimer > 0 ? settings.turnTimer : undefined}
        />
      )}

      {/* Hamburger menu button */}
      <button
        onClick={() => setShowMenu(v => !v)}
        style={{
          position: 'absolute', top: 'calc(8px + env(safe-area-inset-top))', left: 'calc(8px + env(safe-area-inset-left))', zIndex: 60,
          width: 36, height: 36, borderRadius: '10px',
          background: showMenu ? 'rgba(255,215,0,0.25)' : 'rgba(0,0,0,0.6)',
          border: showMenu ? '2px solid #FFD700' : '2px solid rgba(255,255,255,0.3)',
          color: 'white', fontSize: '1.1rem', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          transition: 'background 0.2s, border 0.2s',
        }}
      >
        <span style={{ display: 'block', width: 16, height: 2, background: 'white', borderRadius: 2, transition: 'transform 0.2s', transform: showMenu ? 'translateY(6px) rotate(45deg)' : 'none' }} />
        <span style={{ display: 'block', width: 16, height: 2, background: 'white', borderRadius: 2, transition: 'opacity 0.2s', opacity: showMenu ? 0 : 1 }} />
        <span style={{ display: 'block', width: 16, height: 2, background: 'white', borderRadius: 2, transition: 'transform 0.2s', transform: showMenu ? 'translateY(-6px) rotate(-45deg)' : 'none' }} />
      </button>

      {/* Flyout menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div onClick={() => setShowMenu(false)} style={{ position: 'absolute', inset: 0, zIndex: 58 }} />
          <div style={{
            position: 'absolute', top: 'calc(52px + env(safe-area-inset-top))', left: 'calc(8px + env(safe-area-inset-left))', zIndex: 59,
            background: 'linear-gradient(160deg, #1a2e1a, #0d1f0d)',
            border: '1.5px solid rgba(255,255,255,0.15)',
            borderRadius: 16, padding: '8px 6px',
            display: 'flex', flexDirection: 'column', gap: 4,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            minWidth: 160,
            animation: 'scaleIn 0.15s ease',
          }}>
            {([
              { label: '▶  Resume', color: '#4CAF50', action: () => setShowMenu(false) },
              { label: '\u2699  Settings', color: '#64B5F6', action: () => { setShowMenu(false); setShowSettings(true); } },
              { label: '🎮  Change Game', color: '#FFB74D', action: () => { stopGameLoop(); gameRef.current?.cleanup(); inputManager.reset(); setShowMenu(false); dispatch({ type: 'SET_SCENE', scene: 'selectGame' }); } },
              { label: '🏠  Home', color: '#EF5350', action: () => { stopGameLoop(); gameRef.current?.cleanup(); inputManager.reset(); setShowMenu(false); dispatch({ type: 'SET_SCENE', scene: 'launch' }); } },
            ] as { label: string; color: string; action: () => void }[]).map(item => (
              <button key={item.label} onClick={item.action} style={{
                display: 'block', width: '100%',
                padding: '10px 14px', borderRadius: 10,
                background: 'transparent', border: 'none',
                color: item.color, fontSize: '0.95rem', fontWeight: 700,
                fontFamily: "'Fredoka One', cursive",
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >{item.label}</button>
            ))}
          </div>
        </>
      )}

      {/* Help button */}
      <button
        onClick={() => setShowHelp(true)}
        style={{
          position: 'absolute', top: 'calc(8px + env(safe-area-inset-top))', right: 'calc(8px + env(safe-area-inset-right))', zIndex: 60,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.3)',
          color: 'white', fontSize: '1.2rem', cursor: 'pointer',
        }}
      >?</button>

      <Modal open={showHelp} onClose={() => setShowHelp(false)} title={GAME_NAMES[selectedGame]}>
        <div style={{ fontSize: '0.9rem', lineHeight: 1.6, maxWidth: 320 }}>
          {selectedGame === 0 && <p>TAP to roll dice. HOLD (first time) for Dino Roar reroll! Climb 🦶 trails, avoid 💦 mud slides. First to FINISH wins!</p>}
          {selectedGame === 1 && <p>Cursor highlights cards. TAP to flip. Match pairs to score and go again. Miss = next turn. HOLD to toggle cursor speed.</p>}
          {selectedGame === 2 && <p>TAP = safe roll. HOLD = risky roll (bonus dice but might stumble!). Land on 🥚 eggs or 🐉 pterodactyls for boosts. Avoid 🌋 lava!</p>}
          {selectedGame === 3 && <p>Co-op! TAP = rescue nearest baby dino. HOLD = shield (pushes babies away from hazards). Save enough babies before rounds run out!</p>}
        </div>
        <button onClick={() => setShowHelp(false)} style={{
          marginTop: 16, padding: '8px 24px', borderRadius: 8,
          background: '#4A90D9', border: 'none', color: 'white', fontSize: '1rem', cursor: 'pointer',
        }}>Got it!</button>
      </Modal>

      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Settings">
        <SettingsPanel />
      </Modal>
    </div>
  );
}
