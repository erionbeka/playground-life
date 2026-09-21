import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import { useSensory } from "@/lib/sensory";
import { useAdaptiveSupport } from "@/hooks/useAdaptiveSupport";
import TokenStrip from "../TokenStrip";
import { BurstLayer, ComboBadge, pointFromEvent, useBursts } from "../Juice";
import { useGameAudio } from "../useGameAudio";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import { createSessionRecorder } from "@/lib/gameAnalytics";
import LearningLabel from "../LearningLabel";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

const MISSING_SETS: Record<string, string[]> = {
  animals: ["🐶", "🐱", "🐰", "🐸", "🐦", "🐻", "🦊"],
  food: ["🍎", "🍌", "🍇", "🍓", "🥕", "🍪", "🧀"],
  toys: ["🧸", "⚽", "🎈", "🪁", "🎲", "🚂", "🎨"],
  vehicles: ["🚗", "🚌", "🚂", "✈️", "🚲", "🚀", "⛵"],
  weather: ["☀️", "🌧️", "🌈", "❄️", "⛅", "🌪️", "💧"],
  sea: ["🐠", "🐙", "🦀", "🐬", "🐳", "🐚", "🦈"],
  garden: ["🌸", "🌻", "🐞", "🌿", "🍄", "🐝", "🌷"],
  school: ["✏️", "📚", "🎒", "🖍️", "📐", "📝", "🔬"],
};

type Phase = "show" | "probe";

