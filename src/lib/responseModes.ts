/**
 * First-class response modes.
 *
 * Every activity accepts more than one way to answer — spoken word, pointing,
 * symbol selection, a switch, dwell, or a plain tap — so the platform adapts to
 * how the child communicates instead of the child adapting to the platform.
 */
export const RESPONSE_MODES = [
  "vocal/verbal",
  "gesture/pointing",
  "symbol selection",
  "switch/scanning",
  "dwell",
  "touch",
] as const;

export type ResponseMode = (typeof RESPONSE_MODES)[number];

export interface ResponseModeOption {
  id: ResponseMode;
  label: string;
  emoji: string;
  hint: string;
}

export const RESPONSE_MODE_OPTIONS: ResponseModeOption[] = [
  { id: "vocal/verbal", label: "Spoken word", emoji: "🗣️", hint: "The child says their answer" },
  { id: "gesture/pointing", label: "Point or gesture", emoji: "👉", hint: "Point, reach, or gesture" },
  { id: "symbol selection", label: "Choose a symbol", emoji: "🔡", hint: "Select a picture or symbol" },
  { id: "switch/scanning", label: "Use a switch", emoji: "🔘", hint: "Press a switch to scan and select" },
  { id: "dwell", label: "Dwell", emoji: "⏱️", hint: "Hold still over a target" },
  { id: "touch", label: "Tap", emoji: "👆", hint: "Tap the screen" },
];

export function responseModeOption(id: ResponseMode): ResponseModeOption | undefined {
  return RESPONSE_MODE_OPTIONS.find((option) => option.id === id);
}
