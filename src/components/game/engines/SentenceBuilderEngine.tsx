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

export interface SentenceOption {
  label: string;
  emoji: string;
}

export interface SentenceFrame {
  lead: string;
  trail: string;
  answer: string;
  options: SentenceOption[];
}

const FALLBACK_FRAMES: SentenceFrame[] = [
  {
    lead: "I want",
    trail: "please",
    answer: "apple",
    options: [{ label: "apple", emoji: "🍎" }, { label: "ball", emoji: "⚽" }, { label: "juice", emoji: "🧃" }],
  },
  {
    lead: "More",
    trail: "please",
    answer: "juice",
    options: [{ label: "juice", emoji: "🧃" }, { label: "apple", emoji: "🍎" }, { label: "book", emoji: "📘" }],
  },
  {
    lead: "My turn",
    trail: "",
    answer: "ball",
    options: [{ label: "ball", emoji: "⚽" }, { label: "apple", emoji: "🍎" }, { label: "juice", emoji: "🧃" }],
  },
];

function readFrames(game: GameConfig): SentenceFrame[] {
  const authored = Array.isArray(game.config.frames) ? (game.config.frames as SentenceFrame[]) : [];
  return authored.length > 0 ? authored : FALLBACK_FRAMES;
}

export default function SentenceBuilderEngine({ game, onInteraction, onComplete }: Props) {
  const { supportLevel } = getAdaptiveGameConfig(game);
  const frames = useMemo(() => readFrames(game), [game]);
  const roundCount = Math.min(Math.max(1, Number(game.config.rounds) || 3), frames.length);
  const optionLimit = supportLevel === "high" ? 2 : supportLevel === "moderate" ? 3 : 4;

  const [roundIndex, setRoundIndex] = useState(0);
  const [built, setBuilt] = useState<SentenceOption | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const completedRef = useRef(false);
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);
  const frame = frames[roundIndex];
  const options = useMemo(
    () => (frame ? shuffleItems(frame.options).slice(0, optionLimit) : []),
    [frame, optionLimit],
  );

  useEffect(() => {
    if (!frame || completedRef.current) return;
    rec.mark();
    const model = [frame.lead, frame.answer, frame.trail].filter(Boolean).join(" ");
    rec.event("sentence_model", model);
    speak(`${frame.lead} ... What comes next?`);
  }, [frame, rec]);

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
          attemptsBySkill: { sentence_building: roundCount },
          observations: [
            "Sentence-strip activity: every symbol choice produces a valid sentence, so there is no wrong answer.",
            "The adult models the full sentence after each choice.",
          ],
        }),
      ),
    );
  };

  const handleOption = (option: SentenceOption) => {
    if (!frame || completedRef.current) return;
    onInteraction();
    const sentence = [frame.lead, option.label, frame.trail].filter(Boolean).join(" ");
    setBuilt(option);
    setFeedback(`You built: “${sentence}”`);
    rec.trial({
      stimulus: `${frame.lead} ___ ${frame.trail}`.trim(),
      correct: true,
      latencyMs: 0,
      positionIndex: options.findIndex((entry) => entry.label === option.label),
      choiceCount: options.length,
      prompted: supportLevel === "high",
      options: options.map((entry) => entry.label),
    });
    speak(sentence);

    window.setTimeout(() => {
      setFeedback(null);
      setBuilt(null);
      if (roundIndex + 1 >= roundCount) {
        finish();
      } else {
        setRoundIndex((value) => value + 1);
      }
    }, supportLevel === "high" ? 1800 : 1400);
  };

  if (!frame) return null;

  return (
    <div className="mx-auto max-w-lg" data-testid="sentence-builder-engine" data-game-engine={game.engine}>
      <div className="mb-2 flex flex-col items-center gap-1 text-center">
        <LearningLabel game={game} />
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Build a sentence</p>
        <RoundProgress current={roundIndex} total={roundCount} />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-5" data-testid="sentence-strip">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {frame.lead.split(" ").map((word, index) => (
            <span key={`${word}-${index}`} className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">
              {word}
            </span>
          ))}
          <span
            className={`grid min-h-[2.5rem] min-w-[6rem] place-items-center rounded-xl border-2 border-dashed px-3 py-2 text-sm font-bold ${
              built ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
            }`}
            aria-live="polite"
          >
            {built ? `${built.emoji} ${built.label}` : "choose a word"}
          </span>
          {frame.trail
            ? frame.trail.split(" ").map((word, index) => (
                <span key={`${word}-${index}`} className="rounded-xl bg-muted px-3 py-2 text-sm font-bold text-foreground">
                  {word}
                </span>
              ))
            : null}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pick a symbol to finish the sentence. All of these choices make a sentence.
        </p>
        <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-center text-sm font-semibold text-foreground">
          {feedback || " "}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="sentence-options">
        {options.map((option) => (
          <motion.button
            key={option.label}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => handleOption(option)}
            aria-label={`Add ${option.label} to the sentence`}
            className="touch-target flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-card px-3 py-4 shadow-sm transition-colors hover:border-primary"
            data-testid={`sentence-option-${option.label}`}
          >
            <span aria-hidden="true" className="text-3xl">{option.emoji}</span>
            <span className="text-sm font-bold text-foreground">{option.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
