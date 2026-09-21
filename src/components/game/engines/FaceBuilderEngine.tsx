import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import { BurstLayer, ComboBadge, useBursts, useWobble } from "../Juice";
import { useGameAudio } from "../useGameAudio";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import { createSessionRecorder } from "@/lib/gameAnalytics";
import { useAdaptiveSupport } from "@/hooks/useAdaptiveSupport";
import { useHintLadder } from "@/hooks/useHintLadder";
import TokenStrip from "../TokenStrip";
import LearningLabel from "../LearningLabel";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

interface EmotionPart {
  key: string;
  label: string;
  mouthPath: string;
  mouthType: "path" | "circle";
  sentence: string;
}

const EMOTIONS: EmotionPart[] = [
  { key: "happy", label: "Happy", mouthPath: "M26 48 Q40 62 54 48", mouthType: "path", sentence: "This is a happy face! The mouth curves up." },
  { key: "sad", label: "Sad", mouthPath: "M26 58 Q40 46 54 58", mouthType: "path", sentence: "This is a sad face. The mouth curves down." },
  { key: "surprised", label: "Surprised", mouthPath: "", mouthType: "circle", sentence: "This is a surprised face! The mouth makes an O." },
  { key: "angry", label: "Angry", mouthPath: "M28 56 L38 52 L42 58 L52 52", mouthType: "path", sentence: "This is an angry face. See the scrunched mouth." },
];

function FaceSvg({ mouth, eyeSize = 3 }: { mouth: EmotionPart | null; eyeSize?: number }) {
  return (
    <svg viewBox="0 0 80 80" className="h-44 w-44 drop-shadow-md" aria-hidden="true">
      <circle cx="40" cy="40" r="32" fill="#FDE68A" stroke="#F59E0B" strokeWidth="2.5" />
      <circle cx="29" cy="31" r={eyeSize} fill="#1F2937" />
      <circle cx="51" cy="31" r={eyeSize} fill="#1F2937" />
      {mouth ? (
        mouth.mouthType === "circle" ? (
          <ellipse cx="40" cy="55" rx="6" ry="7" fill="#7C2D12" />
        ) : (
          <path d={mouth.mouthPath} fill="none" stroke="#7C2D12" strokeWidth="3.5" strokeLinecap="round" />
        )
      ) : (
        <rect x="28" y="50" width="24" height="6" rx="3" fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 3" />
      )}
    </svg>
  );
}

