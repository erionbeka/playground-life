import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { SessionTrace, TrialRecord } from "@/lib/gameAnalytics";

interface Props {
  trace: SessionTrace;
}

type View = "replay" | "maps" | "speed";

function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function emojiLead(option: string): string {
  const grapheme = Array.from(option)[0];
  return /\p{Extended_Pictographic}/u.test(grapheme) ? grapheme : "";
}

function LatencyChart({ trials }: { trials: TrialRecord[] }) {
  const correct = trials.filter((t) => t.correct);
  if (correct.length < 2) {
    return <p className="text-xs text-muted-foreground">Needs at least two correct answers to chart speed.</p>;
  }
  const max = Math.max(...correct.map((t) => t.latencyMs), 100);
  const width = 280;
  const height = 56;
  const step = width / (correct.length - 1);
  const points = correct
    .map((t, i) => `${Math.round(i * step)},${height - (t.latencyMs / max) * (height - 6) - 3}`)
    .join(" ");

  return (
    <svg width={width} height={height} className="mt-1 overflow-visible" aria-hidden="true">
      <polyline points={points} fill="none" stroke="rgb(59,130,246)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {correct.map((t, i) => (
        <circle key={i} cx={i * step} cy={height - (t.latencyMs / max) * (height - 6) - 3} r="2.5" fill="rgb(59,130,246)" />
      ))}
    </svg>
  );
}

