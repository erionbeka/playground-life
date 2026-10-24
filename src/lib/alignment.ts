import { activeGames, allGames, GameConfig, GameEngine } from "@/data/games";
import {
  AAC_ACCESS,
  AAC_COMPETENCIES,
  AAC_FUNCTIONS,
  ABLLS_AREAS,
  GAME_ALIGNMENT,
  GameAlignment,
} from "@/data/gameAlignment";
import { archivedGameIds, archivedGameRecord } from "@/data/gameArchive";

export type DaggDomain = "understanding" | "expression" | "social" | "literacy" | "other";

export const COMMUNICATION_MATRIX_LABELS = [
  "Pre-intentional",
  "Intentional",
  "Unconventional",
  "Conventional",
  "Concrete symbols",
  "Abstract symbols",
  "Language",
] as const;

const ENGINE_DEFAULT: GameAlignment = {
  ablls: ["visual-performance", "receptive-language"],
  aac: {
    matrixLevel: 4,
    functions: ["choice", "joint-attention"],
    access: ["touch"],
    representation: "symbol",
    fieldSize: 4,
    competencies: ["operational"],
  },
};

const ENGINE_DEFAULTS: Partial<Record<GameEngine, GameAlignment>> = {
  sandbox: {
    ablls: ["play-leisure", "social-interaction"],
    aac: { matrixLevel: 4, functions: ["social", "joint-attention"], access: ["touch", "gesture"], representation: "symbol", fieldSize: 4, competencies: ["social", "operational"] },
  },
  matching: {
    ablls: ["visual-performance", "receptive-language"],
    aac: { matrixLevel: 5, functions: ["choice", "joint-attention"], access: ["touch"], representation: "symbol", fieldSize: 4, competencies: ["linguistic", "operational"] },
  },
  sequence: {
    ablls: ["visual-performance", "receptive-language"],
    aac: { matrixLevel: 4, functions: ["choice", "joint-attention"], access: ["touch"], representation: "symbol", fieldSize: 4, competencies: ["operational"] },
  },
  sorting: {
    ablls: ["visual-performance", "receptive-language", "labeling"],
    aac: { matrixLevel: 5, functions: ["choice", "comment"], access: ["touch"], representation: "symbol", fieldSize: 4, competencies: ["linguistic"] },
  },
  tapping: {
    ablls: ["fine-motor", "visual-performance"],
    aac: { matrixLevel: 3, functions: ["choice"], access: ["touch", "switch-scan"], representation: "symbol", fieldSize: 4, competencies: ["operational"] },
  },
  social: {
    ablls: ["social-interaction", "labeling"],
    aac: { matrixLevel: 4, functions: ["social", "comment", "request"], access: ["touch", "gesture", "vocal"], representation: "symbol", fieldSize: 4, competencies: ["social", "linguistic"] },
  },
  building: {
    ablls: ["visual-performance", "fine-motor"],
    aac: { matrixLevel: 4, functions: ["choice", "request"], access: ["touch"], representation: "symbol", fieldSize: 4, competencies: ["operational"] },
  },
  recognition: {
    ablls: ["visual-performance", "labeling"],
    aac: { matrixLevel: 5, functions: ["choice", "comment"], access: ["touch"], representation: "symbol", fieldSize: 4, competencies: ["linguistic"] },
  },
  counting: {
    ablls: ["math", "visual-performance"],
    aac: { matrixLevel: 5, functions: ["choice", "share-information"], access: ["touch"], representation: "symbol", fieldSize: 4, competencies: ["linguistic"] },
  },
  memory: {
    ablls: ["visual-performance", "receptive-language"],
    aac: { matrixLevel: 4, functions: ["choice"], access: ["touch"], representation: "photo", fieldSize: 4, competencies: ["operational"] },
  },
  "magic-toys": {
    ablls: ["play-leisure", "receptive-language"],
    aac: { matrixLevel: 4, functions: ["request", "joint-attention"], access: ["touch", "gesture"], representation: "symbol", fieldSize: 4, competencies: ["social", "operational"] },
  },
  "pattern-next": {
    ablls: ["visual-performance", "math"],
    aac: { matrixLevel: 4, functions: ["choice"], access: ["touch"], representation: "symbol", fieldSize: 4, competencies: ["operational"] },
  },
  "odd-one-out": {
    ablls: ["visual-performance", "labeling"],
    aac: { matrixLevel: 5, functions: ["choice", "comment"], access: ["touch"], representation: "symbol", fieldSize: 4, competencies: ["linguistic"] },
  },
  "choice-request": {
    ablls: ["requests", "social-interaction", "self-advocacy"],
    aac: { matrixLevel: 5, functions: ["request", "choice", "help"], access: ["touch", "gesture", "vocal"], representation: "symbol", fieldSize: 4, competencies: ["linguistic", "social"] },
  },
  regulation: {
    ablls: ["cooperation", "social-interaction"],
    aac: { matrixLevel: 4, functions: ["self-advocacy", "protest", "feelings"], access: ["touch", "gesture"], representation: "symbol", fieldSize: 4, competencies: ["social", "strategic"] },
  },
  flexible: {
    ablls: ["cooperation", "social-interaction"],
    aac: { matrixLevel: 4, functions: ["choice", "protest", "social"], access: ["touch", "gesture"], representation: "symbol", fieldSize: 4, competencies: ["social", "strategic"] },
  },
  tracing: {
    ablls: ["writing", "fine-motor"],
    aac: { matrixLevel: 4, functions: ["choice", "request"], access: ["touch", "dwell"], representation: "symbol", fieldSize: 2, competencies: ["operational"] },
  },
  listen: {
    ablls: ["receptive-language", "group-instruction"],
    aac: { matrixLevel: 5, functions: ["choice", "joint-attention"], access: ["touch", "switch-scan", "dwell"], representation: "symbol", fieldSize: 4, competencies: ["linguistic", "operational"] },
  },
  intraverbal: {
    ablls: ["intraverbals", "receptive-language"],
    aac: { matrixLevel: 5, functions: ["share-information", "comment"], access: ["touch", "vocal"], representation: "symbol", fieldSize: 2, competencies: ["linguistic"] },
  },
  echoic: {
    ablls: ["vocal-imitation", "spontaneous-vocalizations"],
    aac: { matrixLevel: 3, functions: ["social", "request"], access: ["vocal", "gesture"], representation: "object", fieldSize: 2, competencies: ["linguistic", "social"] },
  },
  "sentence-builder": {
    ablls: ["syntax-grammar", "requests"],
    aac: { matrixLevel: 6, functions: ["request", "comment", "share-information"], access: ["touch", "switch-scan"], representation: "symbol", fieldSize: 4, competencies: ["linguistic", "operational"] },
  },
  comment: {
    ablls: ["labeling", "social-interaction"],
    aac: { matrixLevel: 5, functions: ["comment", "social", "joint-attention"], access: ["touch", "switch-scan"], representation: "symbol", fieldSize: 4, competencies: ["social", "linguistic"] },
  },
  "sound-memory": {
    ablls: ["vocal-imitation", "receptive-language"],
    aac: { matrixLevel: 3, functions: ["choice"], access: ["touch", "vocal"], representation: "symbol", fieldSize: 4, competencies: ["operational"] },
  },
};

