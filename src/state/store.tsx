import { createContext, useContext, useReducer, useEffect, useState, type ReactNode } from 'react';
import type { Side } from '../engine/utils';
import { generateId } from '../engine/utils';
import { dbGet, dbSet } from '../engine/db';

/* ── Types ── */
export type Scene = 'launch' | 'profiles' | 'setup' | 'selectGame' | 'tutorial' | 'game' | 'results';

export interface PlayerProfile {
  id: string;
  name: string;
  avatarId: number;
  color: string;
  lastUsedAt: number;
}

export interface Settings {
  mute: boolean;
  volume: number;
  kidMode: boolean;
  highContrast: boolean;
  showDebugRegions: boolean;
  turnDirection: 'clockwise' | 'counter-clockwise';
  turnTimer: number; // 0 = off, else seconds per turn
  boardTheme: 'jungle' | 'desert' | 'iceage';
  complexity: 'low' | 'medium';
}

export interface PlayerResult {
  id: string;
  name: string;
  avatarId: number;
  color: string;
  side: Side;
  score: number;
  rank: number;
  stats: Record<string, number>;
}

export interface GameResultsData {
  gameId: number;
  gameName: string;
  coop: boolean;
  sharedScore?: number;
  playerResults: PlayerResult[];
}

export interface AppState {
  scene: Scene;
  numberOfPlayers: number;
  playerProfiles: PlayerProfile[];
  selectedPlayerIds: string[];
  selectedGame: number;
  settings: Settings;
  gameResults: GameResultsData | null;
}

/* ── Defaults ── */
const defaultSettings: Settings = {
  mute: false,
  volume: 0.7,
  kidMode: true,
  highContrast: false,
  showDebugRegions: false,
  turnDirection: 'clockwise',
  turnTimer: 0,
  boardTheme: 'jungle',
  complexity: 'low',
};

export function createDefaultProfile(index: number, color: string): PlayerProfile {
  const names = ['Red Rex', 'Blue Bronto', 'Green Giga', 'Yellow Yoshi', 'Purple Ptera', 'Teal Trike'];
  return {
    id: generateId(),
    name: names[index % names.length],
    avatarId: index % 12,
    color,
    lastUsedAt: Date.now(),
  };
}

/* ── Actions ── */
type Action =
  | { type: 'SET_SCENE'; scene: Scene }
  | { type: 'SET_NUM_PLAYERS'; count: number }
  | { type: 'SET_SELECTED_PLAYERS'; ids: string[] }
  | { type: 'SET_GAME'; gameId: number }
  | { type: 'ADD_PROFILE'; profile: PlayerProfile }
  | { type: 'UPDATE_PROFILE'; id: string; updates: Partial<PlayerProfile> }
  | { type: 'DELETE_PROFILE'; id: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'SET_RESULTS'; results: GameResultsData }
  | { type: 'HYDRATE'; payload: Partial<AppState> };

/* ── Reducer ── */
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SCENE': return { ...state, scene: action.scene };
    case 'SET_NUM_PLAYERS': return { ...state, numberOfPlayers: action.count };
    case 'SET_SELECTED_PLAYERS': return { ...state, selectedPlayerIds: action.ids };
    case 'SET_GAME': return { ...state, selectedGame: action.gameId };
    case 'ADD_PROFILE': return { ...state, playerProfiles: [...state.playerProfiles, action.profile] };
    case 'UPDATE_PROFILE':
      return {
        ...state,
        playerProfiles: state.playerProfiles.map(p =>
          p.id === action.id ? { ...p, ...action.updates } : p,
        ),
      };
    case 'DELETE_PROFILE':
      return { ...state, playerProfiles: state.playerProfiles.filter(p => p.id !== action.id) };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'SET_RESULTS': return { ...state, gameResults: action.results, scene: 'results' };
    case 'HYDRATE':     return { ...state, ...action.payload };
    default: return state;
  }
}

/* ── Storage (IndexedDB) ── */
const STORAGE_KEY     = 'dino-party-pad';
const STORAGE_VERSION = 2;

type StoredData = {
  version: number;
  playerProfiles: PlayerProfile[];
  settings: Settings;
  numberOfPlayers: number;
  selectedPlayerIds: string[];
};

function parseStoredData(data: StoredData): Partial<AppState> {
  if (data.version === 1)                                    data.settings = { ...defaultSettings, ...data.settings, turnTimer: 0 };
  if ((data.settings?.boardTheme as string) === 'volcano')   data.settings.boardTheme = 'desert';
  if (data.version < STORAGE_VERSION)            data.version = STORAGE_VERSION;
  return {
    playerProfiles:    data.playerProfiles    || [],
    settings:          { ...defaultSettings, ...data.settings },
    numberOfPlayers:   data.numberOfPlayers   || 2,
    selectedPlayerIds: data.selectedPlayerIds || [],
  };
}

async function loadFromIDB(): Promise<Partial<AppState>> {
  try {
    // Try IDB first
    const idbData = await dbGet<StoredData>(STORAGE_KEY);
    if (idbData) return parseStoredData(idbData);

    // One-time migration: pull any existing localStorage data into IDB
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const parsed: StoredData = JSON.parse(legacy);
      await dbSet(STORAGE_KEY, parsed);
      localStorage.removeItem(STORAGE_KEY);
      return parseStoredData(parsed);
    }
  } catch { /* ignore */ }
  return {};
}

async function saveState(state: AppState): Promise<void> {
  try {
    await dbSet(STORAGE_KEY, {
      version:           STORAGE_VERSION,
      playerProfiles:    state.playerProfiles,
      settings:          state.settings,
      numberOfPlayers:   state.numberOfPlayers,
      selectedPlayerIds: state.selectedPlayerIds,
    } satisfies StoredData);
  } catch { /* ignore */ }
}

/* ── Context ── */
const defaultInitialState: AppState = {
  scene: 'launch',
  numberOfPlayers: 2,
  playerProfiles: [],
  selectedPlayerIds: [],
  selectedGame: 0,
  settings: defaultSettings,
  gameResults: null,
};

interface StoreCtx { state: AppState; dispatch: React.Dispatch<Action>; }
const Ctx = createContext<StoreCtx>({ state: defaultInitialState, dispatch: () => {} });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultInitialState);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state from IDB once on mount
  useEffect(() => {
    loadFromIDB().then(saved => {
      if (Object.keys(saved).length > 0) {
        dispatch({ type: 'HYDRATE', payload: saved });
      }
      setHydrated(true);
    });
  }, []);

  // Persist to IDB on every state change (only after initial hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  // Hold rendering until IDB data is available
  if (!hydrated) return null;

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() { return useContext(Ctx); }
