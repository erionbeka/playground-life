/**
 * Expressive expansion ladders for requesting activities.
 *
 * A child's request grows one step at a time: a single word, then a phrase,
 * then a full sentence, then a sentence with an attribute. This mirrors typical
 * early expressive language development and is our own scaffold, not any
 * published instrument's item sequence.
 */
export const MAX_LADDER_RUNG = 3;

export function buildRequestLadder(coreWord: string): string[] {
  const word = coreWord.trim() || "that";
  return [word, `want ${word}`, `I want ${word}`, `I want the ${word}`];
}

/** Which rung to model after this many successful requests (clamped to the ladder). */
export function ladderRungFor(requestsMade: number): number {
  if (!Number.isFinite(requestsMade)) return 0;
  return Math.max(0, Math.min(MAX_LADDER_RUNG, Math.floor(requestsMade)));
}

export function coreWordForTheme(theme: string): string {
  const key = theme.toLowerCase();
  if (key.includes("all done") || key.includes("all-done")) return "all done";
  if (key.includes("snack")) return "snack";
  if (key.includes("help")) return "help";
  if (key.includes("more")) return "more";
  if (key.includes("break")) return "break";
  if (key.includes("favorite") || key.includes("favourite")) return "favorite";
  return "help";
}
