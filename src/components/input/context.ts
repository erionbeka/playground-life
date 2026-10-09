import { createContext, useCallback, useContext } from "react";
import type { InputMode, InputModeSettings } from "@/lib/inputMode";

export interface InputModeContextValue {
  mode: InputMode;
  settings: InputModeSettings;
  childId?: string;
  version: number;
  setRegion: (name: string, priority: number, element: HTMLElement | null) => void;
  activate: (element: HTMLElement) => void;
}

export const InputModeContext = createContext<InputModeContextValue | null>(null);

export function useInputModeContext(): InputModeContextValue | null {
  return useContext(InputModeContext);
}

export function useTargetRegion(name: string, priority: number) {
  const context = useContext(InputModeContext);
  const setRegion = context?.setRegion;
  return useCallback(
    (element: HTMLElement | null) => {
      setRegion?.(name, priority, element);
    },
    [setRegion, name, priority],
  );
}
