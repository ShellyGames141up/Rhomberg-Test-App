const TONES = Object.freeze({
  navigation: [[520, 0.025, 0]],
  buttons: [[430, 0.02, 0]],
  toggle: [[600, 0.018, 0]],
  success: [[520, 0.05, 0], [720, 0.08, 0.055]],
  warning: [[440, 0.07, 0], [350, 0.08, 0.075]],
  error: [[260, 0.07, 0], [210, 0.09, 0.075]],
  notifications: [[760, 0.06, 0], [920, 0.055, 0.065]],
  transfers: [[360, 0.035, 0], [620, 0.06, 0.04]],
  rfqSubmission: [[320, 0.04, 0], [480, 0.05, 0.045], [760, 0.07, 0.105]],
  startup: [[420, 0.05, 0], [620, 0.06, 0.06]],
});

let audioContext;
let activeUntil = 0;

const categoryFor = type => type === 'toggle' ? 'buttons' : type;

export const soundSupported = () => Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
export const hapticsSupported = () => typeof globalThis.navigator?.vibrate === 'function';

export function playUiSound(settings, type) {
  const sound = settings?.sounds;
  const category = categoryFor(type);
  if (!sound?.enabled || sound.categories?.[category] === false || !soundSupported()) return false;
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  audioContext ||= new Context();
  const now = audioContext.currentTime;
  if (now < activeUntil && !['warning', 'error', 'rfqSubmission'].includes(type)) return false;
  const sequence = TONES[type] || TONES.buttons;
  const volume = Math.max(0.006, Math.min(0.06, Number(sound.volume || 0.32) * 0.06));
  for (const [frequency, duration, delay] of sequence) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now + delay);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(volume, now + delay + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + duration + 0.01);
  }
  activeUntil = now + Math.max(...sequence.map(([, duration, delay]) => duration + delay));
  return true;
}

const HAPTIC_PATTERNS = Object.freeze({
  buttons: [8],
  success: [12, 25, 18],
  warning: [18, 30, 18],
  error: [30, 20, 30],
  importantWorkflow: [14, 25, 28],
});

export function triggerHaptic(settings, type = 'buttons') {
  const haptics = settings?.haptics;
  if (!haptics?.enabled || haptics.categories?.[type] === false || !hapticsSupported()) return false;
  const base = HAPTIC_PATTERNS[type] || HAPTIC_PATTERNS.buttons;
  const multiplier = haptics.strength === 'medium' ? 1.35 : 1;
  globalThis.navigator.vibrate(base.map(value => Math.round(value * multiplier)));
  return true;
}

export const provideFeedback = (settings, type, hapticType) => ({
  soundPlayed: playUiSound(settings, type),
  hapticPlayed: triggerHaptic(settings, hapticType || (type === 'success' ? 'success' : type === 'warning' ? 'warning' : type === 'error' ? 'error' : 'buttons')),
});
