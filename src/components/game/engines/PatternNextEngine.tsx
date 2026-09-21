import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import { BurstLayer, ComboBadge, useBursts, useWobble } from "../Juice";
import { useGameAudio } from "../useGameAudio";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import { useAdaptiveSupport } from "@/hooks/useAdaptiveSupport";
import { useHintLadder } from "@/hooks/useHintLadder";
import TokenStrip from "../TokenStrip";
import LearningLabel from "../LearningLabel";
import { createSessionRecorder } from "@/lib/gameAnalytics";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

const PATTERN_SETS: Record<string, string[][]> = {
  colors: [
    ["🔴", "🔵"],
    ["🟡", "🟢"],
    ["🟣", "🟠"],
  ],
  animals: [
    ["🐶", "🐱"],
    ["🐸", "🐰"],
    ["🐦", "🐟"],
  ],
  vehicles: [
    ["🚗", "🚌"],
    ["🚲", "🚂"],
    ["✈️", "🚀"],
  ],
  foods: [
    ["🍎", "🍌"],
    ["🍇", "🍓"],
    ["🥕", "🌽"],
  ],
  shapes: [
    ["⭕", "🟦"],
    ["🔺", "⭐"],
    ["🔶", "⚪"],
  ],
  feelings: [
    ["😊", "😢"],
    ["😠", "😲"],
    ["😴", "🤩"],
  ],
  weather: [
    ["☀️", "☁️"],
    ["🌧️", "🌈"],
    ["❄️", "⚡"],
  ],
  fruits: [
    ["🍎", "🍌"],
    ["🍇", "🍓"],
    ["🍊", "🍉"],
  ],
  froebel: [
    ["🔺", "🟦"],
    ["⭕", "🔶"],
    ["🔺", "⭕"],
  ],
  sounds: [
    ["🎵", "🔔"],
    ["🥁", "🎸"],
    ["👏", "🎶"],
  ],
  body: [
    ["✋", "🦶"],
    ["👁️", "👂"],
    ["👃", "👄"],
  ],
  zoo: [
    ["🐘", "🦒"],
    ["🦁", "🐯"],
    ["🐒", "🦓"],
  ],
  circus: [
    ["🎪", "🍿"],
    ["🤹", "🎈"],
    ["🎩", "🃏"],
  ],
  colorsTrio: [
    ["🔴", "🔵", "🟡"],
    ["🟢", "🟣", "🟠"],
    ["⚫", "⚪", "🟤"],
  ],
  animalsTrio: [
    ["🐶", "🐱", "🐰"],
    ["🐸", "🐦", "🐟"],
    ["🦁", "🐘", "🐒"],
  ],
  shapesTrio: [
    ["⭕", "🟦", "🔺"],
    ["⭐", "🔶", "⚪"],
    ["🟩", "🔻", "🔵"],
  ],
};

const POOL_EXTRA: Record<string, string[]> = {
  colors: ["🍎", "💜", "🟤"],
  animals: ["🐻", "🦁", "🐢"],
  vehicles: ["🏎️", "🛵", "⛵"],
  foods: ["🍞", "🧀", "🫐"],
  shapes: ["🔻", "🔲", "🥚"],
  feelings: ["🙂", "😭", "😌"],
  weather: ["🌤️", "🌩️", "⛄"],
  fruits: ["🥝", "🍑", "🍒"],
  froebel: ["🟨", "⬜", "🟠"],
  sounds: ["🎤", "🪘", "🎧"],
  body: ["🖐️", "🦵", "👅"],
  zoo: ["🐒", "🐧", "🐢"],
  circus: ["🎪", "🎭", "🍭"],
  colorsTrio: ["💜", "🟥", "🟧"],
  animalsTrio: ["🐻", "🦊", "🐢"],
  shapesTrio: ["🔷", "⬜", "🔸"],
};

interface PatternRound {
  unit: string[];
  shown: string[];
  answer: string;
  spoken: string;
}

function buildRound(unit: string[]): PatternRound {
  const shown = Array.from({ length: unit.length * 2 }, (_, index) => unit[index % unit.length]);
  return {
    unit,
    shown,
    answer: unit[0],
    spoken: `${shown.join(", ")}… what comes next?`,
  };
}

