import { useSyncExternalStore } from "react";
import { allGames, GameConfig } from "@/data/games";
import { PublishedGame, authoredGameToGameConfig } from "@/lib/gameAuthoring";

export const CUSTOM_GAMES_CACHE_KEY = "pp-custom-games-v1";
export const CUSTOM_GAMES_CACHE_VERSION = "v1";

let customGames: GameConfig[] = [];
let catalogSnapshot: GameConfig[] = allGames.map((g) => ({ ...g }));
let activeCatalogSnapshot: GameConfig[] = catalogSnapshot.filter((g) => !g.archived);
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function rebuildSnapshot() {
  const builtins = allGames.map((g) => (g.source ? g : { ...g, source: "builtin" as const }));
  catalogSnapshot = builtins.concat(customGames);
  activeCatalogSnapshot = catalogSnapshot.filter((g) => !g.archived);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCatalog(): GameConfig[] {
  return useSyncExternalStore(subscribe, getActiveCatalog, getActiveCatalog);
}

export function getActiveCatalog(): GameConfig[] {
  return activeCatalogSnapshot;
}

export function getCatalog(): GameConfig[] {
  return catalogSnapshot;
}

export function getCatalogGameById(id: string): GameConfig | undefined {
  return id.startsWith("game-")
    ? allGames.find((game) => game.id === id)
    : customGames.find((game) => game.id === id) || allGames.find((game) => game.id === id);
}

export function registerCustomGames(games: GameConfig[]) {
  customGames = games;
  rebuildSnapshot();
  persistCustomGames(games);
  emit();
}

export function registerPublishedGames(entries: PublishedGame[]) {
  registerCustomGames(entries.map(authoredGameToGameConfig));
}

export function clearCustomGames() {
  registerCustomGames([]);
}

export function initCustomCatalog(): GameConfig[] {
  try {
    const raw = localStorage.getItem(CUSTOM_GAMES_CACHE_KEY);
    if (!raw) return customGames;
    const parsed = JSON.parse(raw) as { version?: string; games?: GameConfig[] };
    if (parsed.version !== CUSTOM_GAMES_CACHE_VERSION || !Array.isArray(parsed.games)) return customGames;
    customGames = parsed.games;
    rebuildSnapshot();
    emit();
  } catch {
    customGames = [];
    rebuildSnapshot();
  }
  return customGames;
}

function persistCustomGames(games: GameConfig[]) {
  try {
    localStorage.setItem(CUSTOM_GAMES_CACHE_KEY, JSON.stringify({ version: CUSTOM_GAMES_CACHE_VERSION, games }));
  } catch {
    // storage may be unavailable (private mode); caching is best-effort
  }
}