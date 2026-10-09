import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import { useSensory } from "@/lib/sensory";
import { BurstLayer, pointFromEvent, useBursts, useWobble } from "../Juice";
import { useGameAudio } from "../useGameAudio";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import LearningLabel from "../LearningLabel";
import { createSessionRecorder } from "@/lib/gameAnalytics";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

const TOY_SETS: Record<string, string[]> = {
  bubbles: ["🫧", "💧", "🌊", "🎈", "🧼", "💙"],
  instruments: ["🥁", "🎸", "🎹", "🎺", "🪈", "🔔"],
  animals: ["🐶", "🐱", "🐰", "🐸", "🦋", "🐦"],
  vehicles: ["🚗", "🚌", "🚂", "✈️", "🚲", "🚀"],
  garden: ["🌸", "🌻", "🐞", "🌿", "🍄", "☀️"],
  weather: ["☀️", "☁️", "🌈", "⚡", "❄️", "💧"],
  ocean: ["🐠", "🐙", "🦀", "🐬", "🐡", "🐚"],
  space: ["🌟", "🪐", "🌙", "🛸", "☄️", "👩‍🚀"],
  forest: ["🌲", "🍄", "🦊", "🦉", "🌰", "🍃"],
  bakery: ["🥐", "🍞", "🧁", "🍪", "🎂", "🥖"],
  dinosaurs: ["🦖", "🦕", "🥚", "🌋", "🦴", "🍃"],
  circus: ["🎪", "🤹", "🎠", "🎟️", "🍿", "🎩"],
  pond: ["🐸", "🐢", "🪷", "🦆", "🐟", "💧"],
  winter: ["❄️", "⛄", "🧤", "⛷️", "🛷", "🎄"],
  jungle: ["🐒", "🦜", "🦧", "🐍", "🌴", "🦚"],
  bedroom: ["🛏️", "🧸", "🪟", "🌙", "📚", "💡"],
  farmMagic: ["🐄", "🐷", "🐑", "🐔", "🚜", "🌾"],
  seaMagic: ["🐠", "🐙", "🦀", "🐚", "🌊", "🐳"],
  default: ["⭐", "🌈", "🎉", "🍭", "🧸", "🌟"],
};

