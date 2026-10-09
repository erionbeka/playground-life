import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import ActivationRing from "./ActivationRing";
import { RegionRegistration, TARGET_SELECTOR, isEligibleTarget, resolveActiveTargets } from "./targets";

const STEP_MS = 50;

interface Props {
  regionsRef: MutableRefObject<RegionRegistration[]>;
  version: number;
  dwellMs: number;
  showRing: boolean;
  reduced: boolean;
  onActivate: (el: HTMLElement) => void;
}

interface RingState {
  rect: { left: number; top: number; width: number; height: number };
  progress: number;
}

export default function DwellController({ regionsRef, version, dwellMs, showRing, reduced, onActivate }: Props) {
  const [ring, setRing] = useState<RingState | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const lockRef = useRef<HTMLElement | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    targetRef.current = null;
    setRing(null);
  }, []);

  const begin = useCallback(
    (element: HTMLElement) => {
      if (targetRef.current === element) return;
      stop();
      targetRef.current = element;
      startRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        const current = targetRef.current;
        if (!current || !current.isConnected) {
          stop();
          return;
        }
        const progress = Math.min(1, (Date.now() - startRef.current) / dwellMs);
        if (showRing) {
          const rect = current.getBoundingClientRect();
          setRing({ rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, progress });
        }
        if (progress >= 1) {
          lockRef.current = current;
          onActivate(current);
          stop();
        }
      }, STEP_MS);
    },
    [dwellMs, onActivate, showRing, stop],
  );

  useEffect(() => {
    const resolveFromEvent = (event: Event): HTMLElement | null => {
      const hit = event.target as Element | null;
      const target = hit?.closest?.(TARGET_SELECTOR) as HTMLElement | null;
      if (!target || !isEligibleTarget(target)) return null;
      return resolveActiveTargets(regionsRef.current).includes(target) ? target : null;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const eligible = resolveFromEvent(event);
      if (!eligible) {
        lockRef.current = null;
        stop();
        return;
      }
      if (lockRef.current === eligible) return;
      begin(eligible);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      const eligible = resolveFromEvent(event);
      if (eligible) begin(eligible);
    };

    const onRelease = () => {
      lockRef.current = null;
      stop();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    window.addEventListener("blur", onRelease);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      window.removeEventListener("blur", onRelease);
      stop();
    };
  }, [begin, stop, regionsRef, version]);

  return <ActivationRing rect={ring?.rect ?? null} progress={ring?.progress ?? 0} reduced={reduced} />;
}
