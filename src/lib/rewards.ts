export interface RewardState {
  stars: number;
  stickers: string[];
  plays: number;
}

export interface RewardResult {
  starsEarned: number;
  totalStars: number;
  sticker: string | null;
  isNewSticker: boolean;
  state: RewardState;
}

const STORAGE_KEY = "pp-rewards-v1";

export const STICKER_CATALOG = [
  "🦊", "🐼", "🦁", "🐬", "🦄", "🐢", "🦋", "🌈",
  "🚀", "🎨", "🎪", "🍭", "🦖", "🐙", "🦉", "🚂",
  "🌟", "🎠", "🧸", "🐳", "🌻", "🎈", "🦜", "🏆",
];

type RewardStore = Record<string, RewardState>;

function loadStore(): RewardStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RewardStore;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: RewardStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable */
  }
}

export function getRewardState(childId: string): RewardState {
  const store = loadStore();
  return store[childId] || { stars: 0, stickers: [], plays: 0 };
}

export function setRewardState(childId: string, state: RewardState) {
  const store = loadStore();
  store[childId] = state;
  saveStore(store);
}

export function computeStars(score: number): number {
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

function stickerIndexForGame(gameId: string): number {
  let hash = 5381;
  for (let index = 0; index < gameId.length; index += 1) {
    hash = ((hash * 33) ^ gameId.charCodeAt(index)) >>> 0;
  }
  return hash % STICKER_CATALOG.length;
}

export function applyResultToRewardState(
  current: RewardState,
  gameId: string,
  score: number,
  completedSuccessfully: boolean
): { next: RewardState; starsEarned: number; sticker: string | null; isNewSticker: boolean } {
  const starsEarned = computeStars(score);
  let stickers = current.stickers;
  let sticker: string | null = null;
  let isNewSticker = false;

  if (completedSuccessfully && gameId) {
    const candidate = STICKER_CATALOG[stickerIndexForGame(gameId)];
    sticker = candidate;
    if (!stickers.includes(candidate)) {
      isNewSticker = true;
      stickers = [...stickers, candidate];
    }
  }

  const next: RewardState = { stars: current.stars + starsEarned, stickers, plays: current.plays + 1 };
  return { next, starsEarned, sticker, isNewSticker };
}

export function recordReward(childId: string, gameId: string, score: number, completedSuccessfully: boolean): RewardResult {
  const store = loadStore();
  const current = store[childId] || { stars: 0, stickers: [], plays: 0 };
  const { next, starsEarned, sticker, isNewSticker } = applyResultToRewardState(current, gameId, score, completedSuccessfully);
  store[childId] = next;
  saveStore(store);

  return { starsEarned, totalStars: next.stars, sticker, isNewSticker, state: next };
}
