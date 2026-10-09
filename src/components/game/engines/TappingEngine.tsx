import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { clamp, getAdaptiveGameConfig, shouldShowCountdown } from "@/lib/gameProgression";
import { useSensory } from "@/lib/sensory";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number) => void;
}

const themeVisuals: Record<string, { emoji: string; background: string; renderAs?: "emoji" | "balloon" }> = {
  butterflies: { emoji: "butterfly", background: "from-fuchsia-200/70 via-pink-100/60 to-sky-100/60" },
  bubbles: { emoji: "bubble", background: "from-cyan-100/70 via-sky-100/70 to-white/60" },
  stars: { emoji: "star", background: "from-amber-100/80 via-yellow-100/70 to-orange-100/60" },
  fish: { emoji: "fish", background: "from-cyan-100/80 via-sky-100/70 to-emerald-100/60" },
  balloons: { emoji: "balloon", background: "from-rose-100/80 via-orange-100/70 to-sky-100/60", renderAs: "balloon" },
  fireflies: { emoji: "spark", background: "from-amber-100/80 via-lime-100/60 to-emerald-100/60" },
  leaves: { emoji: "leaf", background: "from-emerald-100/80 via-lime-100/70 to-yellow-100/60" },
  snowflakes: { emoji: "snow", background: "from-sky-100/80 via-cyan-50/80 to-white/70" },
  raindrops: { emoji: "drop", background: "from-sky-100/80 via-cyan-100/70 to-indigo-100/60" },
  birds: { emoji: "bird", background: "from-sky-100/80 via-white/70 to-emerald-100/60" },
  ladybugs: { emoji: "ladybug", background: "from-rose-100/80 via-red-100/70 to-amber-100/60" },
  flowers: { emoji: "flower", background: "from-pink-100/80 via-fuchsia-100/70 to-violet-100/60" },
  jellyfish: { emoji: "jellyfish", background: "from-cyan-100/80 via-violet-100/70 to-fuchsia-100/60" },
  rockets: { emoji: "rocket", background: "from-indigo-100/80 via-sky-100/70 to-slate-100/60" },
  clouds: { emoji: "cloud", background: "from-slate-100/80 via-sky-100/70 to-white/70" },
  "trace lines": { emoji: "trace", background: "from-amber-100/80 via-orange-100/70 to-white/70" },
  "connect dots": { emoji: "dot", background: "from-sky-100/80 via-indigo-100/70 to-white/70" },
  "drag & drop": { emoji: "block", background: "from-fuchsia-100/80 via-rose-100/70 to-sky-100/60" },
  "pinch & zoom": { emoji: "pinch", background: "from-lime-100/80 via-emerald-100/70 to-sky-100/60" },
  "swipe patterns": { emoji: "wave", background: "from-violet-100/80 via-fuchsia-100/70 to-cyan-100/60" },
  "follow the path": { emoji: "path", background: "from-amber-100/80 via-lime-100/70 to-sky-100/60" },
  "catch the ball": { emoji: "ball", background: "from-lime-100/80 via-emerald-100/70 to-yellow-100/60" },
  "pop & hold": { emoji: "hold", background: "from-cyan-100/80 via-sky-100/70 to-violet-100/60" },
  "slow drag": { emoji: "drag", background: "from-rose-100/80 via-orange-100/70 to-amber-100/60" },
  "circle draw": { emoji: "circle", background: "from-fuchsia-100/80 via-pink-100/70 to-orange-100/60" },
  "zig-zag trace": { emoji: "bolt", background: "from-yellow-100/80 via-amber-100/70 to-orange-100/60" },
  "target aim": { emoji: "target", background: "from-rose-100/80 via-orange-100/70 to-yellow-100/60" },
  default: { emoji: "star", background: "from-sky-100/80 via-white/70 to-fuchsia-100/60" },
};

export const FALL_THEMES = new Set([
  "catch the ball",
  "raindrops",
  "snowflakes",
  "leaves",
  "stars",
  "fireflies",
  "balloons",
]);

const iconMap: Record<string, string> = {
  butterfly: "B",
  bubble: "o",
  star: "*",
  fish: "><>",
  balloon: "O",
  spark: "+",
  leaf: "L",
  snow: "x",
  drop: "v",
  bird: "V",
  ladybug: "@",
  flower: "F",
  jellyfish: "J",
  rocket: "^",
  cloud: "C",
  trace: "/",
  dot: ".",
  block: "#",
  pinch: "<>",
  wave: "~",
  path: "=",
  ball: "o",
  hold: "O",
  drag: "D",
  circle: "O",
  bolt: "Z",
  target: "+",
};

const distractorPool = ["x", "+", "~", ".", "#"];

interface Target {
  id: number;
  x: number;
  y: number;
  label: string;
  size: number;
  rotation: number;
  kind: "target" | "distractor";
}