const ABLLS_SET = new Set<string>(ABLLS_AREAS);
const FUNCTION_SET = new Set<string>(AAC_FUNCTIONS);
const ACCESS_SET = new Set<string>(AAC_ACCESS);
const COMPETENCY_SET = new Set<string>(AAC_COMPETENCIES);

export function getGameAlignment(gameOrId: GameConfig | string): GameAlignment {
  const game = typeof gameOrId === "string" ? allGames.find((entry) => entry.id === gameOrId) : gameOrId;
  if (!game) return ENGINE_DEFAULT;
  const explicit = GAME_ALIGNMENT[game.id];
  if (explicit) return explicit;
  return ENGINE_DEFAULTS[game.engine] || ENGINE_DEFAULT;
}

export function hasExplicitAlignment(id: string): boolean {
  return Boolean(GAME_ALIGNMENT[id]);
}

export function matrixLevelLabel(level: number): string {
  return COMMUNICATION_MATRIX_LABELS[Math.max(1, Math.min(7, Math.round(level))) - 1];
}

export function toDaggDomains(alignment: GameAlignment): DaggDomain[] {
  const { ablls } = alignment;
  const { functions } = alignment.aac;
  const domains: DaggDomain[] = [];
  if (
    ablls.includes("receptive-language") ||
    ablls.includes("group-instruction")
  ) {
    domains.push("understanding");
  }
  if (
    functions.some((fn) => fn === "request" || fn === "comment" || fn === "share-information" || fn === "question" || fn === "feelings") ||
    ablls.includes("intraverbals") ||
    ablls.includes("syntax-grammar")
  ) {
    domains.push("expression");
  }
  if (
    functions.some((fn) => fn === "social" || fn === "joint-attention" || fn === "self-advocacy") ||
    ablls.includes("social-interaction") ||
    ablls.includes("play-leisure")
  ) {
    domains.push("social");
  }
  if (ablls.some((area) => area === "reading" || area === "writing" || area === "spelling")) {
    domains.push("literacy");
  }
  if (domains.length === 0) domains.push("other");
  return domains;
}