export default function MagicToysEngine({ game, onInteraction, onComplete }: Props) {
  const theme = String(game.config.theme || "default");
  const { supportLevel } = getAdaptiveGameConfig(game);
  const { calmMode } = useSensory();
  const allToys = TOY_SETS[theme] || TOY_SETS.default;
  const toys = useMemo(() => (supportLevel === "high" ? allToys.slice(0, 4) : allToys), [allToys, supportLevel]);

  const [activated, setActivated] = useState<number[]>([]);
  const [taps, setTaps] = useState(0);
  const [attractIndex, setAttractIndex] = useState<number | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const tapsRef = useRef(0);
  const wrongTapsRef = useRef(0);
  const activatedRef = useRef<number[]>([]);
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);
  const { playTapSound, playStartSound } = useGameAudio();
  const { bursts, fireBurst } = useBursts();
  const { controls, wobble } = useWobble();
  const freeExplore = supportLevel === "high" || Boolean(calmMode);

  const promptIndex = useMemo(() => {
    const remaining = toys.map((_, index) => index).filter((index) => !activatedRef.current.includes(index));
    return remaining.length > 0 ? remaining[0] : -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated, toys]);

  useEffect(() => {
    speak(`Magic ${theme}! Touch anything you like. Find all ${toys.length} magic friends.`);
  }, [theme, toys.length]);

  useEffect(() => {
    return () => {
      completedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (attractIndex === null) return undefined;
    const timer = window.setTimeout(() => setAttractIndex(null), 2600);
    return () => window.clearTimeout(timer);
  }, [attractIndex]);

  useEffect(() => {
    if (calmMode) return undefined;
    const timer = window.setTimeout(() => {
      if (completedRef.current) return;
      const remaining = toys.map((_, index) => index).filter((index) => !activatedRef.current.includes(index));
      if (remaining.length) {
        setAttractIndex(remaining[0]);
        rec.event("idle_prompt", `toy ${remaining[0] + 1}`);
      }
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [calmMode, rec, taps, toys]);

  const finish = useCallback(
    (totalTaps: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      speak("You found every magic friend!");
      fireBurst(50, 45, "🎉");
      onComplete(100, undefined, withTrace(rec, buildCompletionMetrics({
        trials: Math.max(totalTaps, toys.length),
        correctTrials: toys.length,
        errors: wrongTapsRef.current,
        promptsNeeded: wrongTapsRef.current,
        masteryThreshold: masteryForSupport(supportLevel, { high: 50 }),
        attemptsBySkill: { engagement: totalTaps, "receptive-identification": toys.length, inhibition: wrongTapsRef.current },
        observations: [`Found all ${toys.length} magic toys, needing ${wrongTapsRef.current} gentle retry taps in a sensory session.`],
      })));
    },
    [fireBurst, onComplete, supportLevel, toys.length]
  );

  const handleTap = useCallback(
    (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
      onInteraction();
      const point = pointFromEvent(event, fieldRef.current);
      const prompted = freeExplore ? null : promptIndex;

      if (prompted === null || index === prompted) {
        fireBurst(point.x, point.y, toys[index]);
        setTaps((value) => value + 1);
        tapsRef.current += 1;
        if (!activatedRef.current.includes(index)) {
          activatedRef.current = [...activatedRef.current, index];
          setActivated(activatedRef.current);
          rec.trial({ stimulus: `toy-${index + 1}:find`, correct: true });
          speak("Found them!");
          playStartSound();
          if (activatedRef.current.length >= toys.length) {
            finish(tapsRef.current);
          }
        }
        return;
      }

      // Wrong toy for the current prompt: gentle miss.
      wrongTapsRef.current += 1;
      wobble();
      playTapSound();
      rec.trial({ stimulus: `toy-${index + 1}:wrong`, correct: false });
      const promptedToys = toys[prompted];
      speak(promptedToys ? `Almost. Find the ${promptedToys}.` : "Keep looking.");
    },
    [activated.length, fireBurst, finish, freeExplore, onInteraction, playStartSound, playTapSound, promptIndex, rec, toys, wobble]
  );

  return (
    <div className="mx-auto max-w-lg">
      <LearningLabel game={game} />
      <div className="mb-3 rounded-2xl bg-muted/70 p-3 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Magic Toys</p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {freeExplore || promptIndex < 0 ? "Touch the toys and watch what happens!" : `Find the ${toys[promptIndex]}!`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Found {activated.length} of {toys.length}</p>
      </div>

      <motion.div
        ref={fieldRef}
        animate={controls}
        className="relative overflow-hidden rounded-[2rem] border border-white/50 bg-gradient-to-br from-indigo-100/80 via-fuchsia-50/70 to-sky-100/70 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
        style={{ minHeight: "360px" }}
      >
        <div className="grid grid-cols-3 gap-4">
          {toys.map((toy, index) => {
            const found = activated.includes(index);
            return (
              <motion.button
                key={`${toy}-${index}`}
                whileTap={{ scale: 0.88 }}
                animate={
                  attractIndex === index
                    ? { scale: [1, 1.14, 1], rotate: [0, -6, 6, 0] }
                    : found
                      ? { scale: 1.04 }
                      : { scale: 1 }
                }
                transition={attractIndex === index ? { duration: 0.9 } : { type: "spring", stiffness: 300, damping: 15 }}
                onClick={(event) => handleTap(index, event)}
                aria-label={`magic toy ${index + 1}`}
                className={`touch-target grid aspect-square place-items-center rounded-3xl border-2 bg-card/95 text-6xl shadow-sm transition-colors ${
                  found ? "border-secondary ring-4 ring-secondary/30" : "border-border hover:border-primary"
                } ${attractIndex === index && !found ? "animate-pulse border-primary" : ""}`}
              >
                <span aria-hidden="true" className="drop-shadow-sm">{toy}</span>
                {found ? <span aria-hidden="true" className="absolute -right-1 -top-1 text-lg">✨</span> : null}
              </motion.button>
            );
          })}
        </div>
        <BurstLayer bursts={bursts} />
      </motion.div>
    </div>
  );
}
