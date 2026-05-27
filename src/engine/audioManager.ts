type SoundName =
  | 'tap' | 'step' | 'chomp' | 'oops' | 'shield' | 'rescue' | 'climb' | 'descend'
  | 'powerup' | 'match' | 'milestone' | 'mud' | 'rumble' | 'jump' | 'countdown'
  | 'win' | 'lose' | 'megaChomp' | 'burst' | 'pull'
  | 'whoosh' | 'sparkle' | 'tick' | 'reminder';

// ── Background music (look-ahead scheduler, 130 BPM, 2-bar loop) ─────────────
const _Q = 60 / 130;               // quarter note = 0.4615 s
const _E = _Q / 2;                  // eighth note  = 0.2308 s
const LOOP_DUR = _Q * 8;            // two bars     = 3.692 s

// [startOffset(s), freq(Hz), dur(s), vol, wave]
type MNote = [number, number, number, number, OscillatorType];
const MUSIC: MNote[] = [
  // ── Melody — C major pentatonic, triangle ──────────────────────────────
  [_E * 0,  392, _E * .85, .055, 'triangle'], // G4
  [_E * 1,  392, _E * .85, .045, 'triangle'],
  [_E * 2,  330, _E * .85, .055, 'triangle'], // E4
  [_E * 4,  440, _E * .85, .065, 'triangle'], // A4
  [_E * 5,  523, _E * .85, .065, 'triangle'], // C5
  [_E * 6,  440, _E * .85, .055, 'triangle'], // A4
  [_E * 7,  392, _Q * .85, .060, 'triangle'], // G4 (quarter, ties across bar)
  [_E * 9,  392, _E * .85, .055, 'triangle'],
  [_E * 10, 330, _E * .85, .055, 'triangle'], // E4
  [_E * 11, 392, _E * .85, .055, 'triangle'], // G4
  [_E * 13, 523, _E * .85, .075, 'triangle'], // C5
  [_E * 14, 440, _E * .85, .060, 'triangle'], // A4
  [_E * 15, 392, _E * .80, .055, 'triangle'], // G4
  // ── Bass — sine, quarter notes ─────────────────────────────────────────
  [_Q * 0,  131, _Q * .75, .070, 'sine'],  // C3
  [_Q * 1,  196, _Q * .75, .055, 'sine'],  // G3
  [_Q * 2,  175, _Q * .75, .055, 'sine'],  // F3
  [_Q * 3,  196, _Q * .75, .055, 'sine'],  // G3
  [_Q * 4,  131, _Q * .75, .070, 'sine'],  // C3
  [_Q * 5,  196, _Q * .75, .055, 'sine'],  // G3
  [_Q * 6,  147, _Q * .75, .055, 'sine'],  // D3
  [_Q * 7,  196, _Q * .75, .055, 'sine'],  // G3
  // ── Soft accent clicks — rhythmic pulse ────────────────────────────────
  [_Q * 0,  900, .018, .025, 'square'],
  [_Q * 2,  800, .018, .022, 'square'],
  [_Q * 4,  900, .018, .025, 'square'],
  [_Q * 6,  800, .018, .022, 'square'],
];

class AudioManager {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private _muted = false;
  private _volume = 0.7;
  private _unlocked = false;
  // Music scheduler state
  private musicPlaying = false;
  private musicStartTime = 0;
  private loopsScheduled = 0;
  private schedTimer: ReturnType<typeof setTimeout> | null = null;

  get unlocked() { return this._unlocked; }

