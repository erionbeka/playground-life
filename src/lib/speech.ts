const STORAGE_KEY = "pp-voice-enabled";

let voiceEnabled = readStoredPreference();
let primed = false;

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

export function isVoiceEnabled(): boolean {
  return voiceEnabled;
}

export function setVoiceEnabled(enabled: boolean) {
  voiceEnabled = enabled;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  if (!enabled) cancelSpeech();
}

function getSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis || null;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const synthesis = getSynthesis();
  if (!synthesis) return null;
  const voices = synthesis.getVoices();
  if (!voices.length) return null;
  return voices.find((voice) => voice.lang?.toLowerCase().startsWith("en")) || voices[0];
}

export function speak(text: string, options: { rate?: number; pitch?: number } = {}) {
  if (!voiceEnabled) return;
  const synthesis = getSynthesis();
  if (!synthesis || !text) return;

  try {
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 0.92;
    utterance.pitch = options.pitch ?? 1.05;
    utterance.volume = 0.9;
    if (!primed) {
      primed = true;
      pickVoice();
    }
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    synthesis.speak(utterance);
  } catch {
    /* speech unavailable */
  }
}

export function cancelSpeech() {
  const synthesis = getSynthesis();
  if (!synthesis) return;
  try {
    synthesis.cancel();
  } catch {
    /* speech unavailable */
  }
}
