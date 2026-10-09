import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { speak } from "@/lib/speech";
import { useSensory } from "@/lib/sensory";
import { getAdaptiveGameConfig, playgroundTapsNeeded, shouldShowCountdown } from "@/lib/gameProgression";
import { createSessionRecorder } from "@/lib/gameAnalytics";
import { buildCompletionMetrics, withTrace } from "../gameCompletion";
import type { GameCompletionMetrics } from "../gameCompletion";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

interface PlayStep {
  emoji: string;
  prompt: string;
}

const COUNTDOWN_SECONDS = 20;

const playgroundThemes: Record<string, PlayStep[]> = {
  sandbox: [
    { emoji: "🪣", prompt: "Fill the bucket with sand" },
    { emoji: "🏖️", prompt: "Smooth the sandbox" },
    { emoji: "🏰", prompt: "Build a sand castle" },
    { emoji: "🐚", prompt: "Add shells to decorate" },
  ],
  slide: [
    { emoji: "🛝", prompt: "Climb to the top" },
    { emoji: "🙌", prompt: "Get ready to slide" },
    { emoji: "💨", prompt: "Slide all the way down" },
    { emoji: "😊", prompt: "Celebrate your turn" },
  ],
  bench: [
    { emoji: "🪑", prompt: "Sit beside a friend" },
    { emoji: "👋", prompt: "Say hello kindly" },
    { emoji: "💬", prompt: "Start a short chat" },
    { emoji: "🤝", prompt: "Take turns talking" },
  ],
  beach: [
    { emoji: "🏖️", prompt: "Choose a sandy spot" },
    { emoji: "🟡", prompt: "Place a round shape" },
    { emoji: "🔺", prompt: "Add a triangle shape" },
    { emoji: "⭐", prompt: "Finish the sandbox picture" },
  ],
  swings: [
    { emoji: "🎠", prompt: "Sit safely on the swing" },
    { emoji: "1️⃣", prompt: "Count a slow push" },
    { emoji: "2️⃣", prompt: "Match the rhythm" },
    { emoji: "🙋", prompt: "Ask for another turn" },
  ],
  seesaw: [
    { emoji: "⚖️", prompt: "Find the balance point" },
    { emoji: "1️⃣", prompt: "Press down gently" },
    { emoji: "2️⃣", prompt: "Let your friend go up" },
    { emoji: "🙋", prompt: "Take turns balancing" },
  ],
  default: [
    { emoji: "🌳", prompt: "Explore the playground" },
    { emoji: "🎈", prompt: "Try the next activity" },
    { emoji: "⭐", prompt: "Keep going" },
    { emoji: "🌈", prompt: "Finish the play routine" },
  ],
};

