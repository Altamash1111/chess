// Synthesised move sounds (WebAudio) — no audio assets needed.
let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.6;

export function configureSound(on: boolean, vol: number) { enabled = on; volume = vol; }

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx!.state === 'suspended') ctx!.resume();
    return ctx;
  } catch { return null; }
}

function thump(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', noise = 0.0, delay = 0) {
  const c = ac(); if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * volume), t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(c.destination);
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.45), t0 + dur);
  o.connect(g);
  o.start(t0); o.stop(t0 + dur + 0.02);
  if (noise > 0) {
    const len = Math.floor(c.sampleRate * Math.min(0.06, dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = c.createBufferSource(); n.buffer = buf;
    const ng = c.createGain(); ng.gain.value = noise * volume;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
    n.connect(f); f.connect(ng); ng.connect(c.destination);
    n.start(t0);
  }
}

export const sounds = {
  move() { thump(210, 0.09, 0.5, 'triangle', 0.35); },
  capture() { thump(150, 0.14, 0.7, 'triangle', 0.6); thump(320, 0.06, 0.3, 'square', 0.2, 0.01); },
  castle() { thump(210, 0.08, 0.45, 'triangle', 0.3); thump(250, 0.08, 0.45, 'triangle', 0.3, 0.11); },
  check() { thump(520, 0.18, 0.35, 'sine'); thump(780, 0.2, 0.25, 'sine', 0, 0.05); },
  promote() { thump(440, 0.1, 0.3, 'sine'); thump(660, 0.12, 0.3, 'sine', 0, 0.08); thump(880, 0.16, 0.3, 'sine', 0, 0.16); },
  gameEnd() { thump(392, 0.5, 0.35, 'sine'); thump(494, 0.5, 0.3, 'sine', 0, 0.02); thump(587, 0.7, 0.3, 'sine', 0, 0.04); },
  illegal() { thump(110, 0.12, 0.35, 'sawtooth'); },
  notify() { thump(660, 0.08, 0.25, 'sine'); },
};