export default function PatternNextEngine({ game, onInteraction, onComplete }: Props) {
  const theme = String(game.config.theme || "colors");
  const { difficulty, supportLevel } = getAdaptiveGameConfig(game);
  const units = PATTERN_SETS[theme] || PATTERN_SETS.colors;
  const roundCount = difficulty === "easy" || supportLevel === "high" ? Math.min(3, units.length) : Math.min(4, units.length);

  const rounds = useMemo(
    () => Array.from({ length: roundCount }, (_, index) => buildRound(units[index % units.length])),
    [roundCount, units]
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
  const adaptive = useAdaptiveSupport({ baseDelay: 5500 });

  const round = rounds[roundIndex];
  const extras = POOL_EXTRA[theme] || [];

  const options = useMemo<string[]>(() => {
    if (!round) return [];
    const baseDecoys = supportLevel === "high" ? 1 : 2;
    const decoyCount = Math.max(1, Math.min(3, baseDecoys + adaptive.distractorAdjust));
    const decoys = shuffleItems(extras.filter((symbol) => !round.unit.includes(symbol))).slice(0, decoyCount);
    return shuffleItems([round.answer, ...decoys]);
  }, [adaptive.distractorAdjust, extras, round, supportLevel]);

  const hintVisible = useHintLadder({
    enabled: supportLevel === "high" || adaptive.errorStreak >= 1,
    delayMs: adaptive.hintDelay,
    resetKey: roundIndex,
  });

  useEffect(() => {
    if (!round) return;
    setWrongPicks([]);
    speak(round.spoken);
    rec.mark();
  }, [rec, round]);

  if (!round) return null;

  const handlePick = (option: string) => {
    onInteraction();
    if (option === round.answer) {
      rec.trial({
        stimulus: `${theme}#${roundIndex}`,
        correct: true,
        positionIndex: options.indexOf(option),
        choiceCount: options.length,
        options,
        prompted: wrongPicks.length > 0,
      });
      adaptive.recordSuccess(wrongPicks.length > 0);
      comboRef.current += 1;
      setCombo(comboRef.current);
      playHitSound(comboRef.current);
      fireBurst(50, 45, option);
      speak(`Yes! ${round.answer} comes next.`);
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
          attemptsBySkill: { patterns: rounds.length, prediction: rounds.length },
          observations: [
            `Completed all ${rounds.length} what-comes-next patterns.`,
            prompts > 0 ? `Needed ${prompts} retry prompt${prompts === 1 ? "" : "s"} while learning the rule.` : "Predicted every next item on the first try.",
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
    setWrongPicks((current) => [...current, option]);
    adaptive.recordError();
    rec.trial({
      stimulus: `${theme}#${roundIndex}`,
      correct: false,
      positionIndex: options.indexOf(option),
      choiceCount: options.length,
        options,
      prompted: false,
    });
    wobble();
    playMissSound();
    speak(`Not yet. Say it with me: ${round.shown.join(", ")}`);
  };

  return (
    <div className="mx-auto max-w-lg text-center">
      <LearningLabel game={game} />
      <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-primary">What Comes Next?</p>

      <div ref={boardRef} className="relative mb-5 rounded-[2rem] border border-border bg-gradient-to-br from-amber-50/80 to-sky-50/70 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Round {roundIndex + 1} of {rounds.length}
          </span>
          <TokenStrip earned={roundIndex} total={rounds.length} token="🔮" />
        </div>
        <ComboBadge combo={combo} />
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          {round.shown.map((symbol, index) => (
            <motion.span
              key={`${symbol}-${index}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08 }}
              className="grid h-16 w-16 place-items-center rounded-2xl border border-border bg-card text-4xl shadow-sm"
            >
              <span aria-hidden="true">{symbol}</span>
            </motion.span>
          ))}
          <motion.span
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-dashed border-primary/60 bg-primary/10 text-3xl font-black text-primary"
          >
            ?
          </motion.span>
        </div>

        <motion.div animate={controls} className={`grid gap-3 ${options.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
          {options.map((option) => {
            const dimmed = wrongPicks.includes(option);
            return (
              <motion.button
                key={option}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  if (wrongPicks.includes(option)) return;
                  handlePick(option);
                }}
                className={`touch-target aspect-square rounded-3xl border-2 bg-card text-5xl shadow-sm transition-colors ${
                  hintVisible && option === round.answer && !dimmed
                    ? "animate-pulse border-amber-400 ring-4 ring-amber-300/60"
                    : dimmed
                      ? "border-border opacity-40"
                      : "border-border hover:border-primary"
                }`}
              >
                <span aria-hidden="true">{option}</span>
              </motion.button>
            );
          })}
          <BurstLayer bursts={bursts} />
        </motion.div>
        <p className="mt-4 text-xs text-muted-foreground">Say the pattern out loud, then choose what comes next.</p>
      </div>
    </div>
  );
}
