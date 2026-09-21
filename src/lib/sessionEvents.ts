const STORAGE_KEY = "pp-session-events-v1";
const MAX_PER_CHILD = 200;

export interface ChildEvent {
  type: string;
  at: string;
  detail?: string;
}

type EventStore = Record<string, ChildEvent[]>;

function loadStore(): EventStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as EventStore;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: EventStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable */
  }
}

export function appendChildEvent(childId: string, type: string, detail?: string) {
  if (!childId || !type) return;
  const store = loadStore();
  const events = store[childId] || [];
  events.push({ type, at: new Date().toISOString(), detail });
  store[childId] = events.slice(-MAX_PER_CHILD);
  saveStore(store);
}

export function getRecentChildEvents(childId: string, type?: string, sinceDays?: number): ChildEvent[] {
  const events = loadStore()[childId] || [];
  const cutoff = sinceDays ? Date.now() - sinceDays * 24 * 60 * 60 * 1000 : 0;
  return events.filter((entry) => {
    if (type && entry.type !== type) return false;
    if (cutoff && new Date(entry.at).getTime() < cutoff) return false;
    return true;
  });
}
