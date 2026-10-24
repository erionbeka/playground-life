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

export interface CommentOption {
  label: string;
  emoji: string;
}

export interface CommentScene {
  scene: string;
  label: string;
  comments: CommentOption[];
}

const FALLBACK_SCENES: CommentScene[] = [
  {
    scene: "🍕",
    label: "Pizza",
    comments: [
      { label: "yummy", emoji: "😋" },
      { label: "I like it", emoji: "❤️" },
      { label: "wow", emoji: "😮" },
      { label: "no thank you", emoji: "🙅" },
    ],
  },
  {
    scene: "🐶",
    label: "Puppy",
    comments: [
      { label: "cute", emoji: "🥰" },
      { label: "I like it", emoji: "❤️" },
      { label: "wow", emoji: "😮" },
      { label: "look", emoji: "👀" },
    ],
  },
  {
    scene: "🎈",
    label: "Balloon",
    comments: [
      { label: "pretty", emoji: "✨" },
      { label: "I like it", emoji: "❤️" },
      { label: "up", emoji: "⬆️" },
      { label: "wow", emoji: "😮" },
    ],
  },
];

function readScenes(game: GameConfig): CommentScene[] {
  const authored = Array.isArray(game.config.scenes) ? (game.config.scenes as CommentScene[]) : [];
  return authored.length > 0 ? authored : FALLBACK_SCENES;
}

export default function CommentEngine({ game, onInteraction, onComplete }: Props) {
  const { supportLevel } = getAdaptiveGameConfig(game);
  const scenes = useMemo(() => readScenes(game), [game]);
  const roundCount = Math.min(Math.max(1, Number(game.config.rounds) || 4), scenes.length);
  const optionLimit = supportLevel === "high" ? 2 : supportLevel === "moderate" ? 3 : 4;

  const [roundIndex, setRoundIndex] = useState(0);
  const [chosen, setChosen] = useState<CommentOption | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const completedRef = useRef(false);
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);
  const activeScene = scenes[roundIndex];

  useEffect(() => {
    if (!activeScene || completedRef.current) return;
    rec.mark();
    rec.event("comment_scene", activeScene.label);
    speak(`Look. ${activeScene.label}. What do you think?`);
  }, [activeScene, rec]);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(
      100,
      roundCount,
      withTrace(
        rec,
        buildCompletionMetrics({
          trials: roundCount,
          correctTrials: roundCount,
          errors: 0,
          masteryThreshold: masteryForSupport(supportLevel),
          attemptsBySkill: { commenting: roundCount },
          observations: [
            "Commenting is open-ended: every comment is accepted and expanded by the adult.",
            "The goal is sharing a reaction, not producing one predetermined answer.",
          ],
        }),
      ),
    );
  };

  const handleComment = (comment: CommentOption) => {
    if (!activeScene || completedRef.current) return;
    onInteraction();
    const expansion = `${activeScene.label}! ${comment.label}.`;
    setChosen(comment);
    setFeedback(`You said: “${expansion}”`);
    rec.trial({
      stimulus: activeScene.label,
      correct: true,
      latencyMs: 0,
      positionIndex: activeScene.comments.findIndex((entry) => entry.label === comment.label),
      choiceCount: Math.min(optionLimit, activeScene.comments.length),
      prompted: supportLevel === "high",
      options: activeScene.comments.map((entry) => entry.label),
    });
    speak(expansion);

    window.setTimeout(() => {
      setChosen(null);
      setFeedback(null);
      if (roundIndex + 1 >= roundCount) {
        finish();
      } else {
        setRoundIndex((value) => value + 1);
      }
    }, supportLevel === "high" ? 1800 : 1400);
  };

  if (!activeScene) return null;

  const options = activeScene.comments.slice(0, optionLimit);

  return (
    <div className="mx-auto max-w-lg" data-testid="comment-engine" data-game-engine={game.engine}>
      <div className="mb-2 flex flex-col items-center gap-1 text-center">
        <LearningLabel game={game} />
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Share a comment</p>
        <RoundProgress current={roundIndex} total={roundCount} />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-6 text-center">
        <p aria-hidden="true" className="text-6xl" data-testid="comment-scene">{activeScene.scene}</p>
        <h2 className="mt-2 font-display text-xl font-bold text-foreground">{activeScene.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">What do you think? Any comment is okay.</p>
        <button
          type="button"
          onClick={() => {
            speak(`Look. ${activeScene.label}. What do you think?`);
            onInteraction();
          }}
          className="mt-3 rounded-full border-2 border-primary/40 bg-primary/5 px-4 py-2 text-sm font-bold text-primary touch-target"
          data-testid="comment-hear-model"
        >
          Hear the model
        </button>
        <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm font-semibold text-foreground">
          {feedback || (chosen ? `You chose: ${chosen.label}` : " ")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3" data-testid="comment-options">
        {options.map((comment) => (
          <motion.button
            key={comment.label}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => handleComment(comment)}
            aria-label={`Comment ${comment.label}`}
            className="touch-target flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-4 text-left shadow-sm transition-colors hover:border-primary"
            data-testid={`comment-option-${comment.label}`}
          >
            <span aria-hidden="true" className="text-3xl">{comment.emoji}</span>
            <span className="text-sm font-bold text-foreground">{comment.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
