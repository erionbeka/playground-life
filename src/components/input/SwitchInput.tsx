import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 250;

export function useSwitchSignal({
  keys,
  onClick,
  enabled,
  onSignal,
}: {
  keys: string[];
  onClick: boolean;
  enabled: boolean;
  onSignal: () => void;
}): void {
  const signalRef = useRef(onSignal);
  signalRef.current = onSignal;
  const lastRef = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    if (!enabled) return;
    const emit = () => {
      const now = Date.now();
      if (now - lastRef.current < DEBOUNCE_MS) return;
      lastRef.current = now;
      signalRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (keys.includes(event.key) || keys.includes(event.code)) {
        event.preventDefault();
        emit();
      }
    };
    const onPointerDown = () => emit();
    window.addEventListener("keydown", onKeyDown);
    if (onClick) window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [keys, onClick, enabled]);
}
