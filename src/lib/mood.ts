export type MoodKey = "great" | "okay" | "meh" | "worried" | "overwhelmed";

export interface MoodEntry {
  mood: MoodKey;
  at: string;
}

export const MOOD_OPTIONS: { key: MoodKey; emoji: string; label: string }[] = [
  { key: "great", emoji: "😀", label: "Great" },
  { key: "okay", emoji: "🙂", label: "Okay" },
  { key: "meh", emoji: "😐", label: "Just fine" },
  { key: "worried", emoji: "😟", label: "Worried" },
  { key: "overwhelmed", emoji: "😣", label: "Overwhelmed" },
];

const STORAGE_KEY = "pp-mood-log-v1";
const MAX_PER_CHILD = 30;

type MoodStore = Record<string, MoodEntry[]>;

function loadStore(): MoodStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MoodStore;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: MoodStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable */
  }
}

export function recordMood(childId: string, mood: MoodKey) {
  if (!childId) return;
  const store = loadStore();
  const entries = store[childId] || [];
  const next = [...entries, { mood, at: new Date().toISOString() }].slice(-MAX_PER_CHILD);
  store[childId] = next;
  saveStore(store);
}

export function getLatestMood(childId: string): MoodEntry | null {
  const entries = loadStore()[childId];
  return entries && entries.length ? entries[entries.length - 1] : null;
}

export function getMoodEmoji(mood: MoodKey | undefined | null): string {
  if (!mood) return "";
  return MOOD_OPTIONS.find((option) => option.key === mood)?.emoji || "";
}
