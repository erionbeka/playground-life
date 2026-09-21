export const COMPANION = {
  name: "Pip",
  emoji: "🦊",
} as const;

export function companionGreeting(childName: string): string {
  return `Hi ${childName}! I'm ${COMPANION.name} — I'll cheer you on today.`;
}

export function companionReady(childName: string): string {
  return `Ready when you are, ${childName}!`;
}

export function companionProud(): string {
  return `${COMPANION.name} is so proud of you! ${COMPANION.emoji}`;
}