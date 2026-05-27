import type { Side } from './utils';

export interface ButtonInput {
  pressed: boolean;
  justPressed: boolean;
  justReleased: boolean;
  holdTime: number;
}

function emptyInput(): ButtonInput {
  return { pressed: false, justPressed: false, justReleased: false, holdTime: 0 };
}

class InputManager {
  private states = new Map<Side, { cur: boolean; prev: boolean; holdTime: number }>();

  constructor() {
    for (const s of ['top', 'bottom', 'left', 'right'] as Side[]) {
      this.states.set(s, { cur: false, prev: false, holdTime: 0 });
    }
  }

  setPressed(side: Side, val: boolean) {
    const s = this.states.get(side);
    if (s) s.cur = val;
  }

  update(dt: number) {
    for (const s of this.states.values()) {
      if (s.cur) s.holdTime += dt;
      else s.holdTime = 0;
    }
  }

  getInput(side: Side): ButtonInput {
    const s = this.states.get(side);
    if (!s) return emptyInput();
    return {
      pressed: s.cur,
      justPressed: s.cur && !s.prev,
      justReleased: !s.cur && s.prev,
      holdTime: s.holdTime,
    };
  }

  getAllInputs(): Map<Side, ButtonInput> {
    const m = new Map<Side, ButtonInput>();
    for (const side of this.states.keys()) m.set(side, this.getInput(side));
    return m;
  }

  endFrame() {
    for (const s of this.states.values()) s.prev = s.cur;
  }

  reset() {
    for (const s of this.states.values()) {
      s.cur = false; s.prev = false; s.holdTime = 0;
    }
  }
}

export const inputManager = new InputManager();
