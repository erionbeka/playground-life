import { useCallback, useState } from "react";

export interface AdaptiveSupport {
  errorStreak: number;
  successStreak: number;
  hintDelay: number;
  distractorAdjust: number;
  recordError: () => void;
  recordSuccess: (prompted?: boolean) => void;
}

interface Options {
  baseDelay?: number;
  minDelay?: number;
  maxDelay?: number;
}

/**
 * Dynamic prompting ladder: struggling children get faster hints and fewer
 * choices; children cruising independently earn extra challenge. This is the
 * in-session counterpart to the therapist's support-level setting.
 */
export function useAdaptiveSupport({ baseDelay = 6000, minDelay = 2200, maxDelay = 9000 }: Options = {}): AdaptiveSupport {
  const [errorStreak, setErrorStreak] = useState(0);
  const [successStreak, setSuccessStreak] = useState(0);

  const recordError = useCallback(() => {
    setSuccessStreak(0);
    setErrorStreak((value) => Math.min(value + 1, 5));
  }, []);

  const recordSuccess = useCallback((prompted?: boolean) => {
    setErrorStreak(0);
    if (!prompted) {
      setSuccessStreak((value) => Math.min(value + 1, 6));
    } else {
      setSuccessStreak(0);
    }
  }, []);

  const hintDelay = Math.max(minDelay, baseDelay - errorStreak * 1400 + successStreak * 350);
  const distractorAdjust = errorStreak >= 2 ? -1 : successStreak >= 4 ? 1 : 0;

  return { errorStreak, successStreak, hintDelay, distractorAdjust, recordError, recordSuccess };
}
