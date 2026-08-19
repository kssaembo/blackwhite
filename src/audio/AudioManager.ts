export type AudioEvent =
  | 'buttonClick' | 'tileSelect' | 'tileSubmit' | 'opponentSubmit'
  | 'gameStart' | 'reveal' | 'roundWin' | 'roundLose' | 'roundDraw'
  | 'nextRound' | 'gameWin' | 'gameLose' | 'overtime'
  | 'connectionLost' | 'connectionRestored' | 'deductionMark';

const FILES: Partial<Record<AudioEvent, string>> = {
  gameStart: '/assets/audio/sfx/sfx_game_start.wav',
  reveal: '/assets/audio/sfx/sfx_reveal.wav',
  roundWin: '/assets/audio/sfx/sfx_round_win.wav',
  overtime: '/assets/audio/sfx/sfx_overtime.wav',
  gameWin: '/assets/audio/sfx/sfx_game_win.wav',
};

export class AudioManager {
  private context?: AudioContext;
  private enabled = true;
  private volume = 0.72;
  private cache = new Map<string, HTMLAudioElement>();

  setEnabled(enabled: boolean) { this.enabled = enabled; }
  setVolume(volume: number) { this.volume = Math.max(0, Math.min(1, volume)); }

  private ctx() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  private synth(freqs: number[], duration = .12, gain = .08, type: OscillatorType = 'sine') {
    if (!this.enabled) return;
    const ctx = this.ctx();
    const now = ctx.currentTime;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + i * .045);
      amp.gain.setValueAtTime(0.0001, now + i * .045);
      amp.gain.exponentialRampToValueAtTime(gain * this.volume, now + i * .045 + .012);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + i * .045 + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(now + i * .045);
      osc.stop(now + i * .045 + duration + .02);
    });
  }

  play(event: AudioEvent) {
    if (!this.enabled) return;
    const path = FILES[event];
    if (path) {
      let base = this.cache.get(path);
      if (!base) {
        base = new Audio(path);
        base.preload = 'auto';
        this.cache.set(path, base);
      }
      const a = base.cloneNode(true) as HTMLAudioElement;
      a.volume = this.volume;
      void a.play().catch(() => undefined);
      return;
    }

    switch (event) {
      case 'buttonClick': this.synth([620], .07, .045, 'triangle'); break;
      case 'tileSelect': this.synth([760, 980], .08, .045, 'triangle'); break;
      case 'tileSubmit': this.synth([210, 150], .14, .075, 'square'); break;
      case 'opponentSubmit': this.synth([430, 610], .12, .055, 'sine'); break;
      case 'roundLose': this.synth([240, 185], .24, .065, 'sawtooth'); break;
      case 'roundDraw': this.synth([390, 390], .16, .05, 'triangle'); break;
      case 'nextRound': this.synth([520, 680], .09, .035, 'sine'); break;
      case 'gameLose': this.synth([250, 190, 140], .28, .06, 'triangle'); break;
      case 'connectionLost': this.synth([220, 150], .22, .075, 'square'); break;
      case 'connectionRestored': this.synth([420, 620, 840], .12, .045, 'sine'); break;
      case 'deductionMark': this.synth([900], .055, .025, 'triangle'); break;
      default: break;
    }
  }
}

export class TeacherBgmController {
  private audio = new Audio('/assets/audio/bgm/bgm_game_main.mp3');
  constructor() { this.audio.loop = true; this.audio.volume = .45; }
  async play() { await this.audio.play(); }
  pause() { this.audio.pause(); }
  restart() { this.audio.currentTime = 0; void this.audio.play(); }
  setVolume(v: number) { this.audio.volume = Math.max(0, Math.min(1, v)); }
  get paused() { return this.audio.paused; }
  get currentTime() { return this.audio.currentTime; }
}
