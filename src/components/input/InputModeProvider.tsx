import { ReactNode, useCallback, useMemo, useReducer, useRef, useState } from "react";
import { InputMode, useInputMode } from "@/lib/inputMode";
import { useReducedMotionMode } from "@/lib/motion";
import { useSensory } from "@/lib/sensory";
import { InputModeContext, InputModeContextValue } from "./context";
import { RegionRegistration } from "./targets";
import DwellController from "./DwellController";
import ScanController from "./ScanController";

function ScanStyles() {
  return <style>{".scan-target{outline:4px solid #22c55e;outline-offset:3px;border-radius:12px;}"}</style>;
}

export default function InputModeProvider({
  childId,
  modeOverride,
  children,
}: {
  childId?: string;
  modeOverride?: InputMode;
  children: ReactNode;
}) {
  const global = useInputMode();
  const reducedMotion = useReducedMotionMode();
  const calm = useSensory().calmMode;
  const reduced = reducedMotion || calm;

  const settings = useMemo(() => {
    const override = childId ? global.perChild[childId] : undefined;
    const merged = override ? { ...global, ...override, perChild: global.perChild } : global;
    return modeOverride ? { ...merged, mode: modeOverride } : merged;
  }, [global, childId, modeOverride]);

  const regionsRef = useRef<RegionRegistration[]>([]);
  const [version, bumpVersion] = useReducer((value: number) => value + 1, 0);
  const [paused, setPaused] = useState(false);

  const setRegion = useCallback((name: string, priority: number, element: HTMLElement | null) => {
    const next = regionsRef.current.filter((region) => region.name !== name);
    if (element) next.push({ name, priority, element });
    regionsRef.current = next;
    bumpVersion();
  }, []);

  const activate = useCallback((element: HTMLElement) => {
    if (!element || !element.isConnected) return;
    if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return;
    element.focus({ preventScroll: true });
    element.click();
  }, []);

  const value = useMemo<InputModeContextValue>(
    () => ({ mode: settings.mode, settings, childId, version, setRegion, activate }),
    [settings, childId, version, setRegion, activate],
  );

  return (
    <InputModeContext.Provider value={value}>
      <ScanStyles />
      {children}
      {settings.mode === "dwell" ? (
        <DwellController
          regionsRef={regionsRef}
          version={version}
          dwellMs={settings.dwellMs}
          showRing={settings.showDwellRing}
          reduced={reduced}
          onActivate={activate}
        />
      ) : null}
      {settings.mode === "switch" ? (
        <>
          <ScanController
            regionsRef={regionsRef}
            version={version}
            scanIntervalMs={settings.scanIntervalMs}
            scanAutostart={settings.scanAutostart}
            switchKeys={settings.switchKeys}
            switchOnClick={settings.switchOnClick}
            reduced={reduced}
            paused={paused}
            onPause={setPaused}
            onActivate={activate}
          />
          <button
            type="button"
            data-input-ignore
            onClick={() => setPaused((current) => !current)}
            style={{ position: "fixed", bottom: 12, right: 12, zIndex: 10000 }}
            className="rounded-full bg-slate-900/80 px-4 py-2 text-sm font-bold text-white"
          >
            {paused ? "▶ Resume scanning" : "⏸ Pause scanning"}
          </button>
        </>
      ) : null}
    </InputModeContext.Provider>
  );
}
