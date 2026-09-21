import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import { useAdaptiveSupport } from "@/hooks/useAdaptiveSupport";
import { useHintLadder } from "@/hooks/useHintLadder";
import TokenStrip from "../TokenStrip";
import { BurstLayer, ComboBadge, useBursts, useWobble } from "../Juice";
import { useGameAudio } from "../useGameAudio";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import { createSessionRecorder } from "@/lib/gameAnalytics";
import LearningLabel from "../LearningLabel";
import RoundProgress from "../RoundProgress";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

interface Feeling {
  key: string;
  label: string;
  emoji: string;
}

const FEELINGS: Record<string, Feeling> = {
  happy: { key: "happy", label: "Happy", emoji: "😊" },
  sad: { key: "sad", label: "Sad", emoji: "😢" },
  angry: { key: "angry", label: "Angry", emoji: "😠" },
  surprised: { key: "surprised", label: "Surprised", emoji: "😲" },
  scared: { key: "scared", label: "Scared", emoji: "😨" },
  calm: { key: "calm", label: "Calm", emoji: "😌" },
};

interface Situation {
  text: string;
  cue: string;
  answer: string;
  decoys: string[];
}

const SITUATION_BANK: Situation[] = [
  { text: "You get a shiny new toy!", cue: "🎁", answer: "happy", decoys: ["sad", "surprised"] },
  { text: "Your ice cream falls on the ground.", cue: "🍦", answer: "sad", decoys: ["angry", "calm"] },
  { text: "A balloon pops loudly out of nowhere.", cue: "🎈", answer: "surprised", decoys: ["scared", "happy"] },
  { text: "Someone knocks over your tower on purpose.", cue: "🧱", answer: "angry", decoys: ["sad", "surprised"] },
  { text: "Your friend shares their snack with you.", cue: "🍪", answer: "happy", decoys: ["angry", "sad"] },
  { text: "Your favourite balloon flies away.", cue: "🎈", answer: "sad", decoys: ["surprised", "calm"] },
  { text: "Thunder booms very close to the window.", cue: "⛈️", answer: "scared", decoys: ["surprised", "calm"] },
  { text: "You are wrapped in a warm blanket.", cue: "🛋️", answer: "calm", decoys: ["happy", "angry"] },
  { text: "The lights go out suddenly.", cue: "🔌", answer: "surprised", decoys: ["scared", "happy"] },
  { text: "A big dog barks right next to you.", cue: "🐕", answer: "scared", decoys: ["angry", "sad"] },
  { text: "You wait your turn patiently and then it is your turn!", cue: "⏳", answer: "happy", decoys: ["calm", "surprised"] },
  { text: "Someone grabs your snack without asking.", cue: "😤", answer: "angry", decoys: ["scared", "calm"] },
];

