const SOUND_VARIANTS = Object.freeze({
  navigation: [
    { wave: 'sine', notes: [[510, .032, 0], [680, .026, .024]] },
    { wave: 'triangle', notes: [[470, .028, 0], [610, .03, .022]] },
    { wave: 'sine', notes: [[560, .038, 0]] },
  ],
  buttons: [
    { wave: 'sine', notes: [[440, .028, 0]] },
    { wave: 'triangle', notes: [[390, .024, 0], [520, .022, .018]] },
    { wave: 'sine', notes: [[485, .025, 0]] },
  ],
  primary: [
    { wave: 'triangle', notes: [[420, .035, 0], [650, .04, .03]] },
    { wave: 'sine', notes: [[460, .03, 0], [720, .042, .028]] },
  ],
  secondary: [
    { wave: 'sine', notes: [[390, .026, 0], [500, .025, .022]] },
    { wave: 'triangle', notes: [[430, .032, 0]] },
  ],
  toggle: [
    { wave: 'square', notes: [[570, .018, 0], [690, .022, .018]] },
    { wave: 'sine', notes: [[620, .025, 0]] },
  ],
  selection: [
    { wave: 'triangle', notes: [[540, .025, 0], [760, .028, .022]] },
    { wave: 'sine', notes: [[600, .032, 0]] },
  ],
  step: [
    { wave: 'sine', notes: [[480, .03, 0], [620, .035, .027], [790, .04, .058]] },
    { wave: 'triangle', notes: [[520, .032, 0], [740, .045, .03]] },
  ],
  success: [{ wave: 'sine', notes: [[520, .06, 0], [720, .09, .06], [880, .08, .13]] }],
  warning: [{ wave: 'triangle', notes: [[440, .08, 0], [350, .09, .08]] }],
  error: [{ wave: 'sawtooth', notes: [[260, .075, 0], [210, .1, .08]] }],
  notifications: [
    { wave: 'sine', notes: [[760, .065, 0], [920, .06, .07]] },
    { wave: 'triangle', notes: [[700, .055, 0], [860, .055, .06], [1020, .05, .12]] },
  ],
  transfers: [{ wave: 'triangle', notes: [[360, .04, 0], [620, .065, .045]] }],
  rfqSubmission: [{ wave: 'sine', notes: [[320, .045, 0], [480, .055, .05], [760, .08, .115]] }],
  startup: [{ wave: 'sine', notes: [[420, .055, 0], [620, .07, .065], [780, .065, .13]] }],
});

let audioContext;
let activeUntil = 0;

const categoryFor = type => ['primary', 'secondary', 'toggle', 'selection', 'step'].includes(type) ? 'buttons' : type;
const chooseVariant = variants => variants[Math.floor(Math.random() * variants.length)] || variants[0];

export const soundSupported = () => Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
export const hapticsSupported = () => typeof globalThis.navigator?.vibrate === 'function';

export function playUiSound(settings, type = 'buttons') {
  const sound = settings?.sounds;
  const category = categoryFor(type);
  if (!sound?.enabled || sound.categories?.[category] === false || !soundSupported()) return false;
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  audioContext ||= new Context();
  audioContext.resume?.().catch?.(() => {});
  const now = audioContext.currentTime;
  if (now < activeUntil - .012 && !['warning', 'error', 'rfqSubmission', 'success'].includes(type)) return false;
  const variant = chooseVariant(SOUND_VARIANTS[type] || SOUND_VARIANTS.buttons);
  const notes = variant.notes;
  const volume = Math.max(.012, Math.min(.11, Number(sound.volume ?? .48) * .12));
  for (const [baseFrequency, duration, delay] of notes) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = variant.wave;
    const randomDetune = type === 'buttons' || type === 'navigation' || type === 'secondary' ? (Math.random() * 14) - 7 : 0;
    oscillator.frequency.setValueAtTime(baseFrequency + randomDetune, now + delay);
    gain.gain.setValueAtTime(.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(volume, now + delay + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, now + delay + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + duration + .012);
  }
  activeUntil = now + Math.max(...notes.map(([, duration, delay]) => duration + delay));
  return true;
}

const HAPTIC_PATTERNS = Object.freeze({ buttons: [8], success: [12, 25, 18], warning: [18, 30, 18], error: [30, 20, 30], importantWorkflow: [14, 25, 28] });

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
