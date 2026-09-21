const SKIP_KEY = "pp-social-theme-skips-v1";

export function getSkippedSocialThemes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SKIP_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function isSocialThemeSkipped(theme: string): boolean {
  return getSkippedSocialThemes().includes(theme.toLowerCase());
}

export function addSkippedSocialTheme(theme: string) {
  const current = getSkippedSocialThemes();
  const next = Array.from(new Set([...current, theme.toLowerCase()]));
  try {
    window.localStorage.setItem(SKIP_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

export function clearSkippedSocialThemes() {
  try {
    window.localStorage.removeItem(SKIP_KEY);
  } catch {
    /* storage unavailable */
  }
}