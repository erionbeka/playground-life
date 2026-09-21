import { GameConfig } from "@/data/games";

export type ActivityFamily =
  | "choice-request"
  | "regulation-transition"
  | "daily-living"
  | "flexible-thinking"
  | "shared-play"
  | "communication-comprehension"
  | "motor-play"
  | "emotion-interoception"
  | "generalization"
  | "cognitive-play"
  | "creative-play"
  | "sensory-play";

export interface ActivitySpec {
  gameId: string;
  name: string;
  family: ActivityFamily;
  mechanic: string;
  learningObjective: string;
  modalities: string[];
  motor: "low" | "medium" | "high";
  language: "low" | "medium" | "high";
  social: "low" | "medium" | "high";
  supportPrereqs: string[];
  sensoryLoad: "low" | "medium" | "high";
  effortMinutes: number;
  breakOpportunities: boolean;
  generalizationContext: string;
  contentVersion: string;
}

export const DEFAULT_CONTENT_VERSION = "v1.0.0";

const ENGINE_MECHANIC: Record<string, string> = {
  matching: "card-matching",
  memory: "memory-recall",
  sequence: "repeat-sequence",
  sorting: "categorize-sort",
  tapping: "target-tapping",
  social: "strategy-exploration",
  building: "model-building",
  recognition: "find-all-examples",
  counting: "count-and-pick",
  "magic-toys": "cause-and-effect",
  "odd-one-out": "find-the-difference",
  "pattern-next": "next-in-pattern",
  "face-builder": "emotion-recognition",
  "whats-missing": "memory-gap",
  "situation-feelings": "feeling-in-situation",
  "sound-memory": "melody-recall",
  listen: "listen-and-match",
  sandbox: "open-ended-play",
  slide: "open-ended-play",
  bench: "open-ended-play",
};

function traceMechanic(config: Record<string, unknown>): string {
  const theme = String(config.theme || "").toLowerCase();
  const traceThemes = ["trace lines", "connect dots", "swipe patterns", "follow the path", "slow drag", "circle draw", "zig-zag trace", "spiral trace", "rainbow arc", "heart trace", "star trace"];
  return traceThemes.some((t) => theme.includes(t.replace(" trace", ""))) || theme.includes("trace") ? "shape-tracing" : "target-tapping";
}

function familyFor(game: GameConfig): ActivityFamily {
  const { engine, category } = game;
  if (category === "daily-living" && (engine === "sequence" || engine === "sorting")) return "daily-living";
  if (engine === "social") return category === "emotions" ? "emotion-interoception" : "shared-play";
  if (engine === "situation-feelings" || engine === "face-builder") return "emotion-interoception";
  if (engine === "listen") return "communication-comprehension";
  if (engine === "sorting") return "communication-comprehension";
  if (engine === "tapping") return "motor-play";
  if (engine === "building" || engine === "magic-toys" || engine === "sandbox" || engine === "slide" || engine === "bench") return "creative-play";
  if (engine === "sound-memory") return "sensory-play";
  return "cognitive-play";
}

function tracingObjective(theme: string): string {
  return `Follow and trace a ${theme} path at your own pace; notice how your hand moves.`;
}

function objectiveFor(game: GameConfig): string {
  const theme = String(game.config.theme || "");
  const mechanic = ENGINE_MECHANIC[game.engine] || "open-ended-play";
  const family = familyFor(game);

  if (game.engine === "tapping" && traceMechanic(game.config) === "shape-tracing") {
    return tracingObjective(theme);
  }
  if (game.engine === "social") {
    if (game.category === "emotions" || theme.includes("feeling") || theme.includes("calm")) {
      return "Notice and name how you feel, and choose what helps you feel calm and connected.";
    }
    if (theme.includes("space") || theme.includes("boundary") || theme.includes("personal")) {
      return "Understand personal space and boundaries, and choose how you communicate and what feels right for you.";
    }
    return "Practice making choices about how you communicate and connect — your way.";
  }
  if (family === "emotion-interoception") return "Notice and name how you feel, in your own words and your own way.";
  if (family === "communication-comprehension") return "Understand and show what you know using pictures, words, or gestures.";
  if (family === "motor-play") return "Move and respond with a steady, comfortable pace — speed is optional.";
  if (family === "creative-play") return "Explore and create freely; there is no wrong way to play.";
  if (family === "daily-living") return `Practice a real daily-living routine (${theme || "everyday tasks"}) step by step.`;
  if (family === "sensory-play") return "Listen carefully and respond at your own pace.";
  if (family === "shared-play") return "Cooperate, take turns, and celebrate together without forced interaction.";
  return `Play and practice ${mechanic.replace(/-/g, " ")} at a supportive pace.`;
}

