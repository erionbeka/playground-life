import { useMemo } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { consistencyScore, latencyProfile, learningCurve } from "@/lib/science";
import { domainSummary, domainTrajectory, startTierForDomains } from "@/lib/childModel";
import type { SessionTrace } from "@/lib/gameAnalytics";

interface ResultPoint {
  completedAt: string;
  score: number;
  independenceRate?: number;
}

interface Props {
  results: ResultPoint[];
  traces?: SessionTrace[];
  childId?: string;
}

function Gauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 52;
  const circumference = Math.PI * radius;
  const filled = (clamped / 100) * circumference;
  const color = clamped >= 80 ? "#10b981" : clamped >= 60 ? "#4daace" : "#f59e0b";

  return (
    <svg width="140" height="86" viewBox="0 0 140 86" aria-hidden="true">
      <path d={`M 18 78 A ${radius} ${radius} 0 0 1 122 78`} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
      <path
        d={`M 18 78 A ${radius} ${radius} 0 0 1 122 78`}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
      />
      <text x="70" y="66" textAnchor="middle" fontSize="24" fontWeight="800" fill="currentColor" className="text-foreground">
        {clamped}%
      </text>
    </svg>
  );
}

function LatencyHistogram({ trace }: { trace: SessionTrace }) {
  const latencies = trace.trials.filter((t) => t.correct).map((t) => t.latencyMs);
  if (latencies.length < 3) return null;

  const profile = latencyProfile(latencies);
  const maxMs = profile.q3 + 1.5 * profile.iqr || Math.max(...latencies);
  const buckets = Array.from({ length: 8 }, (_, index) => ({
    from: (index * maxMs) / 8,
    to: ((index + 1) * maxMs) / 8,
    count: 0,
  }));
  for (const ms of latencies) {
    const bucketIndex = Math.min(7, Math.floor(ms / (maxMs / 8)));
    buckets[bucketIndex].count += 1;
  }
  const peak = Math.max(...buckets.map((b) => b.count));

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Response time spread · median {profile.median < 1000 ? `${profile.median}ms` : `${(profile.median / 1000).toFixed(1)}s`} · {profile.band}
      </p>
      <div className="mt-2 flex h-20 items-end gap-1">
        {buckets.map((bucket, index) => (
          <div key={index} className="flex-1 rounded-t-md bg-primary/25" style={{ height: `${peak ? (bucket.count / peak) * 100 : 0}%` }} title={`${bucket.count} responses`} />
        ))}
      </div>
      {profile.outliers > 0 ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{profile.outliers} unusually slow response{profile.outliers === 1 ? "" : "s"} outside the normal range.</p>
      ) : null}
    </div>
  );
}

export default function InsightDashboard({ results, traces, childId }: { results: ResultPoint[]; traces?: SessionTrace[]; childId?: string }) {
  const curve = useMemo(() => learningCurve(results), [results]);
  const latestIndependence = results.length
    ? results[results.length - 1].independenceRate ?? results[results.length - 1].score
    : null;
  const allTraces = (traces || []).filter(Boolean);
  const correctFlags = allTraces.flatMap((trace) => trace.trials.map((trial) => trial.correct));
  const consistency = consistencyScore(correctFlags);
  const latestTrace = allTraces[allTraces.length - 1];

  const domains = useMemo(
    () => (childId ? domainSummary(childId).filter((d) => d.samples >= 1) : []),
    [childId]
  );
  const startTier = childId ? startTierForDomains(childId, ["attention", "sequencing", "communication"]) : null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-sky-50/60 to-indigo-50/50 p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Insight Dashboard</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Learning curve · independence per session</p>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={curve.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.18)" />
              <XAxis dataKey="x" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
              <Line type="monotone" dataKey="y" name="Independence %" stroke="#4daace" strokeWidth={2.5} dot={{ r: 3 }} />
              {curve.regression ? (
                <Line
                  type="linear"
                  dataKey={(entry: { x: number }) => curve.regression!.intercept + curve.regression!.slope * entry.x}
                  name={`Trend (${curve.regression.slope > 0 ? "+" : ""}${curve.regression.slope}/session)`}
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
          <p className={`mt-1 text-xs font-semibold ${curve.tone === "good" ? "text-emerald-700" : curve.tone === "watch" ? "text-amber-700" : "text-muted-foreground"}`}>
            {curve.slopeLabel}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Latest independence</p>
          <div className="mt-1 text-foreground">{latestIndependence !== null ? <Gauge value={latestIndependence} /> : <p className="text-sm text-muted-foreground">No sessions yet</p>}</div>
          {consistency > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Best correct streak: {Math.round(consistency * 100)}% of trials in a row</p>
          ) : null}
        </div>

        {latestTrace ? (
          <div className="rounded-2xl border border-border bg-card p-4 md:col-span-2">
            <LatencyHistogram trace={latestTrace} />
          </div>
        ) : null}

        {domains.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4 md:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ability by domain (model estimate)</p>
            <div className="mt-2 space-y-1.5">
              {domains.map((entry) => {
                const history = childId ? domainTrajectory(childId, entry.domain) : [];
                const spark = history.length >= 2
                  ? history.map((v, i) => `${(i / (history.length - 1)) * 56},${18 - (v / 100) * 16}`).join(" ")
                  : "";
                return (
                  <div key={entry.domain} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-[11px] font-semibold capitalize text-muted-foreground">{entry.domain.replace(/-/g, " ")}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, entry.ability)}%`,
                          backgroundColor: entry.ability >= 70 ? "#10b981" : entry.ability >= 50 ? "#4daace" : "#f59e0b",
                        }}
                      />
                    </div>
                    {spark ? (
                      <svg width="56" height="18" aria-hidden="true" className="shrink-0">
                        <polyline points={spark} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="w-[56px]" />
                    )}
                    <span className="w-10 text-right text-[11px] font-bold text-foreground">{Math.round(entry.ability)}</span>
                  </div>
                );
              })}
            </div>
            {startTier ? (
              <p className="mt-2 text-xs font-semibold text-primary">
                Model recommends starting new sessions at <span className="capitalize">{startTier}</span> difficulty.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
