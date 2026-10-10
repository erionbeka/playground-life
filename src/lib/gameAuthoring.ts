import type { GameConfig } from "@/data/games";
import { scanGuardedText, GuardMatch } from "@/lib/contentGuard";

export type AuthoredEngine = "matching" | "sorting" | "recognition" | "memory" | "choice-request" | "odd-one-out";

export const AUTHORED_ENGINES: AuthoredEngine[] = [
  "matching",
  "sorting",
  "recognition",
  "memory",
  "choice-request",
  "odd-one-out",
];

export interface AuthoredGame {
  title: string;
  description: string;
  emoji: string;
  difficulty: "easy" | "medium" | "hard";
  learningGoal: string;
  successCriteria: string[];
  skills: string[];
  supportsShared: boolean;
  engine: AuthoredEngine;
  config: Record<string, unknown>;
}

export interface PublishedGame extends AuthoredGame {
  id: string;
  status: "approved";
  createdAt: string;
}

const SHORT_LIMIT = 24;

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function validateAuthoredGame(game: AuthoredGame, existingTitles?: string[]): string[] {
  const errors: string[] = [];
  if (game.title.trim().length === 0) errors.push("title");
  if (game.title.length > 60) errors.push("title");
  if (existingTitles?.some((t) => t.trim().toLowerCase() === game.title.trim().toLowerCase())) errors.push("title");
  if (game.description.length > 240) errors.push("description");
  if ([...game.emoji].length !== 1) errors.push("emoji");
  if (game.learningGoal.length > 140) errors.push("learningGoal");
  if (game.successCriteria.length < 1 || game.successCriteria.length > 3) errors.push("successCriteria");
  if (game.successCriteria.some((s) => s.length > 60)) errors.push("successCriteria");

  const cfg = game.config;

  switch (game.engine) {
    case "matching": {
      const pairList = strList(cfg.pairList);
      if (pairList.length < 2 || pairList.length > 12 || pairList.some((v) => v.length > SHORT_LIMIT)) errors.push("pairList");
      break;
    }
    case "sorting": {
      const map = cfg.itemsByCategory as Record<string, unknown> | undefined;
      const categories = map ? Object.keys(map) : [];
      const per = categories.map((c) => strList(map[c]));
      if (categories.length < 2 || categories.length > 3) errors.push("itemsByCategory");
      if (per.some((list) => list.length < 3 || list.length > 8)) errors.push("itemsByCategory");
      break;
    }
    case "recognition": {
      const items = unique(strList(cfg.items));
      const correct = unique(strList(cfg.correctItems));
      const target = typeof cfg.target === "string" && cfg.target.length > 0 ? cfg.target : "";
      if (items.length < 6 || items.length > 12) errors.push("items");
      if (correct.length < 2 || correct.length > 4 || correct.some((c) => !items.includes(c))) errors.push("correctItems");
      if (!target || target.length > SHORT_LIMIT) errors.push("target");
      break;
    }
    case "memory": {
      const cardItems = strList(cfg.cardItems);
      if (cardItems.length < 4 || cardItems.length > 12 || cardItems.length % 2 !== 0) errors.push("cardItems");
      if (cardItems.some((v) => v.length > SHORT_LIMIT)) errors.push("cardItems");
      break;
    }
    case "choice-request": {
      const scenarios = Array.isArray(cfg.scenarios) ? (cfg.scenarios as unknown[]) : [];
      if (scenarios.length < 2 || scenarios.length > 6) errors.push("scenarios");
      for (const scenario of scenarios) {
        const s = scenario as { situation?: string; request?: string; options?: unknown[] };
        if (!s.situation || !s.request) errors.push("scenarios");
        const options = Array.isArray(s.options) ? (s.options as { label?: string }[]) : [];
        if (options.length < 2 || options.length > 4) errors.push("options");
        if (options.some((o) => !(o && o.label && o.label.length > 0 && o.label.length <= 12))) errors.push("options");
      }
      break;
    }
    case "odd-one-out": {
      const setItems = unique(strList(cfg.setItems));
      const oddIndex = typeof cfg.oddIndex === "number" ? cfg.oddIndex : -1;
      if (setItems.length < 3 || setItems.length > 6) errors.push("setItems");
      if (oddIndex < 0 || oddIndex >= setItems.length) errors.push("oddIndex");
      break;
    }
  }

  return errors;
}

export function runOriginAudit(title: string, description: string): { tokenHits: GuardMatch[]; banned: GuardMatch[] } {
  const titleHits = scanGuardedText(title);
  const descriptionHits = scanGuardedText(description);
  return {
    tokenHits: titleHits.concat(descriptionHits).filter((m) => m.pattern === "code-token"),
    banned: titleHits.concat(descriptionHits).filter((m) => m.pattern !== "code-token"),
  };
}

export function authoredGameToGameConfig(entry: PublishedGame): GameConfig {
  const categoryByEngine: Record<AuthoredEngine, GameConfig["category"]> = {
    matching: "matching",
    sorting: "sorting",
    recognition: "colors-shapes",
    memory: "memory",
    "choice-request": "language",
    "odd-one-out": "sorting",
  };
  const ageRange = entry.difficulty === "easy" ? { min: 0, max: 4 } : entry.difficulty === "medium" ? { min: 3, max: 6 } : { min: 5, max: 8 };
  return {
    id: entry.id,
    name: entry.title,
    emoji: entry.emoji,
    category: categoryByEngine[entry.engine],
    engine: entry.engine,
    description: entry.description,
    skills: entry.skills,
    difficulty: entry.difficulty,
    estimatedMinutes: 5,
    supportsShared: entry.supportsShared,
    supportsMultiplayer: false,
    ageRange,
    contentVersion: "custom-v1",
    learningGoal: entry.learningGoal || undefined,
    autismSupports: ["clear finish point", "reduced visual field"],
    successCriteria: entry.successCriteria,
    config: entry.config,
  };
}
