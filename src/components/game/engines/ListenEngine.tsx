import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import LearningLabel from "../LearningLabel";
import RoundProgress from "../RoundProgress";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import { createSessionRecorder } from "@/lib/gameAnalytics";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

export interface ListenOption {
  label: string;
  emoji: string;
}

export interface ListenDirection {
  say: string;
  steps: string[];
  options: ListenOption[];
}

const FALLBACK_DIRECTIONS: ListenDirection[] = [
  {
    say: "Touch the ball",
    steps: ["ball"],
    options: [{ label: "ball", emoji: "⚽" }, { label: "cup", emoji: "🥤" }, { label: "shoe", emoji: "👟" }],
  },
  {
    say: "Touch the cup, then the apple",
    steps: ["cup", "apple"],
    options: [{ label: "cup", emoji: "🥤" }, { label: "apple", emoji: "🍎" }, { label: "book", emoji: "📘" }],
  },
  {
    say: "Touch the dog, then the cat",
    steps: ["dog", "cat"],
    options: [{ label: "dog", emoji: "🐶" }, { label: "cat", emoji: "🐱" }, { label: "fish", emoji: "🐟" }],
  },
];

function readDirections(game: GameConfig): ListenDirection[] {
  const authored = Array.isArray(game.config.directions) ? (game.config.directions as ListenDirection[]) : [];
  return authored.length > 0 ? authored : FALLBACK_DIRECTIONS;
}

export default function ListenEngine({ game, onInteraction, onComplete }: Props) {
  const { difficulty, supportLevel } = getAdaptiveGameConfig(game);
  const allDirections = useMemo(() => readDirections(game), [game]);
  const directions = useMemo(() => {
    const filtered = supportLevel === "high" ? allDirections.filter((entry) => entry.steps.length <= 1) : allDirections;
    return filtered.length > 0 ? filtered : allDirections;
  }, [allDirections, supportLevel]);
  const requestedRounds = Math.max(1, Number(game.config.rounds) || 3);
  const roundCount = Math.min(requestedRounds, directions.length);
  const optionLimit = supportLevel === "high" ? 2 : supportLevel === "moderate" ? 3 : 4;

  const [roundIndex, setRoundIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastChoice, setLastChoice] = useState<string | null>(null);
  const completedRef = useRef(false);
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);
  const direction = directions[roundIndex];

  useEffect(() => {
    if (!direction || completedRef.current) return;
    rec.mark();
    rec.event("direction_started", direction.say);
    speak(direction.say);
  }, [direction, rec]);

  const finish = (finalErrors: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const totalSteps = directions.slice(0, roundCount).reduce((sum, entry) => sum + entry.steps.length, 0);
    const score = Math.max(40, 100 - finalErrors * 10);
    onComplete(
      score,
      direction.steps.length,
      withTrace(
        rec,
        buildCompletionMetrics({
          trials: totalSteps,
          correctTrials: Math.max(0, totalSteps - finalErrors),
          errors: finalErrors,
          masteryThreshold: masteryForSupport(supportLevel),
          promptsNeeded: supportLevel === "high" ? 1 : 0,
          attemptsBySkill: { listening: totalSteps, directions: roundCount },
          observations: ["Receptive direction game; the child selects named symbols in order."],
        }),
      ),
    );
  };

  const handleOption = (option: ListenOption) => {
    if (!direction || completedRef.current) return;
    onInteraction();
    setLastChoice(option.label);
    const expected = direction.steps[stepIndex];

    if (option.label !== expected) {
      const nextErrors = errors + 1;
      setErrors(nextErrors);
      setFeedback(`Let's listen again. ${direction.say}`);
      rec.trial({
        stimulus: direction.say,
        correct: false,
        latencyMs: 0,
        positionIndex: direction.options.findIndex((entry) => entry.label === option.label),
        choiceCount: direction.options.length,
        prompted: true,
      });
      speak(`Let's listen again. ${direction.say}`);
      window.setTimeout(() => setFeedback(null), 1200);
      return;
    }

    rec.trial({
      stimulus: direction.say,
      correct: true,
      latencyMs: 0,
      positionIndex: direction.options.findIndex((entry) => entry.label === option.label),
      choiceCount: direction.options.length,
      prompted: stepIndex > 0,
    });
    setFeedback(`You found ${option.label}.`);
    const nextStep = stepIndex + 1;

    window.setTimeout(() => {
      setFeedback(null);
      if (nextStep >= direction.steps.length) {
        if (roundIndex + 1 >= roundCount) {
          finish(errors);
        } else {
          setRoundIndex((value) => value + 1);
          setStepIndex(0);
          setLastChoice(null);
        }
      } else {
        setStepIndex(nextStep);
        setLastChoice(null);
        speak(direction.say);
      }
    }, supportLevel === "high" ? 1000 : 700);
  };

  if (!direction) return null;

  const options = direction.options.slice(0, optionLimit);

  return (
    <div className="mx-auto max-w-lg" data-testid="listen-engine" data-game-engine={game.engine}>
      <div className="mb-2 flex flex-col items-center gap-1 text-center">
        <LearningLabel game={game} />
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Listen & choose</p>
        <RoundProgress current={roundIndex} total={roundCount} />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          Step {Math.min(stepIndex + 1, direction.steps.length)} of {direction.steps.length}
        </p>
        <p className="mt-2 font-display text-xl font-bold text-foreground">{direction.say}</p>
        <button
          type="button"
          onClick={() => {
            speak(direction.say);
            onInteraction();
          }}
          className="mt-3 rounded-full border-2 border-primary/40 bg-primary/5 px-4 py-2 text-sm font-bold text-primary touch-target"
          data-testid="listen-hear-again"
        >
          Hear it again
        </button>
        <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm font-semibold text-muted-foreground">
          {feedback || (lastChoice ? `Chosen: ${lastChoice}` : " ")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="listen-options">
        {options.map((option) => (
          <motion.button
            key={option.label}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => handleOption(option)}
            aria-label={`Choose ${option.label}`}
            className="touch-target flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card px-3 py-5 shadow-sm transition-colors hover:border-primary"
            data-testid={`listen-option-${option.label}`}
          >
            <span aria-hidden="true" className="text-4xl">{option.emoji}</span>
            <span className="text-sm font-bold text-foreground">{option.label}</span>
          </motion.button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {difficulty === "easy" ? "One direction at a time. Take your time." : "Listen for the order of the steps."}
      </p>
    </div>
  );
}