export default function SituationFeelingsEngine({ game, onInteraction, onComplete }: Props) {
  const { difficulty, supportLevel } = getAdaptiveGameConfig(game);
  const adaptive = useAdaptiveSupport({ baseDelay: 5500 });

  const roundCount = difficulty === "easy" || supportLevel === "high"
    ? Math.min(2, SITUATION_BANK.length)
    : difficulty === "medium"
      ? Math.min(3, SITUATION_BANK.length)
      : Math.min(4, SITUATION_BANK.length);

  const rounds = useMemo(
    () => shuffleItems(SITUATION_BANK).slice(0, roundCount),
    [roundCount]
  );

  const [roundIndex, setRoundIndex] = useState(0);
  const [prompts, setPrompts] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const comboRef = useRef(0);
  const completedRef = useRef(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const { playHitSound, playMissSound } = useGameAudio();
  const { bursts, fireBurst } = useBursts();
  const { controls, wobble } = useWobble();
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);

  const round = rounds[roundIndex];
  const optionKeys = useMemo(() => {
    if (!round) return [] as string[];
    const count = supportLevel === "high"
      ? Math.max(2, 3 + Math.min(0, adaptive.distractorAdjust))
      : Math.max(2, Math.min(4, 3 + adaptive.distractorAdjust));
    const decoys = shuffleItems(round.decoys).slice(0, count - 1);
    return shuffleItems([round.answer, ...decoys]);
  }, [adaptive.distractorAdjust, round, supportLevel]);

  const hintVisible = useHintLadder({
    enabled: supportLevel === "high" || adaptive.errorStreak >= 1,
    delayMs: adaptive.hintDelay,
    resetKey: roundIndex,
  });

  useEffect(() => {
    if (!round) return;
    setWrongPicks([]);
    speak(`${round.text} How would you feel?`);
    rec.mark();
  }, [rec, round]);

  if (!round) return null;

  const handlePick = (key: string) => {
    const pickKey = `${roundIndex}:${key}`;
    if (wrongPicks.includes(pickKey)) return;

    onInteraction();
    const feeling = FEELINGS[key];

    if (key === round.answer) {
      rec.trial({
        stimulus: `situation:${round.answer}`,
        correct: true,
        positionIndex: optionKeys.indexOf(key),
        choiceCount: optionKeys.length,
        options: optionKeys.map((k) => FEELINGS[k].label),
        prompted: wrongPicks.length > 0 || hintVisible,
      });
      adaptive.recordSuccess(wrongPicks.length > 0 || hintVisible);
      comboRef.current += 1;
      setCombo(comboRef.current);
      playHitSound(comboRef.current);
      fireBurst(50, 42, feeling.emoji);
      speak(`Yes! You would feel ${feeling.label.toLowerCase()}.`);
      const nextRound = roundIndex + 1;
      if (nextRound >= rounds.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        const score = Math.max(60, 100 - prompts * 15);
        onComplete(score, undefined, withTrace(rec, buildCompletionMetrics({
          trials: rounds.length,
          correctTrials: rounds.length,
          errors: prompts,
          promptsNeeded: prompts,
          masteryThreshold: masteryForSupport(supportLevel),
          attemptsBySkill: { "emotional-awareness": rounds.length, perspective: rounds.length },
          observations: [
            `Matched feelings for ${rounds.length} everyday situations.`,
            prompts > 0 ? `Needed ${prompts} retry prompt${prompts === 1 ? "" : "s"} to connect situations with feelings.` : "Connected every situation with the right feeling on the first try.",
          ],
        })));
        return;
      }
      setRoundIndex(nextRound);
      return;
    }

    rec.trial({
      stimulus: `situation:${round.answer}`,
      correct: false,
      positionIndex: optionKeys.indexOf(key),
      choiceCount: optionKeys.length,
      prompted: false,
    });
    adaptive.recordError();
    setPrompts((value) => value + 1);
    setWrongPicks((current) => [...current, pickKey]);
    wobble();
    playMissSound();
    speak(`That is feeling ${feeling.label.toLowerCase()}. How would YOU feel?`);
  };

  return (
    <div className="mx-auto max-w-lg">
      <LearningLabel game={game} />
      <div className="mb-3 rounded-2xl bg-muted/70 p-3 text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">How Do They Feel?</p>
      </div>

      <div ref={boardRef} className="relative rounded-[2rem] border border-border bg-gradient-to-br from-emerald-50/80 to-sky-50/70 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <RoundProgress current={roundIndex} total={rounds.length} />
          <TokenStrip earned={roundIndex} total={rounds.length} token="💚" />
        </div>
        <ComboBadge combo={combo} />

        <motion.div layout className="mx-auto mb-5 w-fit rounded-3xl border border-border bg-card p-5 text-center shadow-sm">
          <span aria-hidden="true" className="block text-5xl">{round.cue}</span>
          <p className="mt-3 max-w-xs font-display text-lg font-bold leading-snug text-foreground">{round.text}</p>
        </motion.div>

        <motion.div animate={controls} className={`grid gap-3 ${optionKeys.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {optionKeys.map((key) => {
            const feeling = FEELINGS[key];
            const pickKey = `${roundIndex}:${key}`;
            const dimmed = wrongPicks.includes(pickKey);
            return (
              <button
                key={key}
                onClick={() => handlePick(key)}
                disabled={dimmed}
                aria-label={feeling.label}
                className={`touch-target rounded-3xl border-2 bg-card p-3 shadow-sm transition-colors ${
                  hintVisible && key === round.answer && !dimmed
                    ? "animate-pulse border-amber-400 ring-4 ring-amber-300/60"
                    : dimmed
                      ? "border-border opacity-40"
                      : "border-border hover:border-primary"
                }`}
              >
                <span aria-hidden="true" className="block text-5xl">{feeling.emoji}</span>
                <span className="mt-1 block text-xs font-black uppercase tracking-wide text-muted-foreground">{feeling.label}</span>
              </button>
            );
          })}
          <BurstLayer bursts={bursts} />
        </motion.div>

        <p className="mt-4 text-center text-xs text-muted-foreground">Pick the face that matches the story.</p>
      </div>
    </div>
  );
}
