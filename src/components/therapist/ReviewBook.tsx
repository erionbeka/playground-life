import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import TraceInspector from "./TraceInspector";
import type { HomeworkAssignment, GameResult } from "@/context/AppContext";
import { getGameById } from "@/data/games";

interface Props {
  assignment: Omit<HomeworkAssignment, "childName"> & { childName?: string };
  initialPage: number;
  onClose: () => void;
}

/** Book-style paged review: one spread per game, paper texture, flip navigation. */
export default function ReviewBook({ assignment, initialPage, onClose }: Props) {
  const results = assignment.results;
  const [page, setPage] = useState(Math.min(initialPage, Math.max(results.length - 1, 0)));
  const result: GameResult | undefined = results[page];
  const game = result ? getGameById(result.gameId) : undefined;

  const go = (delta: number) => setPage((p) => Math.max(0, Math.min(results.length - 1, p + delta)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, rotateY: -6 }}
        animate={{ scale: 1, rotateY: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] shadow-[0_40px_100px_rgba(15,23,42,0.45)]"
        style={{ background: "linear-gradient(105deg,#fffdf7 0%,#fdf8ec 55%,#f7efdc 100%)" }}
      >
        {/* Book header */}
        <div className="flex items-center justify-between border-b border-amber-900/10 px-6 py-4" style={{ background: "rgba(253,248,236,0.9)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-800/70">
              {assignment.childName || "Child"} · {assignment.type} · due {assignment.dueDate}
            </p>
            <h3 className="font-display text-lg font-extrabold text-slate-900">{assignment.notes?.split(" - ")[0] || "Session review"}</h3>
          </div>
          <button onClick={onClose} aria-label="Close review book" className="touch-target grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Page content */}
        <div className="min-h-[320px] flex-1 overflow-y-auto px-6 py-5">
          {!result ? (
            <p className="py-10 text-center text-sm text-slate-500">No recorded sessions in this assignment yet.</p>
          ) : (
            <div key={page}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl shadow-inner ring-1 ring-amber-900/10">
                    {game?.emoji ?? "🎮"}
                  </span>
                  <div>
                    <p className="font-display text-base font-extrabold text-slate-900">{game?.name || result.gameId}</p>
                    <p className="text-xs text-slate-500">Played {result.completedAt} · {Math.round(result.durationSeconds / 60)} min</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    result.completedSuccessfully === false ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  Score {result.score}
                </span>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[
                  ["Accuracy", `${result.accuracy ?? result.score}%`],
                  ["Trials", `${result.trials ?? result.interactions}`],
                  ["Errors", `${result.errors ?? 0}`],
                  ["Independence", `${result.independenceRate ?? result.accuracy ?? "-"}%`],
                  ["Prompts", `${result.promptsNeeded ?? 0}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-amber-900/10 bg-white/70 px-2 py-2 text-center">
                    <p className="text-sm font-extrabold text-slate-900">{value}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              {result.trace ? (
                <div className="rounded-2xl border border-amber-900/10 bg-white/60 p-1">
                  <TraceInspector trace={result.trace} />
                </div>
              ) : (
                <p className="rounded-xl bg-white/60 p-3 text-xs text-slate-500">
                  Replay data wasn't captured for this older session.
                </p>
              )}

              {result.observations && result.observations.length > 0 ? (
                <ul className="mt-4 space-y-1 text-sm text-slate-700">
                  {result.observations.map((o) => (
                    <li key={o}>· {o}</li>
                  ))}
                </ul>
              ) : null}

              <p className="mt-4 text-center font-display text-sm italic text-amber-900/60">— page {page + 1} of {results.length} —</p>
            </div>
          )}
        </div>

        {/* Flip controls */}
        <div className="flex items-center justify-between border-t border-amber-900/10 px-6 py-3" style={{ background: "rgba(253,248,236,0.9)" }}>
          <button
            onClick={() => go(-1)}
            disabled={page === 0}
            className="touch-target rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow ring-1 ring-amber-900/10 disabled:opacity-40"
          >
            ‹ Previous
          </button>
          <div className="flex gap-1.5">
            {results.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Go to page ${i + 1}`}
                className={`h-2.5 w-2.5 rounded-full ${i === page ? "bg-amber-600" : "bg-amber-900/20"}`}
              />
            ))}
          </div>
          <button
            onClick={() => go(1)}
            disabled={page >= results.length - 1}
            className="touch-target rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow ring-1 ring-amber-900/10 disabled:opacity-40"
          >
            Next ›
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
