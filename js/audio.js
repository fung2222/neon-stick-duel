// NEON STICK DUEL sounds — all synthesized (cyber-kit SynthAudio, 'drive' music).
import { SynthAudio, mtof } from 'cyber-kit/audio/synth.js';
export class DuelAudio extends SynthAudio {
  constructor(store) { super({ store, music: 'drive' }); }
  swing(big = false) { this.noiseHit({ dur: big ? 0.18 : 0.08, vol: big ? 0.09 : 0.05, type: 'bandpass', f: big ? 1800 : 2600, f2: big ? 500 : 900, q: 1.2, a: 0.005 }); }
  hit(heavy = false) { this.noiseHit({ dur: heavy ? 0.3 : 0.1, vol: heavy ? 0.2 : 0.12, type: 'lowpass', f: heavy ? 2600 : 3200, f2: 200, q: 0.9, a: 0.002 }); this.osc({ type: 'sine', f: heavy ? 150 : 220, f2: 50, dur: heavy ? 0.3 : 0.12, vol: heavy ? 0.3 : 0.15 }); }
  parry() { this.osc({ type: 'triangle', f: 1760, dur: 0.25, vol: 0.08, send: 0.5 }); this.osc({ type: 'sine', f: 2640, t: 0.02, dur: 0.3, vol: 0.05, send: 0.5 }); }
  breakGuard() { this.osc({ type: 'sawtooth', f: 90, f2: 40, dur: 0.5, vol: 0.18, lp: 1200 }); this.noiseHit({ dur: 0.5, vol: 0.18, type: 'lowpass', f: 1500, f2: 100 }); }
  charge(c) { this.osc({ type: 'sine', f: 200 + c * 600, dur: 0.06, vol: 0.03 }); }
  full() { this.osc({ type: 'square', f: mtof(88), dur: 0.1, vol: 0.04, lp: 5000, send: 0.3 }); }
  dash() { this.noiseHit({ dur: 0.15, vol: 0.06, type: 'highpass', f: 3000, f2: 6000, a: 0.01 }); }
  jump() { this.osc({ type: 'sine', f: 300, f2: 600, dur: 0.12, vol: 0.05 }); }
  ko() { this.osc({ type: 'sine', f: 120, f2: 30, dur: 1.2, vol: 0.35 }); this.noiseHit({ dur: 1, vol: 0.2, type: 'lowpass', f: 3000, f2: 80, a: 0.003 }); }
  bell(n = 1) { for (let i = 0; i < n; i++) this.osc({ type: 'triangle', f: mtof(81), t: i * 0.22, dur: 0.5, vol: 0.08, send: 0.5 }); }
  victory() { [0, 4, 7, 12, 16].forEach((x, i) => this.osc({ type: 'square', f: mtof(67 + x), t: i * 0.09, dur: 0.28, vol: 0.05, lp: 4000, send: 0.4 })); }
  defeat() { [0, -2, -5, -9].forEach((x, i) => this.osc({ type: 'sawtooth', f: mtof(60 + x), t: i * 0.14, dur: 0.32, vol: 0.05, lp: 1400 })); }
}
