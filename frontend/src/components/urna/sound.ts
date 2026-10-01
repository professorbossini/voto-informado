/**
 * Voting-machine sounds synthesised with WebAudio (no audio files). Every call is
 * best-effort: browsers without WebAudio, or with audio blocked, simply stay silent.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(ac: AudioContext, freq: number, start: number, length: number, volume = 0.06) {
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, t0);
  // Short attack/release avoids clicks.
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.005);
  gain.gain.setValueAtTime(volume, t0 + length - 0.01);
  gain.gain.linearRampToValueAtTime(0, t0 + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.02);
}

/** Short beep on every key. */
export function playKey() {
  const ac = audio();
  if (ac) tone(ac, 1000, 0, 0.06);
}

/** Confirmation of one office (machine moves on to the next). */
export function playConfirm() {
  const ac = audio();
  if (!ac) return;
  tone(ac, 1250, 0, 0.07);
  tone(ac, 1250, 0.1, 0.07);
}

/** The familiar end-of-vote sound: quick high beeps, then a longer one. */
export function playFim() {
  const ac = audio();
  if (!ac) return;
  for (let i = 0; i < 5; i++) tone(ac, 1400, i * 0.09, 0.06);
  tone(ac, 1400, 0.5, 0.75);
}
