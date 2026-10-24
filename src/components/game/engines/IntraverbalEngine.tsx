import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import { shuffleItems } from "@/lib/shuffle";
import LearningLabel from "../LearningLabel";
import RoundProgress from "../RoundProgress";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import { createSessionRecorder } from "@/lib/gameAnalytics";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

export interface IntraverbalOption {
  label: string;
  emoji: string;
}

export interface IntraverbalPrompt {
  prompt: string;
  answer: string;
  options: IntraverbalOption[];
}

const FALLBACK_PROMPTS: IntraverbalPrompt[] = [
  {
    prompt: "Twinkle, twinkle, little ___",
    answer: "star",
    options: [{ label: "star", emoji: "⭐" }, { label: "car", emoji: "🚗" }, { label: "cup", emoji: "🥤" }],
  },
  {
    prompt: "The itsy bitsy ___ climbed up the water spout",
    answer: "spider",
    options: [{ label: "spider", emoji: "🕷️" }, { label: "dog", emoji: "🐶" }, { label: "ball", emoji: "⚽" }],
  },
  {
    prompt: "Old MacDonald had a ___",
    answer: "farm",
    options: [{ label: "farm", emoji: "🚜" }, { label: "school", emoji: "🏫" }, { label: "store", emoji: "🏪" }],
  },
];

function readPrompts(game: GameConfig): IntraverbalPrompt[] {
  const authored = Array.isArray(game.config.prompts) ? (game.config.prompts as IntraverbalPrompt[]) : [];
  return authored.filter((entry) => entry && typeof entry.prompt === "string" && Array.isArray(entry.options)).length > 0
    ? authored
    : FALLBACK_PROMPTS;
}

export default function IntraverbalEngine({ game, onInteraction, onComplete }: Props) {
  const { supportLevel } = getAdaptiveGameConfig(game);
  const prompts = useMemo(() => readPrompts(game), [game]);
  const roundCount = Math.min(Math.max(1, Number(game.config.rounds) || 4), prompts.length);
  const optionLimit = supportLevel === "high" ? 2 : supportLevel === "moderate" ? 3 : 4;

  const [roundIndex, setRoundIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [correctRounds, setCorrectRounds] = useState(0);
  const [roundHadError, setRoundHadError] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const completedRef = useRef(false);
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);
  const prompt = prompts[roundIndex];
  const options = useMemo(
    () => (prompt ? shuffleItems(prompt.options).slice(0, optionLimit) : []),
    [prompt, optionLimit],
  );

  useEffect(() => {
    if (!prompt || completedRef.current) return;
    rec.mark();
    rec.event("intraverbal_prompt", prompt.prompt);
    const spoken = prompt.prompt.replace(/___/g, "hmm");
    speak(spoken);
  }, [prompt, rec]);

  const finish = (finalErrors: number, finalCorrect: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    const score = Math.max(40, 100 - finalErrors * 15);
    onComplete(
      score,
      finalCorrect,
      withTrace(
        rec,
        buildCompletionMetrics({
          trials: roundCount,
          correctTrials: finalCorrect,
          errors: finalErrors,
          masteryThreshold: masteryForSupport(supportLevel),
          attemptsBySkill: { intraverbals: roundCount },
          observations: ["Intraverbal fill-in game; the child completes a familiar phrase after a spoken model."],
        }),
      ),
    );
  };

  const handleOption = (option: IntraverbalOption) => {
    if (!prompt || completedRef.current) return;
    onInteraction();
    const isCorrect = option.label === prompt.answer;
    rec.trial({
      stimulus: prompt.prompt,
      correct: isCorrect,
      latencyMs: 0,
      positionIndex: options.findIndex((entry) => entry.label === option.label),
      choiceCount: options.length,
      prompted: roundHadError,
    });

    if (!isCorrect) {
      setErrors((value) => value + 1);
      setRoundHadError(true);
      setFeedback("Good try. Let's hear the phrase again.");
      speak(`Good try. ${prompt.prompt.replace(/___/g, "hmm")}`);
      return;
    }

    const nextCorrect = correctRounds + (roundHadError ? 0 : 1);
    setCorrectRounds(nextCorrect);
    setFeedback(`Yes! ${prompt.answer}.`);
    speak(`Yes! ${prompt.answer}.`);

    window.setTimeout(() => {
      setFeedback(null);
      if (roundIndex + 1 >= roundCount) {
        finish(errors, nextCorrect);
      } else {
        setRoundIndex((value) => value + 1);
        setRoundHadError(false);
      }
    }, supportLevel === "high" ? 1400 : 1000);
  };

  if (!prompt) return null;

  return (
    <div className="mx-auto max-w-lg" data-testid="intraverbal-engine" data-game-engine={game.engine}>
      <div className="mb-2 flex flex-col items-center gap-1 text-center">
        <LearningLabel game={game} />
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Fill in the phrase</p>
        <RoundProgress current={roundIndex} total={roundCount} />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-5 text-center">
        <p className="font-display text-xl font-bold leading-8 text-foreground">{prompt.prompt}</p>
        <button
          type="button"
          onClick={() => {
            speak(prompt.prompt.replace(/___/g, "hmm"));
            onInteraction();
          }}
          className="mt-3 rounded-full border-2 border-primary/40 bg-primary/5 px-4 py-2 text-sm font-bold text-primary touch-target"
          data-testid="intraverbal-hear-again"
        >
          Hear it again
        </button>
        <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm font-semibold text-muted-foreground">
          {feedback || " "}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="intraverbal-options">
        {options.map((option) => (
          <motion.button
            key={option.label}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => handleOption(option)}
            aria-label={`Choose ${option.label}`}
            className="touch-target flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card px-3 py-5 shadow-sm transition-colors hover:border-primary"
            data-testid={`intraverbal-option-${option.label}`}
          >
            <span aria-hidden="true" className="text-4xl">{option.emoji}</span>
            <span className="text-sm font-bold text-foreground">{option.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
