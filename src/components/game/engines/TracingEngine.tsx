import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { clamp, getAdaptiveGameConfig, shouldShowCountdown } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import { useSensory } from "@/lib/sensory";
import { BurstLayer, pointFromEvent, useBursts } from "../Juice";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import LearningLabel from "../LearningLabel";
import { createSessionRecorder, nowMs } from "@/lib/gameAnalytics";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

const TRACE_PATHS: Record<string, { label: string; points: [number, number][] }> = {
  "trace lines": {
    label: "Straight line",
    points: [[8, 50], [22, 50], [36, 50], [50, 50], [64, 50], [78, 50], [92, 50]],
  },
  "zig-zag trace": {
    label: "Zigzag",
    points: [[10, 72], [30, 28], [50, 72], [70, 28], [90, 72]],
  },
  "circle draw": {
    label: "Circle",
    points: Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2;
      return [Math.round(50 + 34 * Math.sin(angle)), Math.round(50 - 34 * Math.cos(angle))] as [number, number];
    }),
  },
  "connect dots": {
    label: "Dot to dot",
    points: [[18, 24], [82, 24], [82, 76], [18, 76], [50, 50]],
  },
  "swipe patterns": {
    label: "Wave",
    points: [[8, 55], [21, 30], [34, 55], [47, 80], [60, 55], [73, 30], [86, 55]],
  },
  "slow drag": {
    label: "Slow curve",
    points: [[10, 80], [30, 74], [52, 58], [70, 38], [88, 24]],
  },
  "follow the path": {
    label: "Winding road",
    points: [[10, 85], [34, 78], [42, 56], [58, 44], [66, 22], [90, 16]],
  },
  "spiral trace": {
    label: "Spiral",
    points: Array.from({ length: 14 }, (_, index) => {
      const angle = index * (Math.PI / 7);
      const radius = 8 + index * 2.5;
      return [Math.round(50 + radius * Math.sin(angle)), Math.round(50 - radius * Math.cos(angle))] as [number, number];
    }),
  },
  "rainbow arc": {
    label: "Rainbow arc",
    points: Array.from({ length: 9 }, (_, index) => {
      const t = index / 8;
      return [Math.round(12 + 76 * t), Math.round(85 - 70 * Math.sin(Math.PI * t))] as [number, number];
    }),
  },
  "heart trace": {
    label: "Heart",
    points: [
      [50, 78], [30, 62], [20, 46], [24, 32], [36, 26],
      [46, 30], [50, 38], [54, 30], [64, 26], [76, 32],
      [80, 46], [70, 62], [50, 78],
    ],
  },
  "star trace": {
    label: "Star",
    points: [
      [50, 12], [61, 40], [90, 42], [67, 60], [75, 88],
      [50, 71], [25, 88], [33, 60], [10, 42], [39, 40], [50, 12],
    ],
  },
};

const HIT_RADIUS = 13;

function toPolyline(points: [number, number][], close = false) {
  const body = points.map(([x, y]) => `${x},${y}`).join(" ");
  return close ? `${body} ${points[0][0]},${points[0][1]}` : body;
}

