/**
 * Synthesizes a subtle, pleasant clinical notification chime using Web Audio API.
 * Does not require external audio assets and runs completely client-side.
 */
export function playTriageChime(acuity = 'MODERATE') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const isCritical = acuity === 'CRITICAL';
    const isHigh = acuity === 'HIGH';

    // Frequencies: High/Critical gets higher attention frequencies
    const f1 = isCritical ? 880 : isHigh ? 659.25 : 523.25; // A5 or E5 or C5
    const f2 = isCritical ? 1174.66 : isHigh ? 880 : 659.25; // D6 or A5 or E5

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(f1, now);
    osc1.frequency.exponentialRampToValueAtTime(f2, now + 0.16);

    osc2.frequency.setValueAtTime(f1 * 0.5, now);
    osc2.frequency.exponentialRampToValueAtTime(f2 * 0.5, now + 0.16);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isCritical ? 0.7 : 0.45));

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);

    const stopTime = now + (isCritical ? 0.72 : 0.48);
    osc1.stop(stopTime);
    osc2.stop(stopTime);

    window.setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // Ignored
      }
    }, 850);
  } catch {
    // Autoplay restrictions or unavailable audio context safely handled
  }
}

export default playTriageChime;

