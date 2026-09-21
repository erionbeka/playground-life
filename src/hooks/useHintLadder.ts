import { useEffect, useState } from "react";

interface HintLadderOptions {
  enabled: boolean;
  delayMs?: number;
  resetKey?: string | number;
}

export function useHintLadder({ enabled, delayMs = 6000, resetKey }: HintLadderOptions): boolean {
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    setHintVisible(false);
    if (!enabled) return undefined;

    const timer = window.setTimeout(() => setHintVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [enabled, delayMs, resetKey]);

  return hintVisible;
}
