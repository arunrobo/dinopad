import type { Side } from './utils';
import { CLOCKWISE_ORDER } from './utils';

export interface TurnState {
  currentIndex: number;
  direction: 1 | -1;
  activeSides: Side[];
}

export function createTurnState(
  sides: Side[],
  dir: 'clockwise' | 'counter-clockwise',
): TurnState {
  const ordered = CLOCKWISE_ORDER.filter(s => sides.includes(s));
  return { currentIndex: 0, direction: dir === 'clockwise' ? 1 : -1, activeSides: ordered };
}

export function getCurrentSide(t: TurnState): Side {
  return t.activeSides[t.currentIndex];
}

export function advanceTurn(t: TurnState): TurnState {
  const len = t.activeSides.length;
  const next = ((t.currentIndex + t.direction) % len + len) % len;
  return { ...t, currentIndex: next };
}