function modalitiesFor(game: GameConfig): string[] {
  const { engine } = game;
  const list = ["picture"];
  if (game.supportsShared) list.push("co-play");
  if (["social", "listen", "situation-feelings"].includes(engine)) list.push("speech", "gesture", "AAC");
  if (["tapping", "sequence", "building", "sorting", "magic-toys", "whats-missing"].includes(engine)) list.push("touch");
  if (["tapping"].includes(engine)) list.push("pointer");
  return Array.from(new Set(list));
}

function motorFor(game: GameConfig): "low" | "medium" | "high" {
  if (["tapping", "tracing"].includes(game.engine)) return "high";
  if (["building", "sorting", "magic-toys"].includes(game.engine)) return "medium";
  if (["social", "listen"].includes(game.engine)) return "low";
  return "medium";
}

function languageFor(game: GameConfig): "low" | "medium" | "high" {
  if (game.category === "language") return "high";
  if (["social", "listen", "situation-feelings"].includes(game.engine)) return "high";
  if (["tapping", "tracing"].includes(game.engine)) return "low";
  return "medium";
}

function socialFor(game: GameConfig): "low" | "medium" | "high" {
  if (game.engine === "social") return "medium";
  if (game.supportsShared) return "medium";
  return "low";
}

function sensoryFor(game: GameConfig): "low" | "medium" | "high" {
  if (game.engine === "sound-memory") return "high";
  if (["tapping", "playground", "sandbox", "slide", "bench", "magic-toys"].includes(game.engine)) return "medium";
  return "low";
}

function supportPrereqsFor(game: GameConfig): string[] {
  const prereqs: string[] = [];
  if (game.difficulty === "medium") prereqs.push("Comfortable choosing between a few options");
  if (game.difficulty === "hard") prereqs.push("Comfortable with more options and mild distraction");
  return prereqs;
}

function contextFor(game: GameConfig): string {
  const theme = String(game.config.theme || "");
  if (familyFor(game) === "daily-living") return "Real-world daily routine; caregiver-led follow-up recommended";
  if (theme) return `Practiced with ${theme.split("-").join(" ")} materials`;
  return "Practiced in the app play space";
}

export function classifyActivity(game: GameConfig): ActivitySpec {
  const mechanic = game.engine === "tapping" ? traceMechanic(game.config) : ENGINE_MECHANIC[game.engine] || "open-ended-play";
  return {
    gameId: game.id,
    name: game.name,
    family: familyFor(game),
    mechanic,
    learningObjective: objectiveFor(game),
    modalities: modalitiesFor(game),
    motor: motorFor(game),
    language: languageFor(game),
    social: socialFor(game),
    supportPrereqs: supportPrereqsFor(game),
    sensoryLoad: sensoryFor(game),
    effortMinutes: game.estimatedMinutes,
    breakOpportunities: game.engine !== "tapping",
    generalizationContext: contextFor(game),
    contentVersion: DEFAULT_CONTENT_VERSION,
  };
}

export interface LibrarySummary {
  total: number;
  families: { family: ActivityFamily; count: number }[];
  mechanics: { mechanic: string; count: number }[];
  themedVariants: number;
  duplicates: number;
}

export function libraryHonestSummary(games: GameConfig[]): LibrarySummary {
  const familyCounts = new Map<ActivityFamily, number>();
  const mechanicCounts = new Map<string, number>();
  let themedVariants = 0;

  const seenConfig = new Map<string, string>();
  for (const game of games) {
    const spec = classifyActivity(game);
    familyCounts.set(spec.family, (familyCounts.get(spec.family) || 0) + 1);
    mechanicCounts.set(spec.mechanic, (mechanicCounts.get(spec.mechanic) || 0) + 1);
    const key = `${game.engine}|${game.difficulty}|${game.estimatedMinutes}|${game.supportsShared}`;
    if (seenConfig.has(key)) themedVariants += 1;
    else seenConfig.set(key, game.id);
  }

  return {
    total: games.length,
    families: Array.from(familyCounts.entries())
      .map(([family, count]) => ({ family, count }))
      .sort((left, right) => right.count - left.count),
    mechanics: Array.from(mechanicCounts.entries())
      .map(([mechanic, count]) => ({ mechanic, count }))
      .sort((left, right) => right.count - left.count),
    themedVariants,
    duplicates: games.length - dedupeCatalog(games).length,
  };
}

export function dedupeCatalog(games: GameConfig[]): GameConfig[] {
  const seen = new Set<string>();
  const result: GameConfig[] = [];
  for (const game of games) {
    if (seen.has(game.name)) continue;
    seen.add(game.name);
    result.push(game);
  }
  return result;
}