function PositionHeatmap({ trials }: { trials: TrialRecord[] }) {
  const positioned = trials.filter((t) => t.positionIndex >= 0 && t.choiceCount >= 2);

  const columns = [
    { key: "left", label: "Left", taps: 0, correct: 0 },
    { key: "middle", label: "Middle", taps: 0, correct: 0 },
    { key: "right", label: "Right", taps: 0, correct: 0 },
  ].map((column) => {
    const matches = positioned.filter((t) =>
      column.key === "left"
        ? t.positionIndex === 0
        : column.key === "right"
          ? t.positionIndex === t.choiceCount - 1
          : t.positionIndex > 0 && t.positionIndex < t.choiceCount - 1
    );
    return {
      ...column,
      taps: matches.length,
      correct: matches.filter((t) => t.correct).length,
    };
  });

  const total = columns.reduce((sum, c) => sum + c.taps, 0);
  const sideDominance = Math.max(
    total ? columns[0].taps / total : 0,
    total ? columns[2].taps / total : 0
  );

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Where they answered · {total} choice{total === 1 ? "" : "s"}
      </p>
      {total === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No positioned choices in this session.</p>
      ) : (
        <>
          <div className="mt-2 flex gap-3">
            {columns.map((column) => {
              const share = column.taps / total;
              const accuracy = column.taps ? Math.round((column.correct / column.taps) * 100) : 0;
              return (
                <div key={column.key} className="flex-1 rounded-2xl border border-border bg-muted/60 p-3 text-center">
                  <div
                    className="mx-auto grid h-12 w-full place-items-center rounded-xl font-black text-white"
                    style={{ backgroundColor: `rgba(77,170,206,${Math.max(0.12, share).toFixed(2)})` }}
                  >
                    {Math.round(share * 100)}%
                  </div>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{column.label}</p>
                  <p className="text-[10px] text-muted-foreground">{accuracy}% right</p>
                </div>
              );
            })}
          </div>
          {sideDominance >= 0.7 ? (
            <p className="mt-2 text-[11px] font-semibold text-amber-700">⚠ One side dominates — rotate layouts next session.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

function TapFieldMap({ trials }: { trials: TrialRecord[] }) {
  const withCoords = trials.filter((t) => typeof t.x === "number" && typeof t.y === "number");

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Touch map · {withCoords.length} field touches
      </p>
      {withCoords.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Touch-map data comes from tap-challenge games.</p>
      ) : (
        (() => {
          const cells = new Map<string, { hits: number; total: number }>();
          for (const trial of withCoords) {
            const cx = Math.min(4, Math.max(0, Math.floor((trial.x! / 100) * 5)));
            const cy = Math.min(4, Math.max(0, Math.floor((trial.y! / 100) * 5)));
            const key = `${cx}-${cy}`;
            const cell = cells.get(key) || { hits: 0, total: 0 };
            if (trial.correct) cell.hits += 1;
            cell.total += 1;
            cells.set(key, cell);
          }
          const maxTotal = Math.max(...Array.from(cells.values()).map((c) => c.total));
          return (
            <div className="mt-2 grid w-fit grid-cols-5 gap-1 rounded-2xl border border-border bg-slate-50 p-2">
              {Array.from({ length: 25 }, (_, index) => {
                const cx = index % 5;
                const cy = Math.floor(index / 5);
                const cell = cells.get(`${cx}-${cy}`);
                const intensity = cell ? cell.total / maxTotal : 0;
                return (
                  <div
                    key={index}
                    title={cell ? `${cell.total} touches · ${cell.hits} caught` : undefined}
                    className="h-9 w-9 rounded-lg border border-slate-200"
                    style={{ backgroundColor: cell ? `rgba(239,68,68,${0.08 + intensity * 0.75})` : undefined }}
                  />
                );
              })}
            </div>
          );
        })()
      )}
    </div>
  );
}

export default function TraceInspector({ trace }: Props) {
  const [view, setView] = useState<View>("replay");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const trials = trace.trials;
  const current: TrialRecord | undefined = trials[cursor];

  useMemo(() => {
    if (!playing || cursor >= trials.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setCursor((value) => value + 1), Math.min(1400, Math.max(350, (trials[cursor]?.latencyMs ?? 600) / 3)));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, cursor]);

  const views: { key: View; label: string }[] = [
    { key: "replay", label: "▶ Replay" },
    { key: "maps", label: "◉ Maps" },
    { key: "speed", label: "⚡ Speed" },
  ];

  return (
    <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-sky-50/70 to-indigo-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-foreground">Session replay & maps</p>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {views.map((entry) => (
            <button
              key={entry.key}
              onClick={() => setView(entry.key)}
              aria-pressed={view === entry.key}
              className={`touch-target rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                view === entry.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {view === "replay" ? (
        trials.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">This session recorded exploration only — no scored trials to replay.</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (cursor >= trials.length) setCursor(0);
                  setPlaying(!playing);
                }}
                className="touch-target grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-40"
                aria-label={playing ? "Pause replay" : "Play replay"}
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(trials.length - 1, 0)}
                value={cursor}
                onChange={(event) => setCursor(Number(event.target.value))}
                className="w-full accent-primary"
                aria-label="Replay position"
              />
              <span className="w-16 shrink-0 text-right text-xs font-bold text-muted-foreground">
                {cursor}/{trials.length}
              </span>
            </div>

            {current ? (
              <motion.div key={cursor} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="mt-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black text-white ${current.correct ? "bg-emerald-500" : "bg-rose-400"}`}>
                    {current.correct ? "✓" : "✕"}
                  </span>
                  <p className="text-sm font-bold text-foreground">{current.stimulus}</p>
                  {current.prompted ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">prompted</span> : null}
                  <span className="ml-auto text-xs font-bold text-blue-600">{fmt(current.latencyMs)}</span>
                </div>

                {current.options && current.options.length > 1 ? (
                  <div className={`mt-3 grid gap-2 ${current.options.length > 3 ? "grid-cols-4" : "grid-cols-2"}`}>
                    {current.options.map((option, index) => {
                      const chosen = index === current.positionIndex;
                      return (
                        <div
                          key={`${option}-${index}`}
                          className={`rounded-xl border-2 p-2 text-center text-sm font-semibold ${
                            chosen
                              ? current.correct
                                ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                : "border-rose-400 bg-rose-50 text-rose-900"
                              : "border-border bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <span aria-hidden="true">{emojiLead(option)}</span> {option}
                          {chosen ? <span className="ml-1">{current.correct ? "✓" : "✕"}</span> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {current.x !== undefined ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">Touched at {current.x}%, {current.y}%.</p>
                ) : null}
              </motion.div>
            ) : null}
          </>
        )
      ) : null}

      {view === "maps" ? (
        <div className="space-y-4">
          <PositionHeatmap trials={trials} />
          <TapFieldMap trials={trials} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">In-session events</p>
            {trace.events.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">None recorded.</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                {trace.events.slice(-6).map((event, index) => (
                  <li key={index}>· {event.type}{event.detail ? ` (${event.detail})` : ""} @ {fmt(event.at)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {view === "speed" ? (
        trials.some((t) => t.correct) ? <LatencyChart trials={trials} /> : <p className="text-sm text-muted-foreground">No correct trials recorded yet.</p>
      ) : null}
    </div>
  );
}
