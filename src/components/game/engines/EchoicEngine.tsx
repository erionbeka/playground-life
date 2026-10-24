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

export interface EchoicModel {
  label: string;
  say: string;
  emoji: string;
}

const FALLBACK_MODELS: EchoicModel[] = [
  { label: "ah", say: "ah", emoji: "👄" },
  { label: "mama", say: "mama", emoji: "👩" },
  { label: "ba", say: "ba", emoji: "🫧" },
  { label: "ball", say: "ball", emoji: "⚽" },
];

function readModels(game: GameConfig): EchoicModel[] {
  const authored = Array.isArray(game.config.models) ? (game.config.models as EchoicModel[]) : [];
  return authored.length > 0 ? authored : FALLBACK_MODELS;
}

export default function EchoicEngine({ game, onInteraction, onComplete }: Props) {
  const { supportLevel } = getAdaptiveGameConfig(game);
  const models = useMemo(() => readModels(game), [game]);
  const roundCount = Math.min(Math.max(1, Number(game.config.rounds) || 4), models.length);

  const [roundIndex, setRoundIndex] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [tries, setTries] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const completedRef = useRef(false);
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);
  const model = models[roundIndex];

  useEffect(() => {
    if (!model || completedRef.current) return;
    rec.mark();
    rec.event("echoic_model", model.say);
    speak(model.say);
  }, [model, rec]);

  const sayModel = () => {
    if (!model) return;
    onInteraction();
    setTries((value) => value + 1);
    setFeedback("Listen and copy the sound.");
    speak(model.say);
  };

  const finish = (finalAttempts: number) => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(
      100,
      finalAttempts,
      withTrace(
        rec,
        buildCompletionMetrics({
          trials: roundCount,
          correctTrials: roundCount,
          errors: 0,
          masteryThreshold: masteryForSupport(supportLevel, { high: 1, moderate: 1, light: 1 }),
          attemptsBySkill: { vocal_imitation: finalAttempts, models_heard: tries + roundCount },
          observations: [
            "Adult-confirmed vocal imitation: no microphone or automatic speech scoring is used.",
            "Any vocal attempt is accepted; the adult models the sound again when needed.",
          ],
        }),
      ),
    );
  };

  const handleCopied = () => {
    if (!model || completedRef.current) return;
    onInteraction();
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setFeedback("You copied it. Nice listening!");
    rec.trial({
      stimulus: `echoic:${model.say}`,
      correct: true,
      latencyMs: 0,
      positionIndex: 0,
      choiceCount: 1,
      prompted: tries > 0,
    });
    speak("You copied it. Nice listening!");

    window.setTimeout(() => {
      setFeedback(null);
      setTries(0);
      if (roundIndex + 1 >= roundCount) {
        finish(nextAttempts);
      } else {
        setRoundIndex((value) => value + 1);
      }
    }, supportLevel === "high" ? 1600 : 1200);
  };

  if (!model) return null;

  return (
    <div className="mx-auto max-w-lg" data-testid="echoic-engine" data-game-engine={game.engine}>
      <div className="mb-2 flex flex-col items-center gap-1 text-center">
        <LearningLabel game={game} />
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Listen & copy</p>
        <RoundProgress current={roundIndex} total={roundCount} />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-6 text-center">
        <p aria-hidden="true" className="text-6xl">{model.emoji}</p>
        <p className="mt-3 font-display text-3xl font-bold text-foreground">“{model.say}”</p>
        <p className="mt-2 text-sm text-muted-foreground">Listen, then copy the sound. A grown-up listens.</p>
        <button
          type="button"
          onClick={sayModel}
          className="mt-4 rounded-full border-2 border-primary/40 bg-primary/5 px-5 py-3 text-sm font-bold text-primary touch-target"
          data-testid="echoic-hear-model"
        >
          Hear it again
        </button>
        <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm font-semibold text-foreground">
          {feedback || " "}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" data-testid="echoic-actions">
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={handleCopied}
          className="touch-target rounded-2xl bg-primary px-5 py-5 text-lg font-bold text-primary-foreground shadow-sm"
          data-testid="echoic-copied"
        >
          I copied it
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={sayModel}
          className="touch-target rounded-2xl border-2 border-border bg-card px-5 py-5 text-lg font-bold text-foreground shadow-sm"
          data-testid="echoic-not-yet"
        >
          Not yet, say it again
        </motion.button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        No microphone needed. This is a participation activity, not an automatic speech score.
      </p>
    </div>
  );
}
