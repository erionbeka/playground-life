import {
  DWELL_RANGE,
  SCAN_RANGE,
  TIMING_PRESETS,
  applyTimingPreset,
  clearChildInputMode,
  effectiveInputMode,
  presetFor,
  updateChildInputMode,
  updateInputMode,
} from "@/lib/inputMode";
import { useInputModeContext } from "./context";

export default function InputModeSettings() {
  const context = useInputModeContext();
  const childId = context?.childId;
  const settings = context?.settings ?? effectiveInputMode();
  const scoped = childId ? effectiveInputMode(childId) : settings;
  const preset = presetFor(scoped);

  const patch = (values: Parameters<typeof updateInputMode>[0]) => {
    if (childId) updateChildInputMode(childId, values);
    else updateInputMode(values);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/70 p-4">
      <label className="flex items-center justify-between gap-3 text-sm font-bold">
        Input mode
        <select
          aria-label="Input mode"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1"
          value={settings.mode}
          onChange={(event) => patch({ mode: event.target.value as typeof settings.mode })}
        >
          <option value="default">Default (tap / click)</option>
          <option value="dwell">Dwell (hold to activate)</option>
          <option value="switch">Switch (single-switch scan)</option>
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TIMING_PRESETS) as Array<keyof typeof TIMING_PRESETS>).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => applyTimingPreset(name, childId)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              preset === name ? "bg-primary text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {name} preset
          </button>
        ))}
      </div>

      <label className="block text-sm font-bold">
        Dwell time ({scoped.dwellMs} ms)
        <input
          aria-label="Dwell time"
          type="range"
          min={DWELL_RANGE.min}
          max={DWELL_RANGE.max}
          step={DWELL_RANGE.step}
          value={scoped.dwellMs}
          disabled={settings.mode !== "dwell"}
          onChange={(event) => patch({ dwellMs: Number(event.target.value) })}
          className="w-full"
        />
      </label>

      <label className="block text-sm font-bold">
        Scan speed ({scoped.scanIntervalMs} ms)
        <input
          aria-label="Scan speed"
          type="range"
          min={SCAN_RANGE.min}
          max={SCAN_RANGE.max}
          step={SCAN_RANGE.step}
          value={scoped.scanIntervalMs}
          disabled={settings.mode !== "switch"}
          onChange={(event) => patch({ scanIntervalMs: Number(event.target.value) })}
          className="w-full"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={scoped.scanAutostart}
          onChange={(event) => patch({ scanAutostart: event.target.checked })}
        />
        Start scanning automatically
      </label>

      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={scoped.switchOnClick}
          onChange={(event) => patch({ switchOnClick: event.target.checked })}
        />
        Click / tap counts as the switch
      </label>

      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={scoped.showDwellRing}
          onChange={(event) => patch({ showDwellRing: event.target.checked })}
        />
        Show dwell progress ring
      </label>

      <label className="block text-sm font-bold">
        Switch keys (comma separated)
        <input
          aria-label="Switch keys"
          type="text"
          value={scoped.switchKeys.join(", ")}
          onChange={(event) =>
            patch({
              switchKeys: event.target.value
                .split(",")
                .map((key) => key.trim())
                .filter(Boolean),
            })
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1"
        />
      </label>

      {childId ? (
        <button
          type="button"
          onClick={() => clearChildInputMode(childId)}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
        >
          Use for all children
        </button>
      ) : null}
    </div>
  );
}
