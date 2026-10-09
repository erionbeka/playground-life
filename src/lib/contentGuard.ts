export const ORIGIN_CODE_TOKEN = /\b[A-Z]{1,4}\d{1,3}\b/;
export const BANNED_WORDING = /\b(?:item code|task code|scoring criteria|score of|protocol|task \d+|item \d+)\b/i;
export const ABLLS_MARK = /\bABLLS-R\s+[A-Z]\d{1,3}\b/;

export interface GuardMatch {
  pattern: "code-token" | "banned-wording" | "ablls-mark";
  text: string;
}

export function scanGuardedText(text: string): GuardMatch[] {
  const matches: GuardMatch[] = [];
  const tokenRe = new RegExp(ORIGIN_CODE_TOKEN.source, "g");
  for (const match of text.matchAll(tokenRe)) matches.push({ pattern: "code-token", text: match[0] });
  const bannedRe = new RegExp(BANNED_WORDING.source, "gi");
  for (const match of text.matchAll(bannedRe)) matches.push({ pattern: "banned-wording", text: match[0] });
  const abllsRe = new RegExp(ABLLS_MARK.source, "gi");
  for (const match of text.matchAll(abllsRe)) matches.push({ pattern: "ablls-mark", text: match[0] });
  return matches;
}