export default function TracingEngine({ game, onInteraction, onComplete }: Props) {
  const theme = ((game.config.theme as string) || "default").toLowerCase();
  const { difficulty, supportLevel } = getAdaptiveGameConfig(game);
  const { calmMode } = useSensory();
  const path = TRACE_PATHS[theme] || TRACE_PATHS["trace lines"];
  const baseRatio = difficulty === "easy" ? 0.6 : difficulty === "medium" ? 0.75 : 1;
  const requiredRatio = calmMode
    ? Math.max(0.35, baseRatio - 0.25)
    : supportLevel === "high"
      ? Math.max(0.4, baseRatio - 0.2)
      : baseRatio;
  const requiredHits = Math.max(2, Math.ceil(path.points.length * requiredRatio));

  const fieldRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const visitedRef = useRef<number[]>([]);
  const startedAtRef = useRef(nowMs());
  const [visited, setVisited] = useState<number[]>([]);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(shouldShowCountdown(calmMode, supportLevel) ? 25 : null);
  const timed = shouldShowCountdown(calmMode, supportLevel);
  const [demoStep, setDemoStep] = useState(-1);
  const { bursts, fireBurst } = useBursts();
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);

  const progress = Math.round((visited.length / path.points.length) * 100);

  const finish = useCallback(
    (success: boolean) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const coverage = visited.length / path.points.length;
      const score = success ? Math.max(70, Math.round(coverage * 100)) : clamp(Math.round(coverage * 90), 35, 100);
      rec.trial({
        stimulus: `trace:${path.label}`,
        correct: success,
        latencyMs: Math.round(nowMs() - startedAtRef.current),
        choiceCount: path.points.length,
        prompted: supportLevel === "high",
      });
      onComplete(score, undefined, withTrace(rec, buildCompletionMetrics({
        trials: trail.length || 1,
        correctTrials: visited.length,
        errors: Math.max(0, requiredHits - visited.length),
        masteryThreshold: masteryForSupport(supportLevel, { high: 45, moderate: 55 }),
        promptsNeeded: supportLevel === "high" ? 1 : 0,
        attemptsBySkill: { "fine-motor": trail.length || 1, precision: visited.length },
        observations: [`Traced ${visited.length}/${path.points.length} checkpoints (${progress}%) on the ${path.label.toLowerCase()} path.`],
      })));
    },
    [onComplete, path.label, path.points.length, progress, rec, requiredHits, supportLevel, trail.length, visited.length]
  );

  useEffect(() => {
    if (calmMode) return;
    speak(`Follow the ${path.label.toLowerCase()} with your finger.`);
  }, [calmMode, path.label]);

  useEffect(() => {
    completedRef.current = false;
    visitedRef.current = [];
    setVisited([]);
    setTrail([]);
    setTimeLeft(calmMode ? null : 25);
  }, [calmMode, theme]);

  useEffect(() => {
    if (!timed) return;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current === null || current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timed]);

  useEffect(() => {
    if (timeLeft === null || timeLeft !== 0) return;
    finish(false);
  }, [finish, timeLeft]);

  useEffect(() => {
    if (visited.length >= requiredHits) {
      if (!completedRef.current) {
        speak("You did it. Beautiful tracing.");
        fireBurst(50, 45, "🌟");
      }
      finish(true);
      return;
    }
    if (supportLevel !== "high") return;
    if (demoStep >= path.points.length - 1) return;
    const timer = window.setTimeout(() => setDemoStep((step) => step + 1), 420);
    return () => window.clearTimeout(timer);
  }, [demoStep, finish, fireBurst, path.points.length, requiredHits, supportLevel, visited.length]);

  const trackPoint = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (completedRef.current) return;
      onInteraction();
      const point = pointFromEvent(event, fieldRef.current);
      setTrail((currentTrail) => [...currentTrail.slice(-79), [point.x, point.y]]);
      let hitIndex = -1;
      for (let index = 0; index < path.points.length; index += 1) {
        if (visitedRef.current.includes(index)) continue;
        const [x, y] = path.points[index];
        if (Math.hypot(point.x - x, point.y - y) <= HIT_RADIUS) {
          hitIndex = index;
          break;
        }
      }
      if (hitIndex === -1) return;
      visitedRef.current = [...visitedRef.current, hitIndex];
      setVisited(visitedRef.current);
      rec.event("checkpoint", `${hitIndex + 1}/${path.points.length}`);
      fireBurst(point.x, point.y, "⭐");
    },
    [fireBurst, onInteraction, path.points, rec]
  );

  const demoPoint = demoStep >= 0 && demoStep < path.points.length ? path.points[demoStep] : null;

  return (
    <div className="mx-auto max-w-lg">
      <LearningLabel game={game} />
      <div className="mb-3 flex justify-between text-sm text-muted-foreground">
        <span>{calmMode ? "No rush 🌈" : timed ? `⏱ ${timeLeft}s` : null}</span>
        <span>{path.label}</span>
        <span>{visited.length}/{path.points.length} dots</span>
      </div>
      <div className="mb-3 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>

      <div
        ref={fieldRef}
        onPointerDown={trackPoint}
        onPointerMove={(event) => {
          if (event.buttons > 0) trackPoint(event);
        }}
        data-tracing-field="true"
        className="relative touch-none select-none overflow-hidden rounded-[2rem] border border-white/50 bg-gradient-to-br from-sky-100/80 via-white/70 to-fuchsia-100/60 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
        style={{ height: "420px" }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline
            points={toPolyline(path.points, theme === "circle draw")}
            fill="none"
            stroke="rgba(99,102,241,0.35)"
            strokeWidth={2}
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {trail.length > 1 ? (
            <polyline
              points={toPolyline(trail)}
              fill="none"
              stroke="rgba(16,185,129,0.85)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>

        {path.points.map(([x, y], index) => (
          <span
            key={`${x}-${y}`}
            aria-hidden="true"
            className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-xs font-black shadow-sm transition-colors ${
              visited.includes(index)
                ? "border-emerald-500 bg-emerald-400 text-white"
                : "border-primary/40 bg-white/85 text-primary"
            }`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {visited.includes(index) ? "✓" : index + 1}
          </span>
        ))}

        {supportLevel === "high" && demoPoint ? (
          <motion.span
            aria-hidden="true"
            className="absolute z-10 text-3xl"
            animate={{ left: `${demoPoint[0]}%`, top: `${demoPoint[1]}%` }}
            transition={{ duration: 0.36, ease: "easeOut" }}
            style={{ transform: "translate(-50%, -50%)" }}
          >
            👆
          </motion.span>
        ) : null}

        <BurstLayer bursts={bursts} />

        <div className="absolute left-4 top-4 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700">
          Draw slowly over the glowing dots
        </div>
      </div>
    </div>
  );
}