function MouthThumb({ part }: { part: EmotionPart }) {
  return (
    <svg viewBox="16 34 48 34" className="h-14 w-full" aria-hidden="true">
      {part.mouthType === "circle" ? (
        <ellipse cx="40" cy="55" rx="6" ry="7" fill="#7C2D12" />
      ) : (
        <path d={part.mouthPath} fill="none" stroke="#334155" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export default function FaceBuilderEngine({ game, onInteraction, onComplete }: Props) {
  const { difficulty, supportLevel } = getAdaptiveGameConfig(game);
  const emotionKeys = useMemo(
    () =>
      difficulty === "easy" || supportLevel === "high"
        ? ["happy", "sad"]
        : difficulty === "medium"
          ? ["happy", "sad", "surprised"]
          : ["happy", "sad", "surprised", "angry"],
    [difficulty, supportLevel]
  );
  const rounds = useMemo(
    () => emotionKeys.map((key) => EMOTIONS.find((emotion) => emotion.key === key)).filter((entry): entry is EmotionPart => Boolean(entry)),
    [emotionKeys]
  );

  const [roundIndex, setRoundIndex] = useState(0);
  const [prompts, setPrompts] = useState(0);
  const [combo, setCombo] = useState(0);
  const [attached, setAttached] = useState<EmotionPart | null>(null);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const comboRef = useRef(0);
  const completedRef = useRef(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const { playHitSound, playMissSound } = useGameAudio();
  const { bursts, fireBurst } = useBursts();
  const { controls, wobble } = useWobble();
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);

  const target = rounds[roundIndex];
  const adaptive = useAdaptiveSupport({ baseDelay: 5000 });
  const baseDecoys = supportLevel === "high" ? 1 : difficulty === "hard" ? 3 : 2;
  const decoyCount = Math.max(1, Math.min(3, baseDecoys + adaptive.distractorAdjust));

  const options = useMemo(() => {
    if (!target) return [];
    const decoys = shuffleItems(EMOTIONS.filter((emotion) => emotion.key !== target.key)).slice(0, decoyCount);
    return shuffleItems([target, ...decoys]);
  }, [decoyCount, target]);

  const hintVisible = useHintLadder({
    enabled: supportLevel === "high" || adaptive.errorStreak >= 1,
    delayMs: adaptive.hintDelay,
    resetKey: roundIndex,
  });

  useEffect(() => {
    if (!target) return;
    setAttached(null);
    setWrongPicks([]);
    speak(`Build a ${target.label.toLowerCase()} face. Which mouth goes?`);
    rec.mark();
  }, [rec, target]);

  if (!target) return null;

  const handlePick = (part: EmotionPart) => {
    onInteraction();
    setAttached(part);

    if (part.key === target.key) {
      rec.trial({
        stimulus: target.key,
        correct: true,
        positionIndex: options.findIndex((option) => option.key === part.key),
        choiceCount: options.length,
        options: options.map((option) => option.label),
        prompted: wrongPicks.length > 0 || hintVisible,
      });
      adaptive.recordSuccess(wrongPicks.length > 0 || hintVisible);
      comboRef.current += 1;
      setCombo(comboRef.current);
      playHitSound(comboRef.current);
      fireBurst(50, 40, "😊");
      speak(part.sentence);
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
          attemptsBySkill: { "emotional-awareness": rounds.length, "visual-discrimination": rounds.length },
          observations: [
            `Built all ${rounds.length} feeling faces (${emotionKeys.join(", ")}).`,
            prompts > 0 ? `Needed ${prompts} retry prompt${prompts === 1 ? "" : "s"} to match mouths to feelings.` : "Matched every mouth to its feeling on the first try.",
          ],
        })));
        return;
      }
      setRoundIndex(nextRound);
      return;
    }

    comboRef.current = 0;
    setCombo(0);
    setPrompts((value) => value + 1);
    setWrongPicks((current) => [...current, part.key]);
    rec.trial({
      stimulus: target.key,
      correct: false,
      positionIndex: options.findIndex((option) => option.key === part.key),
      choiceCount: options.length,
        options: options.map((option) => option.label),
      prompted: false,
    });
    adaptive.recordError();
    wobble();
    playMissSound();
    window.setTimeout(() => setAttached(null), 500);
    speak(`That mouth looks different. Try again for a ${target.label.toLowerCase()} face.`);
  };

  return (
    <div className="mx-auto max-w-lg text-center">
      <LearningLabel game={game} />
      <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-primary">Face Builder · Feelings</p>

      <div ref={boardRef} className="relative rounded-[2rem] border border-border bg-gradient-to-br from-rose-50/80 to-amber-50/70 p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Face {roundIndex + 1} of {rounds.length}</span>
          <TokenStrip earned={roundIndex} total={rounds.length} token="😊" />
        </div>
        <ComboBadge combo={combo} />
        <motion.div animate={controls} layout>
          <motion.div
            key={target.key}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: attached ? [1, 1.12, 1] : 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
            className="mx-auto w-fit"
          >
            <FaceSvg mouth={attached} eyeSize={target.key === "surprised" && attached?.key === target.key ? 4 : 3} />
          </motion.div>

          <p className="mb-4 font-display text-lg font-bold text-foreground">Build a {target.label.toLowerCase()} face</p>

          <div className={`grid gap-3 ${options.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {options.map((part) => {
              const dimmed = wrongPicks.includes(part.key);
              return (
                <button
                  key={part.key}
                  onClick={() => {
                    if (dimmed) return;
                    handlePick(part);
                  }}
                  className={`touch-target rounded-2xl border-2 bg-card p-2 shadow-sm transition-colors ${
                    hintVisible && part.key === target.key && !dimmed
                      ? "animate-pulse border-amber-400 ring-4 ring-amber-300/60"
                      : dimmed
                        ? "border-border opacity-40"
                        : "border-border hover:border-primary"
                  }`}
                  aria-label={`${part.label} mouth`}
                >
                  <MouthThumb part={part} />
                </button>
              );
            })}
          </div>
          <BurstLayer bursts={bursts} />
        </motion.div>
      </div>
    </div>
  );
}