export function toLightCompetencies(alignment: GameAlignment): Array<(typeof AAC_COMPETENCIES)[number]> {
  const stored = alignment.aac.competencies.filter((entry) => COMPETENCY_SET.has(entry));
  if (stored.length > 0) return stored;
  const derived: Array<(typeof AAC_COMPETENCIES)[number]> = ["linguistic"];
  if (alignment.aac.access.some((entry) => entry === "switch-scan" || entry === "dwell")) derived.push("operational");
  if (alignment.aac.functions.some((entry) => entry === "social" || entry === "joint-attention")) derived.push("social");
  if (alignment.aac.functions.some((entry) => entry === "protest" || entry === "self-advocacy")) derived.push("strategic");
  return derived;
}

export function validateAlignment(alignment: GameAlignment): string[] {
  const errors: string[] = [];
  if (!Array.isArray(alignment.ablls) || alignment.ablls.length === 0) {
    errors.push("At least one ABLLS-R area is required.");
  }
  for (const area of alignment.ablls) {
    if (!ABLLS_SET.has(area)) errors.push(`Unknown ABLLS-R area: ${String(area)}`);
  }
  const level = alignment.aac.matrixLevel;
  if (!Number.isInteger(level) || level < 1 || level > 7) {
    errors.push(`Communication Matrix level must be 1-7, received ${String(level)}.`);
  }
  if (alignment.aac.functions.length === 0) errors.push("At least one AAC function is required.");
  for (const fn of alignment.aac.functions) {
    if (!FUNCTION_SET.has(fn)) errors.push(`Unknown AAC function: ${String(fn)}`);
  }
  if (alignment.aac.access.length === 0) errors.push("At least one AAC access method is required.");
  for (const access of alignment.aac.access) {
    if (!ACCESS_SET.has(access)) errors.push(`Unknown AAC access method: ${String(access)}`);
  }
  if (![2, 4, 9, 12].includes(alignment.aac.fieldSize)) {
    errors.push(`Field size must be 2, 4, 9, or 12, received ${String(alignment.aac.fieldSize)}.`);
  }
  if (alignment.aac.competencies.length === 0) errors.push("At least one AAC competency is required.");
  for (const competency of alignment.aac.competencies) {
    if (!COMPETENCY_SET.has(competency)) errors.push(`Unknown AAC competency: ${String(competency)}`);
  }
  return errors;
}

export function getAlignmentCoverage(games: GameConfig[] = activeGames) {
  const ablls: Record<string, number> = {};
  const functions: Record<string, number> = {};
  const access: Record<string, number> = {};
  const levels: Record<number, number> = {};
  for (const game of games) {
    const alignment = getGameAlignment(game);
    for (const area of alignment.ablls) ablls[area] = (ablls[area] || 0) + 1;
    for (const fn of alignment.aac.functions) functions[fn] = (functions[fn] || 0) + 1;
    for (const method of alignment.aac.access) access[method] = (access[method] || 0) + 1;
    levels[alignment.aac.matrixLevel] = (levels[alignment.aac.matrixLevel] || 0) + 1;
  }
  return { ablls, functions, access, levels };
}

export function getMissingAbllsAreas(games: GameConfig[] = activeGames): string[] {
  const coverage = getAlignmentCoverage(games);
  return ABLLS_AREAS.filter((area) => !coverage.ablls[area]);
}

export function getMissingAacFunctions(games: GameConfig[] = activeGames): string[] {
  const coverage = getAlignmentCoverage(games);
  return AAC_FUNCTIONS.filter((fn) => !coverage.functions[fn]);
}

export function archivedGames() {
  const ids = new Set(archivedGameIds());
  return allGames.filter((game) => ids.has(game.id));
}

export function archiveRecordFor(id: string) {
  return archivedGameRecord()[id];
}

export function getAlignedActiveGames(): GameConfig[] {
  return activeGames.filter((game) => hasExplicitAlignment(game.id));
}

export function alignmentSummaryFor(game: GameConfig): string {
  const alignment = getGameAlignment(game);
  const areas = alignment.ablls.join(", ");
  const functions = alignment.aac.functions.join(", ");
  return `${areas} | AAC level ${alignment.aac.matrixLevel} | ${functions}`;
}
