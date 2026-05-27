type SoundName =
  | 'tap' | 'chomp' | 'oops' | 'shield' | 'rescue' | 'pull'
  | 'powerup' | 'mud' | 'rumble' | 'jump' | 'countdown'
  | 'win' | 'lose' | 'megaChomp' | 'burst'
  | 'whoosh' | 'sparkle' | 'tick' | 'reminder';

class AudioManager {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private _muted = false;
  private _volume = 0.7;
  private _unlocked = false;
  private musicOscs: OscillatorNode[] = [];
  private musicPlaying = false;

  get unlocked() { return this._unlocked; }

  async init(): Promise<boolean> {
    if (this.ctx) return this._unlocked;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this._volume;
      this.gainNode.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.12;
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

  play(name: SoundName) {
    if (!this.ctx || !this.gainNode || !this._unlocked || this._muted) return;
    switch (name) {
      case 'tap': this.playTone(800, 0.05, 'square', 0.25); break;
      case 'chomp': this.playSweep(200, 600, 0.1, 'sawtooth', 0.25); break;
      case 'oops': this.playSweep(500, 200, 0.15, 'square', 0.2); break;
      case 'shield': this.playTone(600, 0.15, 'sine', 0.2); break;
      case 'rescue': this.playSweep(400, 800, 0.12, 'sine', 0.25); break;
      case 'pull': this.playSweep(300, 500, 0.08, 'triangle', 0.2); break;
      case 'powerup': this.playSweep(500, 1200, 0.15, 'square', 0.2); break;
      case 'mud': this.playNoise(0.12, 0.15); break;
      case 'rumble': this.playNoise(0.2, 0.1); break;
      case 'jump': this.playSweep(300, 900, 0.1, 'sine', 0.25); break;
      case 'countdown': this.playTone(440, 0.12, 'square', 0.3); break;
      case 'win': this.playChord([523, 659, 784], 0.4, 'sine', 0.25); break;
      case 'lose': this.playChord([220, 196, 165], 0.4, 'sawtooth', 0.15); break;
      case 'megaChomp': this.playSweep(150, 800, 0.2, 'sawtooth', 0.3); break;
      case 'burst': this.playNoise(0.15, 0.25); break;
      case 'whoosh': this.playSweep(200, 1000, 0.18, 'sine', 0.15); break;
      case 'sparkle': this.playChord([1047, 1319, 1568], 0.2, 'sine', 0.15); break;
      case 'tick': this.playTone(1000, 0.03, 'square', 0.15); break;
      case 'reminder': this.playSweep(600, 800, 0.1, 'triangle', 0.2); break;
    }
  }

  private playTone(freq: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.gainNode) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.gainNode);
    o.start(); o.stop(this.ctx.currentTime + dur + 0.01);
  }

  private playSweep(f1: number, f2: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.gainNode) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, this.ctx.currentTime);
    o.frequency.linearRampToValueAtTime(f2, this.ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.gainNode);
    o.start(); o.stop(this.ctx.currentTime + dur + 0.01);
  }

  private playChord(freqs: number[], dur: number, type: OscillatorType, vol: number) {
    freqs.forEach(f => this.playTone(f, dur, type, vol / freqs.length));
  }

  private playNoise(dur: number, vol: number) {
    if (!this.ctx || !this.gainNode) return;
    const len = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * vol;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(g); g.connect(this.gainNode);
    src.start(); src.stop(this.ctx.currentTime + dur + 0.01);
  }

  startMusic() {
    if (!this.ctx || !this.musicGain || this.musicPlaying) return;
    this.musicPlaying = true;
    const notes = [262, 294, 330, 349, 392, 349, 330, 294];
    let idx = 0;
    const playNote = () => {
      if (!this.musicPlaying || !this.ctx || !this.musicGain) return;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = notes[idx % notes.length];
      o.connect(this.musicGain);
      o.start();
      o.stop(this.ctx.currentTime + 0.3);
      idx++;
      this.musicOscs.push(o);
      if (this.musicPlaying) setTimeout(playNote, 400);
    };
    playNote();
  }

  stopMusic() {
    this.musicPlaying = false;
    this.musicOscs.forEach(o => { try { o.stop(); } catch {} });
    this.musicOscs = [];
  }
}

export const audioManager = new AudioManager();
