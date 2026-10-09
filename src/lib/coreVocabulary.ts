export interface CoreWord {
  /** Stable identifier used for logging and lookup. */
  id: string;
  /** On-screen label. */
  label: string;
  /** Emoji symbol, matching the app's visual language. */
  emoji: string;
  /** Text spoken by text-to-speech when the word is used. */
  spoken: string;
}

/**
 * Fixed core vocabulary for the persistent AAC bar.
 *
 * Order is intentional and must not be shuffled at runtime: a stable position
 * for each word supports motor-planning consistency, which is a core principle
 * of robust AAC (the same word is always in the same place).
 *
 * These are high-frequency core words, independent of any published
 * assessment instrument. No external item wording, codes, or scoring criteria
 * are referenced.
 */
export const CORE_WORDS: CoreWord[] = [
  { id: "i", label: "I", emoji: "👤", spoken: "I" },
  { id: "want", label: "want", emoji: "🤲", spoken: "want" },
  { id: "more", label: "more", emoji: "➕", spoken: "more" },
  { id: "go", label: "go", emoji: "▶️", spoken: "go" },
  { id: "stop", label: "stop", emoji: "🛑", spoken: "stop" },
  { id: "help", label: "help", emoji: "🤝", spoken: "help" },
  { id: "all-done", label: "all done", emoji: "✅", spoken: "all done" },
  { id: "my-turn", label: "my turn", emoji: "🔄", spoken: "my turn" },
  { id: "please", label: "please", emoji: "🙏", spoken: "please" },
  { id: "yes", label: "yes", emoji: "👍", spoken: "yes" },
  { id: "no", label: "no", emoji: "👎", spoken: "no" },
  { id: "look", label: "look", emoji: "👀", spoken: "look" },
];

export const CORE_WORD_SET: Map<string, CoreWord> = new Map(
  CORE_WORDS.map((word) => [word.id, word]),
);