export default function PlaygroundEngine({ game, onInteraction, onComplete }: Props) {
  const themeKey = String(game.config.theme || "") || game.engine;
  const steps = useMemo(
    () => playgroundThemes[themeKey] || playgroundThemes[game.engine] || playgroundThemes.default,
    [game.engine, themeKey]
  );
  const { difficulty, supportLevel, readinessStage } = getAdaptiveGameConfig(game);
  const { calmMode } = useSensory();
  const tapsNeeded = playgroundTapsNeeded(difficulty, supportLevel, calmMode);
  const showCountdown = shouldShowCountdown(calmMode, supportLevel);

  const [current, setCurrent] = useState(0);
  const [stepTaps, setStepTaps] = useState(0);
  const [errors, setErrors] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const correctTapsRef = useRef(0);
  const errorsRef = useRef(0);
  const completedRef = useRef(false);
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);

  const step = steps[current];
  const isLast = current + 1 >= steps.length;
  const gateMet = stepTaps >= tapsNeeded;

  const decoys = useMemo(() => {
    const pool = steps.filter((_, index) => index !== current).map((item) => item.prompt);
    return pool.slice(0, 2);
  }, [steps, current]);

  useEffect(() => {
    speak(`${game.name}. ${steps[0]?.prompt || ""}`);
  }, [game.name, steps]);

  useEffect(() => {
    if (!showCountdown) return undefined;
    const timer = window.setInterval(() => {
      setCountdown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [showCountdown]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    const attempts = correctTapsRef.current;
    const misses = errorsRef.current;
    onComplete(
      100,
      undefined,
      withTrace(
        rec,
        buildCompletionMetrics({
          trials: attempts + misses,
          correctTrials: attempts,
          errors: misses,
          masteryThreshold: 70,
          attemptsBySkill: {
            "motor-tapping": attempts,
            imitation: steps.length,
            "turn-taking": steps.length,
          },
          observations: [
            `Completed ${steps.length} guided playground steps with ${attempts} prompted actions and ${misses} gentle retries.`,
          ],
        })
      )
    );
  }, [onComplete, rec, steps.length]);

  const advance = useCallback(() => {
    onInteraction();
    rec.event("step", `${current + 1}:${steps[current]?.prompt || ""}`);
    if (isLast) {
      speak("You finished the whole play routine!");
      complete();
      return;
    }
    speak(steps[current + 1]?.prompt || "");
    setCurrent((value) => value + 1);
    setStepTaps(0);
    setCountdown(COUNTDOWN_SECONDS);
  }, [complete, current, isLast, onInteraction, rec, steps]);

  const registerPromptedTap = useCallback(() => {
    onInteraction();
    correctTapsRef.current += 1;
    rec.trial({ stimulus: `step-${current + 1}:act`, correct: true });
    setStepTaps((value) => value + 1);
  }, [current, onInteraction, rec]);

  const registerDecoyTap = useCallback(() => {
    onInteraction();
    errorsRef.current += 1;
    setErrors((value) => value + 1);
    rec.trial({ stimulus: `step-${current + 1}:decoy`, correct: false });
    speak("That was a different action. Try the one we practiced.");
  }, [current, onInteraction, rec]);

  const handleContinue = useCallback(() => {
    if (gateMet) {
      advance();
      return;
    }
    registerPromptedTap();
  }, [advance, gateMet, registerPromptedTap]);

  if (!step) return null;

  return (
    <div className="mx-auto max-w-lg text-center">
      <p className="mb-1 text-sm text-muted-foreground">
        Step {current + 1} of {steps.length}
      </p>
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5">Support {supportLevel}</span>
        <span className="rounded-full bg-muted px-2 py-0.5">Stage {readinessStage}</span>
        {calmMode ? (
          <span className="rounded-full bg-secondary/20 px-2 py-0.5 font-semibold text-foreground">Calm mode</span>
        ) : null}
        {showCountdown ? (
          <span className="rounded-full bg-muted px-2 py-0.5" aria-label="countdown">
            ⏱ {countdown}s
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5">Take your time 🌈</span>
        )}
      </div>

      <div className="mb-4 rounded-2xl bg-muted p-6">
        <div className="mb-3 text-6xl">{step.emoji}</div>
        <p className="mb-1 font-display text-xl font-bold text-foreground">{game.name}</p>
        <p className="mb-5 text-foreground">Act it out: {step.prompt}</p>

        <div className="grid grid-cols-1 gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onClick={registerPromptedTap}
            aria-label={`Act out: ${step.prompt}`}
            className="touch-target rounded-xl border-2 border-primary bg-card px-4 py-3 text-left font-semibold text-foreground"
          >
            <span aria-hidden="true" className="mr-2 text-xl">
              {step.emoji}
            </span>
            Act out: {step.prompt}
          </motion.button>
          {decoys.map((prompt) => (
            <motion.button
              key={prompt}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={registerDecoyTap}
              aria-label={`Act out: ${prompt}`}
              className="touch-target rounded-xl border-2 border-border bg-card/80 px-4 py-3 text-left text-sm text-muted-foreground"
            >
              <span aria-hidden="true" className="mr-2">
                ✨
              </span>
              Act out: {prompt}
            </motion.button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>
            Practiced {Math.min(stepTaps, tapsNeeded)}/{tapsNeeded}
          </span>
          {errors > 0 ? <span>Gentle retries {errors}</span> : null}
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          whileHover={gateMet ? { scale: 1.03 } : undefined}
          onClick={advance}
          disabled={!gateMet}
          className="mt-4 touch-target rounded-2xl bg-primary px-6 py-3 font-display font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLast ? "Finish the game" : "Next step"}
        </motion.button>

        <button
          type="button"
          aria-label="Continue playing"
          onClick={handleContinue}
          style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
        >
          Continue playing
        </button>
      </div>

      <div className="h-3 w-full rounded-full bg-muted">
        <div
          className="h-3 rounded-full bg-primary transition-all"
          style={{ width: `${((current + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