function BalloonTarget({ size }: { size: number }) {
  return (
    <span className="relative flex items-start justify-center" style={{ width: `${size}px`, height: `${size + 24}px` }}>
      <span className="absolute top-0 h-[78%] w-[72%] rounded-[50%_50%_48%_48%] bg-gradient-to-b from-rose-400 via-pink-500 to-orange-400 shadow-[inset_-8px_-12px_18px_rgba(255,255,255,0.28),0_14px_18px_rgba(244,114,182,0.26)]" />
      <span className="absolute top-[22%] left-[22%] h-[20%] w-[12%] rounded-full bg-white/45 blur-[1px]" />
      <span className="absolute bottom-[18%] h-2.5 w-2.5 rotate-45 bg-orange-400" />
      <span className="absolute bottom-0 h-[24%] w-[2px] rounded-full bg-slate-500/75" />
    </span>
  );
}

export default function TappingEngine({ game, onInteraction, onComplete }: Props) {
  const theme = ((game.config.theme as string) || "default").toLowerCase();
  const visual = themeVisuals[theme] || themeVisuals.default;
  const speed = (game.config.speed as string) || "medium";
  const { difficulty, supportLevel, readinessStage } = getAdaptiveGameConfig(game);
  const { calmMode } = useSensory();
  const timed = shouldShowCountdown(calmMode, supportLevel);
  const [targets, setTargets] = useState<Target[]>([]);
  const [hits, setHits] = useState(0);
  const [missed, setMissed] = useState(0);
  const [wrongTaps, setWrongTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(timed ? 24 : null);
  const idRef = useRef(0);
  const completedRef = useRef(false);
  const missTimeoutsRef = useRef<number[]>([]);
  const spawnLoopRef = useRef<number | null>(null);
  const timeLeftRef = useRef(timeLeft);
  const hitsRef = useRef(hits);

  const goalBase = difficulty === "easy" ? 10 : difficulty === "medium" ? 14 : 18;
  const goal = supportLevel === "high" ? Math.max(8, goalBase - 3) : supportLevel === "light" ? goalBase + 2 : goalBase;
  const showDistractors = supportLevel !== "high" && difficulty !== "easy";
  const calmPrompt = theme.includes("trace") || theme.includes("slow") || theme.includes("path") || theme.includes("connect");
  const baseSpawnInterval = speed === "slow" ? 1400 : speed === "medium" ? 950 : 650;
  const readinessAdjustment = readinessStage === "stabilize" ? 220 : readinessStage === "stretch" ? -120 : 0;
  const spawnInterval = supportLevel === "high" ? baseSpawnInterval + 250 + readinessAdjustment : supportLevel === "light" ? Math.max(450, baseSpawnInterval - 120 + readinessAdjustment) : baseSpawnInterval + readinessAdjustment;
  const baseTargetLifetime = speed === "slow" ? 2400 : speed === "medium" ? 2000 : 1600;
  const targetLifetime = supportLevel === "high" ? baseTargetLifetime + 350 : supportLevel === "light" ? Math.max(1200, baseTargetLifetime - 180) : baseTargetLifetime;

  const accuracy = useMemo(() => {
    const totalAttempts = hits + missed + wrongTaps;
    return totalAttempts > 0 ? Math.round((hits / totalAttempts) * 100) : 100;
  }, [hits, missed, wrongTaps]);

  const progress = useMemo(() => Math.round((hits / goal) * 100), [goal, hits]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    hitsRef.current = hits;
  }, [hits]);

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
    completedRef.current = false;
    setTimeLeft(timed ? 24 : null);
  }, [timed]);

  useEffect(() => {
    if (timeLeft !== 0 || completedRef.current) return;

    missTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    missTimeoutsRef.current = [];
    completedRef.current = true;
    onComplete(clamp(Math.round((accuracy + progress) / 2), 35, 100));
  }, [accuracy, onComplete, progress, timeLeft]);

  useEffect(() => {
    if (hits < goal || completedRef.current) return;

    missTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    missTimeoutsRef.current = [];
    completedRef.current = true;
    onComplete(clamp(Math.round((accuracy + progress) / 2), 60, 100));
  }, [accuracy, goal, hits, onComplete, progress]);

  const spawnTarget = useCallback(() => {
    if (timeLeftRef.current === 0 || hitsRef.current >= goal) return;

    const id = idRef.current++;
    const spawnDistractor = showDistractors && Math.random() > (difficulty === "hard" || supportLevel === "light" ? 0.45 : 0.72);
    const kind: Target["kind"] = spawnDistractor ? "distractor" : "target";
    const timeoutId = window.setTimeout(() => {
      setTargets((currentTargets) => {
        const currentTarget = currentTargets.find((target) => target.id === id);
        if (currentTarget?.kind === "target") {
          setMissed((currentMissed) => currentMissed + 1);
        }
        return currentTargets.filter((target) => target.id !== id);
      });
    }, targetLifetime);

    missTimeoutsRef.current.push(timeoutId);

    setTargets((currentTargets) => [
      ...currentTargets,
      {
        id,
        x: 8 + Math.random() * 76,
        y: 12 + Math.random() * 62,
        label: kind === "target" ? visual.emoji : distractorPool[id % distractorPool.length],
        size: 54 + Math.round(Math.random() * 14),
        rotation: -12 + Math.round(Math.random() * 24),
        kind,
      },
    ]);
  }, [difficulty, goal, showDistractors, supportLevel, targetLifetime, visual.emoji]);

  useEffect(() => {
    if (timeLeft === 0 || hits >= goal) return;

    const runLoop = () => {
      spawnTarget();
      if (timeLeftRef.current === 0 || hitsRef.current >= goal) return;
      spawnLoopRef.current = window.setTimeout(runLoop, spawnInterval);
    };

    runLoop();

    return () => {
      if (spawnLoopRef.current !== null) {
        window.clearTimeout(spawnLoopRef.current);
        spawnLoopRef.current = null;
      }
    };
  }, [goal, hits, spawnInterval, spawnTarget, timeLeft]);

  useEffect(() => {
    return () => {
      if (spawnLoopRef.current !== null) {
        window.clearTimeout(spawnLoopRef.current);
        spawnLoopRef.current = null;
      }
      missTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      missTimeoutsRef.current = [];
    };
  }, []);

  const handleTap = (id: number) => {
    onInteraction();
    const tapped = targets.find((target) => target.id === id);
    setTargets((currentTargets) => currentTargets.filter((target) => target.id !== id));
    if (tapped?.kind === "target") {
      setHits((currentScore) => currentScore + 1);
    } else {
      setWrongTaps((currentWrongTaps) => currentWrongTaps + 1);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-3 flex justify-between text-sm text-muted-foreground">
        <span>{calmMode ? "Take your time 🌈" : timed ? `⏱ ${timeLeft}s` : null}</span>
        <span>Targets {hits}/{goal}</span>
        <span>Accuracy {accuracy}%</span>
      </div>
      <div className="mb-3 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>

      <div
        className={`relative overflow-hidden rounded-[2rem] border border-white/50 bg-gradient-to-br ${visual.background} shadow-[0_18px_45px_rgba(15,23,42,0.12)]`}
        style={{ height: "420px" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.48),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.3),_transparent_42%)]" />

        <div className="absolute left-4 top-4 rounded-full bg-white/65 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
          {calmPrompt ? `Tap carefully through ${theme}` : `Catch ${goal} ${theme === "default" ? "targets" : theme}`}
        </div>

        {showDistractors ? (
          <div className="absolute right-4 top-4 rounded-full bg-slate-900/8 px-3 py-1 text-[11px] font-semibold text-slate-700">
            Ignore the decoys
          </div>
        ) : null}
        <div className="absolute left-4 bottom-4 rounded-full bg-white/65 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
          Support: {supportLevel} · Stage: {readinessStage}
        </div>

        <AnimatePresence>
          {targets.map((target) => (
            <motion.button
              key={target.id}
              initial={{ opacity: 0, scale: 0.4, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.3 }}
              onClick={() => handleTap(target.id)}
              className="touch-target absolute flex items-center justify-center font-bold text-slate-700 drop-shadow-[0_10px_18px_rgba(15,23,42,0.2)]"
              style={{
                left: `${target.x}%`,
                top: `${target.y}%`,
                width: `${target.size}px`,
                height: `${target.size + (visual.renderAs === "balloon" && target.kind === "target" ? 24 : 0)}px`,
                marginLeft: `-${target.size / 2}px`,
                marginTop: `-${target.size / 2}px`,
                transform: `rotate(${target.rotation}deg)`,
                fontSize: `${Math.max(24, target.size - 18)}px`,
                opacity: target.kind === "target" ? 1 : 0.72,
              }}
              aria-label={target.kind === "target" ? `${theme} target` : "decoy target"}
            >
              {target.kind === "target" && visual.renderAs === "balloon" ? <BalloonTarget size={target.size} /> : (iconMap[target.label] || target.label)}
            </motion.button>
          ))}
        </AnimatePresence>

        {timeLeft === 0 || hits >= goal ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-card/72 backdrop-blur-sm">
            <div className="text-center">
              <p className="mb-2 text-5xl">Play</p>
              <p className="font-display text-xl font-bold text-foreground">You caught {hits} targets!</p>
              <p className="mt-1 text-sm text-muted-foreground">Accuracy: {accuracy}%</p>
              <p className="mt-1 text-sm text-muted-foreground">Decoys tapped: {wrongTaps}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