  async init(): Promise<boolean> {
    if (this.ctx) return this._unlocked;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this._volume;
      this.gainNode.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.gainNode);
    } catch { return false; }
    return this.tryUnlock();
  }

  async tryUnlock(): Promise<boolean> {
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* */ }
    }
    this._unlocked = this.ctx.state === 'running';
    return this._unlocked;
  }

  setVolume(v: number) {
    this._volume = v;
    if (this.gainNode) this.gainNode.gain.value = this._muted ? 0 : v;
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (this.gainNode) this.gainNode.gain.value = m ? 0 : this._volume;
  }

  // ── Sound effects ──────────────────────────────────────────────────────────
  play(name: SoundName) {
    if (!this.ctx || !this.gainNode || !this._unlocked || this._muted) return;
    switch (name) {
      // ── UI / Rhythm ──────────────────────────────────────────────────────
      case 'tap':
        this.tone(1200, .040, 'square',   .28);
        this.tone(600,  .030, 'triangle', .12);
        break;
      case 'step':
        this.tone(380,  .055, 'square',   .13);
        break;
      case 'tick':
        this.tone(1100, .022, 'square',   .22);
        break;
      case 'countdown':
        this.tone(660,  .120, 'square',   .20);
        break;
      case 'reminder':
        this.tone(700,  .080, 'triangle', .18);
        this.at(.12, () => this.tone(900, .10, 'triangle', .20));
        break;

      // ── Positive events ──────────────────────────────────────────────────
      case 'powerup':
        this.tone(523,  .10, 'sine', .22);
        this.at(.08, () => this.tone(659,  .10, 'sine', .22));
        this.at(.16, () => this.tone(784,  .10, 'sine', .22));
        this.at(.24, () => this.tone(1047, .18, 'sine', .28));
        break;

      case 'match':   // card-match — magical sparkle chord
        this.chord([523, 659, 784], .50, 'sine', .16);
        this.at(.20, () => this.tone(1047, .28, 'triangle', .20));
        this.at(.30, () => this.tone(1319, .22, 'triangle', .16));
        this.at(.40, () => this.tone(1568, .18, 'triangle', .13));
        break;

      case 'milestone':   // achievement fanfare
        this.tone(587,  .09, 'square', .22);
        this.at(.10, () => this.tone(740,  .09, 'square', .22));
        this.at(.20, () => this.tone(880,  .09, 'square', .22));
        this.at(.28, () => this.chord([587, 740, 880], .42, 'sine', .18));
        this.at(.42, () => this.tone(1175, .24, 'triangle', .15));
        break;

      case 'sparkle':
        this.tone(1047, .18, 'sine', .18);
        this.at(.06, () => this.tone(1319, .18, 'sine', .16));
        this.at(.12, () => this.tone(1568, .22, 'sine', .16));
        this.at(.18, () => this.tone(2093, .20, 'sine', .12));
        break;

      case 'rescue':
        this.sweep(320, 680, .28, 'sine', .22);
        this.at(.22, () => this.tone(680, .14, 'triangle', .15));
        break;

      case 'climb':    // ladder / ascending
        this.sweep(200, 920, .36, 'sine', .26);
        this.at(.30, () => this.tone(920, .14, 'triangle', .18));
        break;

      case 'shield':
        this.chord([600, 900], .18, 'sine', .18);
        this.at(.05, () => this.tone(1200, .12, 'triangle', .12));
        break;

      case 'jump':
        this.sweep(280, 840, .18, 'sine', .24);
        this.at(.15, () => this.tone(840, .10, 'triangle', .14));
        break;

      case 'pull':
        this.sweep(400, 620, .14, 'triangle', .18);
        this.at(.10, () => this.noise(.05, .18));
        break;

      // ── Negative / neutral events ─────────────────────────────────────────
      case 'oops':
        this.sweep(520, 310, .20, 'square', .20);
        this.at(.18, () => this.sweep(310, 175, .22, 'square', .15));
        break;

      case 'descend':    // snake slide — fun wheee
        this.sweep(720, 175, .48, 'sine', .26);
        break;

      case 'lose':
        this.sweep(523, 392, .18, 'sawtooth', .18);
        this.at(.16, () => this.sweep(392, 294, .18, 'sawtooth', .15));
        this.at(.32, () => this.sweep(294, 196, .22, 'sawtooth', .12));
        this.at(.40, () => this.noise(.12, .08));
        break;

      // ── Big / dramatic events ─────────────────────────────────────────────
      case 'win':
        this.tone(523,  .08, 'sine', .28);
        this.at(.08, () => this.tone(659,  .08, 'sine', .28));
        this.at(.16, () => this.tone(784,  .08, 'sine', .28));
        this.at(.24, () => this.tone(1047, .08, 'sine', .28));
        this.at(.30, () => this.chord([523, 659, 784, 1047], .55, 'sine', .20));
        this.at(.78, () => {
          this.tone(1047, .20, 'triangle', .20);
          this.at(.07, () => this.tone(1319, .20, 'triangle', .18));
          this.at(.14, () => this.tone(1568, .25, 'triangle', .16));
        });
        break;

      case 'burst':   // Dino Roar / risky roll
        this.noise(.14, .38);
        this.sweep(120, 900, .22, 'sawtooth', .32);
        this.at(.08, () => this.tone(700, .14, 'square', .20));
        break;

      case 'megaChomp':
        this.noise(.12, .40);
        this.sweep(150, 700, .24, 'sawtooth', .30);
        this.at(.18, () => this.sweep(700, 100, .16, 'sawtooth', .20));
        break;

      case 'whoosh':
        this.sweep(160, 2400, .18, 'sine', .16);
        this.noise(.14, .10);
        break;

      case 'chomp':
        this.sweep(380, 160, .14, 'sawtooth', .22);
        this.noise(.10, .20);
        break;

      case 'mud':
        this.tone(80,  .18, 'sine', .28);
        this.noise(.14, .22);
        break;

      case 'rumble':
        this.tone(55,  .28, 'sine', .22);
        this.tone(75,  .28, 'sine', .18);
        this.noise(.20, .14);
        break;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  private at(delaySec: number, fn: () => void) {
    setTimeout(fn, delaySec * 1000);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.gainNode) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.gainNode);
    o.start(t); o.stop(t + dur + 0.01);
  }

  private sweep(f1: number, f2: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.gainNode) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.linearRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.gainNode);
    o.start(t); o.stop(t + dur + 0.01);
  }

  private chord(freqs: number[], dur: number, type: OscillatorType, vol: number) {
    const v = (vol * 1.4) / freqs.length;
    freqs.forEach(f => this.tone(f, dur, type, v));
  }

  private noise(dur: number, vol: number) {
    if (!this.ctx || !this.gainNode) return;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(g); g.connect(this.gainNode);
    src.start(t); src.stop(t + dur + 0.01);
  }

  // ── Background music ───────────────────────────────────────────────────────
  startMusic() {
    if (!this.ctx || !this.musicGain || !this._unlocked || this.musicPlaying) return;
    this.musicPlaying = true;
    this.loopsScheduled = 0;
    this.musicStartTime = this.ctx.currentTime + 0.15;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(0, now);
    this.musicGain.gain.linearRampToValueAtTime(0.14, now + 3.0); // 3 s fade-in
    this.runScheduler();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.schedTimer !== null) { clearTimeout(this.schedTimer); this.schedTimer = null; }
    if (this.musicGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(0, now + 0.8); // 0.8 s fade-out
    }
  }

  private runScheduler() {
    if (!this.ctx || !this.musicGain || !this.musicPlaying) return;
    const now = this.ctx.currentTime;
    const LOOKAHEAD = 0.30;
    while ((this.loopsScheduled * LOOP_DUR + this.musicStartTime) < now + LOOKAHEAD) {
      const loopStart = this.loopsScheduled * LOOP_DUR + this.musicStartTime;
      for (const [offset, freq, dur, vol, wave] of MUSIC) {
        const when = loopStart + offset;
        if (when >= now - 0.05) this.musicNote(freq, when, dur, vol, wave);
      }
      this.loopsScheduled++;
    }
    this.schedTimer = setTimeout(() => this.runScheduler(), 55);
  }

  private musicNote(freq: number, when: number, dur: number, vol: number, type: OscillatorType) {
    if (!this.ctx || !this.musicGain) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.025);
    g.gain.setValueAtTime(vol, Math.max(when + 0.025, when + dur - 0.04));
    g.gain.linearRampToValueAtTime(0, when + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(when);
    o.stop(when + dur + 0.01);
  }
}

export const audioManager = new AudioManager();
