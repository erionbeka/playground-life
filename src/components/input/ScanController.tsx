import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { useSwitchSignal } from "./SwitchInput";
import { RegionRegistration, isEligibleTarget, resolveActiveTargets } from "./targets";

interface Props {
  regionsRef: MutableRefObject<RegionRegistration[]>;
  version: number;
  scanIntervalMs: number;
  scanAutostart: boolean;
  switchKeys: string[];
  switchOnClick: boolean;
  reduced: boolean;
  paused: boolean;
  onPause: (paused: boolean) => void;
  onActivate: (el: HTMLElement) => void;
}

export default function ScanController({
  regionsRef,
  version,
  scanIntervalMs,
  scanAutostart,
  switchKeys,
  switchOnClick,
  paused,
  onPause,
  onActivate,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const scanningRef = useRef(false);
  const indexRef = useRef(0);
  const prevRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearHighlight = useCallback(() => {
    prevRef.current?.classList.remove("scan-target");
    prevRef.current = null;
  }, []);

  const highlight = useCallback(
    (index: number, list = resolveActiveTargets(regionsRef.current)) => {
      if (list.length === 0) {
        clearHighlight();
        setActiveIndex(-1);
        return;
      }
      const normalized = ((index % list.length) + list.length) % list.length;
      indexRef.current = normalized;
      const element = list[normalized];
      prevRef.current?.classList.remove("scan-target");
      element.classList.add("scan-target");
      element.focus({ preventScroll: true });
      prevRef.current = element;
      setActiveIndex(normalized);
    },
    [clearHighlight, regionsRef],
  );

  const stop = useCallback(() => {
    scanningRef.current = false;
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    clearHighlight();
    setActiveIndex(-1);
  }, [clearHighlight]);

  const start = useCallback(() => {
    const list = resolveActiveTargets(regionsRef.current);
    if (list.length === 0) return;
    scanningRef.current = true;
    highlight(0, list);
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (resolveActiveTargets(regionsRef.current).length === 0) return;
      highlight(indexRef.current + 1);
    }, scanIntervalMs);
  }, [highlight, regionsRef, scanIntervalMs]);

  const signalRef = useRef<() => void>(() => {});
  signalRef.current = () => {
    if (scanningRef.current) {
      const element = prevRef.current;
      stop();
      if (element && element.isConnected && isEligibleTarget(element)) onActivate(element);
    } else {
      start();
    }
  };

  const onSignal = useCallback(() => signalRef.current(), []);
  useSwitchSignal({ keys: switchKeys, onClick: switchOnClick, enabled: !paused, onSignal });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onPause(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPause]);

  useEffect(() => {
    if (paused) {
      stop();
      return;
    }
    if (scanAutostart) start();
  }, [paused, scanAutostart, start, stop]);

  useEffect(() => {
    if (scanningRef.current) highlight(0);
    else if (scanAutostart && !paused) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => () => stop(), [stop]);

  return (
    <span
      aria-hidden="true"
      data-input-ignore
      data-scan-index={activeIndex}
      style={{ display: "none" }}
    />
  );
}
