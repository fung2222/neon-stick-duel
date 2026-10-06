// NEON STICK DUEL v2 sounds — all synthesised on cyber-kit SynthAudio ('drive' music).
// Loudness lives in the kit v0.3.0 chain (music ≈ -20 LUFS, SFX/BGM ≈ 0 dB via sfxTrimDb); per-sound levels below stay relative.
import { SynthAudio, mtof } from 'cyber-kit/audio/synth.js';
export class DuelAudio extends SynthAudio {
  constructor(store) { super({ store, music: 'drive', sfxTrimDb: 0 }); }   // measured: SFX/BGM +0.1 dB at trim 0 (kit v0.3.0 meter)
  /** swing / cast sound for a move of class cls */
  swing(cls, kind = 'basic') {
    const big = kind !== 'basic' && kind !== 'air';
    if (cls === 'sword') this.noiseHit({ dur: big ? 0.22 : 0.11, vol: big ? 0.09 : 0.06, type: 'bandpass', f: 4200, f2: 1200, q: 2.2, a: 0.004 });
    else if (cls === 'assassin') this.noiseHit({ dur: 0.07, vol: 0.05, type: 'bandpass', f: 6000, f2: 2500, q: 2.5, a: 0.003 });
    else if (cls === 'brawler') { this.noiseHit({ dur: big ? 0.2 : 0.09, vol: big ? 0.09 : 0.05, type: 'bandpass', f: 1300, f2: 500, q: 1.1, a: 0.006 }); if (big) this.osc({ type: 'sawtooth', f: 90, f2: 160, dur: 0.25, vol: 0.05, lp: 900 }); }
    else this.cast(big);
  }
  cast(big = false) { this.osc({ type: 'sine', f: big ? 520 : 880, f2: big ? 1400 : 1760, dur: big ? 0.25 : 0.12, vol: 0.05, send: 0.35 }); this.osc({ type: 'triangle', f: big ? 260 : 440, dur: 0.15, vol: 0.03, send: 0.3 }); }
  hit(heavy = false, cls = 'sword') {
    const metal = cls === 'sword' || cls === 'assassin';
    this.noiseHit({ dur: heavy ? 0.28 : 0.1, vol: heavy ? 0.18 : 0.11, type: 'lowpass', f: heavy ? 2600 : 3400, f2: 200, q: 0.9, a: 0.002 });
    this.osc({ type: 'sine', f: heavy ? 150 : 220, f2: 50, dur: heavy ? 0.28 : 0.12, vol: heavy ? 0.26 : 0.14 });
    if (metal) this.osc({ type: 'square', f: heavy ? 1400 : 2100, f2: 900, dur: 0.06, vol: 0.025, lp: 6000 });
  }
  block() { this.osc({ type: 'triangle', f: 1500, f2: 1100, dur: 0.12, vol: 0.06, send: 0.25 }); this.noiseHit({ dur: 0.06, vol: 0.05, f: 5000 }); }
  breakGuard() { this.osc({ type: 'sawtooth', f: 90, f2: 40, dur: 0.5, vol: 0.16, lp: 1200 }); this.noiseHit({ dur: 0.5, vol: 0.16, type: 'lowpass', f: 1500, f2: 100 }); }
  dodge() { this.noiseHit({ dur: 0.15, vol: 0.05, type: 'highpass', f: 3000, f2: 6000, a: 0.01 }); }
  blink() { this.osc({ type: 'sine', f: 1800, f2: 300, dur: 0.18, vol: 0.05, send: 0.4 }); this.noiseHit({ dur: 0.12, vol: 0.04, type: 'bandpass', f: 3000, f2: 8000, q: 3 }); }
  jump() { this.osc({ type: 'sine', f: 300, f2: 600, dur: 0.1, vol: 0.04 }); }
  land(hard = false) { this.osc({ type: 'sine', f: hard ? 110 : 160, f2: 50, dur: hard ? 0.2 : 0.08, vol: hard ? 0.14 : 0.05 }); }
  thunder() { this.noiseHit({ dur: 0.45, vol: 0.14, type: 'bandpass', f: 2400, f2: 300, q: 0.8, a: 0.003 }); this.osc({ type: 'sawtooth', f: 70, f2: 35, dur: 0.4, vol: 0.08, lp: 700 }); }
  boom() { this.noiseHit({ dur: 0.35, vol: 0.14, type: 'lowpass', f: 1800, f2: 90, a: 0.003 }); this.osc({ type: 'sine', f: 90, f2: 35, dur: 0.35, vol: 0.2 }); }
  ult() {
    if (!this.ctx) return;
    [0, 7, 12, 19].forEach((n, i) => this.osc({ type: 'sawtooth', f: mtof(50 + n), t: i * 0.05, dur: 0.7, vol: 0.05, lp: 2500, send: 0.4 }));
    this.noiseHit({ dur: 0.7, vol: 0.1, type: 'bandpass', f: 400, f2: 7000, q: 1.4, a: 0.35 });
    this.osc({ type: 'sine', f: 60, f2: 30, t: 0.7, dur: 0.6, vol: 0.3 });
  }
  ready() { this.osc({ type: 'square', f: mtof(84), dur: 0.08, vol: 0.035, lp: 5000, send: 0.3 }); this.osc({ type: 'square', f: mtof(91), t: 0.08, dur: 0.12, vol: 0.035, lp: 5000, send: 0.3 }); }
  ko() { this.osc({ type: 'sine', f: 120, f2: 30, dur: 1.2, vol: 0.3 }); this.noiseHit({ dur: 1, vol: 0.18, type: 'lowpass', f: 3000, f2: 80, a: 0.003 }); }
  bell(n = 1) { for (let i = 0; i < n; i++) this.osc({ type: 'triangle', f: mtof(81), t: i * 0.22, dur: 0.5, vol: 0.07, send: 0.5 }); }
  victory() { [0, 4, 7, 12, 16].forEach((x, i) => this.osc({ type: 'square', f: mtof(67 + x), t: i * 0.09, dur: 0.28, vol: 0.045, lp: 4000, send: 0.4 })); }
  defeat() { [0, -2, -5, -9].forEach((x, i) => this.osc({ type: 'sawtooth', f: mtof(60 + x), t: i * 0.14, dur: 0.32, vol: 0.045, lp: 1400 })); }
}