export default function WhatsMissingEngine({ game, onInteraction, onComplete }: Props) {
  const theme = String(game.config.theme || "animals");
  const { difficulty, supportLevel } = getAdaptiveGameConfig(game);
  const { calmMode } = useSensory();
  const startLevel = String(game.config.startLevel || "") as "easy" | "medium" | "hard" | "";
  const showMs =
    (supportLevel === "high" ? 3200 : difficulty === "hard" ? 1600 : 2200) *
    (startLevel === "hard" ? 0.75 : startLevel === "easy" ? 1.25 : 1);
  const pool = MISSING_SETS[theme] || MISSING_SETS.animals;
  const roundCount = difficulty === "easy" || supportLevel === "high" ? Math.min(3, pool.length - 3) : Math.min(4, pool.length - 3);
  const adaptive = useAdaptiveSupport({ baseDelay: 5000 });

  const rounds = useMemo(
    () =>
      Array.from({ length: roundCount }, () => {
        const shuffled = shuffleItems(pool);
        const displayed = shuffled.slice(0, 3);
        const vanishIndex = Math.floor(shuffleItems([0, 1, 2])[0]) % 3;
        const missingEmoji = displayed[vanishIndex];
        const decoyCount = supportLevel === "high" ? 1 : 2;
        const decoys = shuffleItems(shuffled.filter((item) => !displayed.includes(item))).slice(0, decoyCount);
        return {
          displayed,
          vanishIndex,
          missingEmoji,
          choices: shuffleItems([missingEmoji, ...decoys]),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, roundCount]
  );

  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("show");
  const [prompts, setPrompts] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const comboRef = useRef(0);
  const completedRef = useRef(false);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);
  const { playHitSound, playMissSound, playPopSound } = useGameAudio();
  const { bursts, fireBurst } = useBursts();

  const round = rounds[roundIndex];

  useEffect(() => {
    if (!round) return;
    setPhase("show");
    setWrongPicks([]);
    setCombo(0);
    comboRef.current = 0;
    speak("Watch carefully. Remember the friends on screen.");
    rec.mark();

    const timer = window.setTimeout(() => {
      setPhase("probe");
      speak("Which one disappeared?");
      rec.mark();
    }, calmMode ? showMs + 1200 : showMs);
    return () => window.clearTimeout(timer);
  }, [calmMode, rec, round, showMs]);

  if (!round) return null;

  const handlePick = (option: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (phase !== "probe") return;
    const pickKey = `${roundIndex}:${option}`;
    if (wrongPicks.includes(pickKey)) return;

    onInteraction();
    const point = pointFromEvent(event, fieldRef.current);

    if (option === round.missingEmoji) {
      rec.trial({
        stimulus: `missing:${theme}#${roundIndex}`,
        correct: true,
        positionIndex: round.choices.indexOf(option),
        choiceCount: round.choices.length,
        prompted: wrongPicks.length > 0,
      });
      adaptive.recordSuccess(wrongPicks.length > 0);
      comboRef.current += 1;
      setCombo(comboRef.current);
      playHitSound(comboRef.current);
      fireBurst(point.x, point.y, option);

      const nextRound = roundIndex + 1;
      if (nextRound >= rounds.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        speak("You found every missing friend!");
        const score = Math.max(60, 100 - prompts * 15);
        onComplete(score, undefined, withTrace(rec, buildCompletionMetrics({
          trials: rounds.length + prompts,
          correctTrials: rounds.length,
          errors: prompts,
          promptsNeeded: prompts,
          masteryThreshold: masteryForSupport(supportLevel),
          attemptsBySkill: { "visual-closure": rounds.length, "working-memory": rounds.length },
          observations: [
            `Spotted all ${rounds.length} disappearing items.`,
            prompts > 0 ? `Needed ${prompts} retry prompt${prompts === 1 ? "" : "s"} before spotting the difference.` : "Spotted every missing item on the first try.",
          ],
        })));
        return;
      }
      playPopSound();
      setRoundIndex(nextRound);
      return;
    }

    rec.trial({
      stimulus: `missing:${theme}#${roundIndex}`,
      correct: false,
      positionIndex: round.choices.indexOf(option),
      choiceCount: round.choices.length,
      prompted: false,
    });
    adaptive.recordError();
    setPrompts((value) => value + 1);
    setWrongPicks((current) => [...current, pickKey]);
    playMissSound();
    speak("Look again. Who disappeared?");
  };

  return (
    <div className="mx-auto max-w-lg">
      <LearningLabel game={game} />
      <div className="mb-3 rounded-2xl bg-muted/70 p-3 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">What's Missing?</p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {phase === "show" ? "Look closely…" : "Which one disappeared?"}
        </p>
      </div>

      <div ref={fieldRef} className="relative rounded-[2rem] border border-border bg-gradient-to-br from-sky-50/80 to-violet-50/70 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Round {roundIndex + 1} of {rounds.length}
          </span>
          <TokenStrip earned={roundIndex} total={rounds.length} token="✨" />
        </div>
        <ComboBadge combo={combo} />

        <div className="mb-6 grid grid-cols-3 gap-3">
          {round.displayed.map((symbol, index) => {
            const isVanished = phase === "probe" && index === round.vanishIndex;
            return (
              <motion.div
                key={`${roundIndex}-${index}`}
                layout
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: phase === "show" ? index * 0.12 : 0 }}
                className={`grid aspect-square place-items-center rounded-3xl border-2 shadow-sm ${
                  isVanished ? "border-dashed border-primary/60 bg-primary/5" : "border-border bg-card"
                }`}
              >
                {isVanished ? (
                  <motion.span
                    aria-hidden="true"
                    animate={{ scale: [1, 1.14, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-5xl font-black text-primary"
                  >
                    ?
                  </motion.span>
                ) : (
                  <span aria-hidden="true" className="text-6xl">{symbol}</span>
                )}
              </motion.div>
            );
          })}
        </div>

        {phase === "probe" ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`grid gap-3 ${round.choices.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
            {round.choices.map((option) => {
              const pickKey = `${roundIndex}:${option}`;
              const dimmed = wrongPicks.includes(pickKey);
              return (
                <button
                  key={option}
                  onClick={(event) => handlePick(option, event)}
                  disabled={dimmed}
                  aria-label={`choice ${option}`}
                  className={`touch-target aspect-square rounded-3xl border-2 bg-card text-5xl shadow-sm transition-colors ${
                    dimmed ? "border-border opacity-40" : "border-border hover:border-primary"
                  } ${adaptive.errorStreak >= 2 && option === round.missingEmoji ? "animate-pulse border-amber-400 ring-4 ring-amber-300/60" : ""}`}
                >
                  <span aria-hidden="true">{option}</span>
                </button>
              );
            })}
            <BurstLayer bursts={bursts} />
          </motion.div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Then tell us who disappeared…</p>
        )}
      </div>
    </div>
  );
}
