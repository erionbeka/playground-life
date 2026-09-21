import { useMemo } from "react";
import Sparkline from "@/components/therapist/Sparkline";

interface Props {
  results: Array<{ completedAt: string; score: number; accuracy?: number }>;
}

/** Family-friendly progress snapshot: trend line + plain-language summary. */
export default function FamilyProgress({ results }: Props) {
  const stats = useMemo(() => {
    const sorted = [...results].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
    const scores = sorted.map((r) => r.score);
    const avg = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
    const recent = scores.slice(-3);
    const older = scores.slice(0, Math.max(1, scores.length - 3));
    const recentAvg = recent.length ? Math.round(recent.reduce((s, v) => s + v, 0) / recent.length) : 0;
    const olderAvg = older.length ? Math.round(older.reduce((s, v) => s + v, 0) / older.length) : recentAvg;
    const direction = recentAvg > olderAvg + 2 ? "up" : recentAvg < olderAvg - 2 ? "down" : "steady";
    return { scores: sorted.slice(-10).map((r) => r.score), avg, sessions: sorted.length, direction, recentAvg };
  }, [results]);

  if (stats.sessions === 0) {
    return (
      <div className="mb-6 rounded-2xl border border-border bg-card/70 p-4 text-center">
        <p className="text-sm text-muted-foreground">Play the first game to start seeing progress here. 🌱</p>
      </div>
    );
  }

  const message =
    stats.direction === "up"
      ? "Scores are climbing — wonderful progress! 📈"
      : stats.direction === "down"
        ? "A dip is normal. Familiar games can help rebuild confidence."
        : "Steady practice is exactly what builds skills.";

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Progress</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {stats.sessions} session{stats.sessions === 1 ? "" : "s"} · average score {stats.avg}%
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{message}</p>
        </div>
        <Sparkline values={stats.scores} width={120} height={36} />
      </div>
    </div>
  );
}
