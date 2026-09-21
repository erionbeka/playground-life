import { useEffect, useState } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

export function reduceMotionEffects(reducedMotion: boolean, calmMode: boolean): boolean {
  return reducedMotion || calmMode;
}

type MotionListener = (prefersReduced: boolean) => void;

export function watchReducedMotion(listener: MotionListener): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    listener(prefersReducedMotion());
    return () => {};
  }
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  const onChange = (event: MediaQueryListEvent) => listener(event.matches);
  const currentReduced = mql.matches;
  listener(currentReduced);
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }
  const legacy = (callback: () => void) => () => callback();
  const legacyUnsubscribe = legacy(() => onChange(mql as unknown as MediaQueryListEvent));
  mql.addListener(legacyUnsubscribe);
  return () => mql.removeListener(legacyUnsubscribe);
}

export function useReducedMotionMode(initial = prefersReducedMotion()): boolean {
  const [reduced, setReduced] = useState(initial);
  useEffect(() => watchReducedMotion(setReduced), []);
  return reduced;
}