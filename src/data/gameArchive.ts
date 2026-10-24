export interface ArchiveInfo {
  archived: true;
  archiveReason: string;
  replacementId?: string;
}

const ARCHIVED_GAMES: Record<string, Omit<ArchiveInfo, "archived">> = {
  "game-054": { archiveReason: "Duplicate tap-and-catch target already covered by Tap Bubbles.", replacementId: "game-052" },
  "game-055": { archiveReason: "Duplicate tap-and-catch target already covered by Tap Butterflies.", replacementId: "game-051" },
  "game-057": { archiveReason: "Duplicate tap-and-catch target already covered by Tap Butterflies.", replacementId: "game-051" },
  "game-058": { archiveReason: "Duplicate tap-and-catch target already covered by Tap Butterflies.", replacementId: "game-051" },
  "game-059": { archiveReason: "Duplicate tap-and-catch target already covered by Tap Bubbles.", replacementId: "game-052" },
  "game-061": { archiveReason: "Duplicate tap-and-catch target already covered by Tap Butterflies.", replacementId: "game-051" },
  "game-062": { archiveReason: "Duplicate tap-and-catch target already covered by Tap Butterflies.", replacementId: "game-051" },
  "game-063": { archiveReason: "Duplicate tap-and-catch target already covered by Tap Bubbles.", replacementId: "game-052" },
  "game-064": { archiveReason: "Duplicate tap-and-catch target already covered by Tap Butterflies.", replacementId: "game-051" },
  "game-065": { archiveReason: "Duplicate tap-and-catch target already covered by Tap Butterflies.", replacementId: "game-051" },
  "game-165": { archiveReason: "Duplicate fine-motor tapping target; Tap & Aim covers the same response.", replacementId: "game-166" },
  "game-169": { archiveReason: "Duplicate fine-motor tapping target; Tap & Aim covers the same response.", replacementId: "game-166" },
  "game-170": { archiveReason: "Duplicate fine-motor tapping target; Tap & Aim covers the same response.", replacementId: "game-166" },
  "game-174": { archiveReason: "Duplicate fine-motor aiming target; Tap & Aim covers the same response.", replacementId: "game-166" },
  "game-187": { archiveReason: "Duplicate counting set already covered by Count Stars.", replacementId: "game-118" },
  "game-188": { archiveReason: "Duplicate color-matching content already covered by Match Colors.", replacementId: "game-017" },
  "game-195": { archiveReason: "Duplicate bubble tapping content already covered by Tap Bubbles.", replacementId: "game-052" },
  "game-205": { archiveReason: "Duplicate sorting content already covered by Sort: Fruits vs Vegetables.", replacementId: "game-050" },
  "game-206": { archiveReason: "Duplicate shadow-matching content already covered by Match Shapes.", replacementId: "game-014" },
  "game-209": { archiveReason: "Duplicate counting response with a different picture set.", replacementId: "game-117" },
  "game-210": { archiveReason: "Duplicate counting response with a different picture set.", replacementId: "game-117" },
  "game-211": { archiveReason: "Duplicate counting response with a different picture set.", replacementId: "game-118" },
  "game-212": { archiveReason: "Duplicate counting response with a different picture set.", replacementId: "game-118" },
  "game-213": { archiveReason: "Duplicate counting response with a different picture set.", replacementId: "game-118" },
  "game-214": { archiveReason: "Duplicate counting response with a different picture set.", replacementId: "game-118" },
  "game-157": { archiveReason: "Superseded by the dedicated Grammar: Sentence Builder activity.", replacementId: "game-235" },
  "game-158": { archiveReason: "Duplicate pattern-continuation content already covered by Next: Color Trios.", replacementId: "game-196" },
};

export function archiveInfoFor(id: string): ArchiveInfo | Record<string, never> {
  const info = ARCHIVED_GAMES[id];
  return info ? { archived: true, ...info } : {};
}

export function isArchivedGame(id: string): boolean {
  return Boolean(ARCHIVED_GAMES[id]);
}

export function archivedGameIds(): string[] {
  return Object.keys(ARCHIVED_GAMES);
}

export function archivedGameRecord(): Readonly<Record<string, Omit<ArchiveInfo, "archived">>> {
  return ARCHIVED_GAMES;
}
