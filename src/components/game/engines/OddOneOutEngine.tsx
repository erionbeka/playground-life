import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import { speak } from "@/lib/speech";
import { useHintLadder } from "@/hooks/useHintLadder";
import { useAdaptiveSupport } from "@/hooks/useAdaptiveSupport";
import { BurstLayer, ComboBadge, useBursts, useWobble } from "../Juice";
import TokenStrip from "../TokenStrip";
import { useGameAudio } from "../useGameAudio";
import { buildCompletionMetrics, GameCompletionMetrics, masteryForSupport, withTrace } from "../gameCompletion";
import LearningLabel from "../LearningLabel";
import { createSessionRecorder } from "@/lib/gameAnalytics";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number, socialScore?: number, metrics?: GameCompletionMetrics) => void;
}

interface OddRow {
  group: string[];
  odd: string;
  reason: string;
}

export const ODD_SETS: Record<string, OddRow[]> = {
  animals: [
    { group: ["🐕", "🐈", "🐇"], odd: "🚗", reason: "a car is not an animal" },
    { group: ["🐸", "🐟", "🦆"], odd: "🍕", reason: "pizza is not an animal" },
    { group: ["🐘", "🦒", "🐄"], odd: "🪑", reason: "a chair is not an animal" },
    { group: ["🦁", "🐯", "🐻"], odd: "🎈", reason: "a balloon is not an animal" },
  ],
  food: [
    { group: ["🍎", "🍌", "🍇"], odd: "🚲", reason: "a bike is not food" },
    { group: ["🥕", "🌽", "🥦"], odd: "🐶", reason: "a dog is not a vegetable" },
    { group: ["🍞", "🧇", "🥐"], odd: "🚀", reason: "a rocket is not food" },
    { group: ["🧀", "🥛", "🍳"], odd: "🌳", reason: "a tree is not food" },
  ],
  vehicles: [
    { group: ["🚗", "🚌", "🚕"], odd: "🍌", reason: "a banana is not a vehicle" },
    { group: ["✈️", "🚁", "🎈"], odd: "🐸", reason: "a frog does not fly with people inside" },
    { group: ["🚂", "🚲", "🛵"], odd: "🏠", reason: "a house is not a vehicle" },
    { group: ["⛵", "🛶", "🚤"], odd: "🎸", reason: "a guitar is not a vehicle" },
  ],
  shapes: [
    { group: ["⭕", "🟠", "⚪"], odd: "🔺", reason: "the triangle has corners; the others are round" },
    { group: ["🟦", "🔲", "🟨"], odd: "🔵", reason: "the circle has no corners; the others have four sides" },
    { group: ["🔺", "🔻", "⛰️"], odd: "⭕", reason: "the circle is not pointy like the others" },
    { group: ["⭐", "🌟", "✨"], odd: "🧊", reason: "the ice cube is not a star shape" },
  ],
  colors: [
    { group: ["🔴", "🌹", "🍓"], odd: "🔵", reason: "the blue circle is not red" },
    { group: ["🔵", "💧", "🫐"], odd: "🟡", reason: "the yellow circle is not blue" },
    { group: ["🟢", "🥝", "🌲"], odd: "🟣", reason: "the purple circle is not green" },
    { group: ["🟡", "🍋", "🌻"], odd: "🍎", reason: "the apple is not yellow" },
  ],
  letters: [
    { group: ["A", "B", "C"], odd: "7", reason: "seven is a number, not a letter" },
    { group: ["1", "2", "3"], odd: "E", reason: "E is a letter, not a number" },
    { group: ["D", "E", "F"], odd: "🍎", reason: "an apple is not a letter" },
    { group: ["4", "5", "6"], odd: "🚗", reason: "a car is not a number" },
  ],
  bodyparts: [
    { group: ["✋", "🦶", "👂"], odd: "🍌", reason: "a banana is not a body part" },
    { group: ["👁️", "👃", "👄"], odd: "🚗", reason: "a car is not a body part" },
    { group: ["💪", "🦵", "🦷"], odd: "🍕", reason: "pizza is not a body part" },
    { group: ["🖐️", "🦻", "👅"], odd: "🎈", reason: "a balloon is not a body part" },
  ],
  music: [
    { group: ["🎸", "🎹", "🥁"], odd: "🍎", reason: "an apple is not an instrument" },
    { group: ["🎺", "🎻", "🔔"], odd: "🐸", reason: "a frog is not an instrument" },
    { group: ["🎤", "🎧", "🪈"], odd: "🧦", reason: "a sock is not an instrument" },
    { group: ["🪘", "🎷", "🪗"], odd: "📚", reason: "a book is not an instrument" },
  ],
  nature: [
    { group: ["🌳", "🌸", "🌿"], odd: "🚂", reason: "a train is not part of nature" },
    { group: ["☀️", "🌙", "⭐"], odd: "🍔", reason: "a burger is not in the sky" },
    { group: ["🍄", "🍂", "🌊"], odd: "👟", reason: "a shoe is not part of nature" },
    { group: ["🌈", "☁️", "❄️"], odd: "🪑", reason: "a chair is not weather" },
  ],
  weather: [
    { group: ["☀️", "🌤️", "🌞"], odd: "⛄", reason: "the snowman is not a sun thing" },
    { group: ["🌧️", "💧", "🌊"], odd: "🔥", reason: "fire is not wet weather" },
    { group: ["❄️", "⛄", "🧤"], odd: "🏖️", reason: "the beach is not cold weather" },
    { group: ["⚡", "🌩️", "⛈️"], odd: "🌈", reason: "the rainbow comes after storms, not during" },
  ],
  instruments: [
    { group: ["🎸", "🎹", "🥁"], odd: "🚗", reason: "a car is not an instrument" },
    { group: ["🎤", "🎻", "🔔"], odd: "🍕", reason: "pizza is not an instrument" },
    { group: ["🎺", "🪈", "🪗"], odd: "🧸", reason: "a teddy is not an instrument" },
    { group: ["🪘", "🎷", "🎧"], odd: "🌳", reason: "a tree is not an instrument" },
  ],
  toys: [
    { group: ["🧸", "🪁", "🎲"], odd: "🥕", reason: "a carrot is not a toy" },
    { group: ["⚽", "🏀", "🏈"], odd: "🧦", reason: "a sock is not a toy ball" },
    { group: ["🎨", "🪄", "🧩"], odd: "🐘", reason: "an elephant is not a toy" },
  ],
sea: [
    { group: ["🐠", "🐟", "🐡"], odd: "🐘", reason: "an elephant does not live in the sea" },
    { group: ["🐙", "🦑", "🦀"], odd: "🐦", reason: "a bird is not a sea creature" },
    { group: ["🐬", "🐳", "🦈"], odd: "🐄", reason: "a cow is not a sea animal" },
    { group: ["🐚", "🪸", "🐢"], odd: "🐝", reason: "a bee is not a sea creature" },
  ],
  expertAnimals: [
    { group: ["🐕", "🐈", "🐇"], odd: "🦜", reason: "a parrot is a bird — the other three are furry pets" },
    { group: ["🐶", "🐕", "🐩"], odd: "🐱", reason: "a cat is not a dog — the others are all dogs" },
    { group: ["🐘", "🦒", "🐄"], odd: "🐳", reason: "a whale lives in the sea; the others are land animals" },
    { group: ["🐔", "🦆", "🐤"], odd: "🐴", reason: "a horse does not lay eggs; the others are farm birds" },
    { group: ["🦈", "🐬", "🐳"], odd: "🐢", reason: "a turtle has a shell; the others are smooth swimmers" },
    { group: ["🐝", "🐜", "🦋"], odd: "🐌", reason: "a snail has no wings; the others are flying insects" },
  ],
  expertFood: [
    { group: ["🍎", "🍌", "🍇"], odd: "🥕", reason: "a carrot is a vegetable; the others are fruit" },
    { group: ["🥕", "🥦", "🍅"], odd: "🍦", reason: "ice cream is a sweet treat; the others are healthy vegetables" },
    { group: ["🥐", "🍞", "🧇"], odd: "🍕", reason: "pizza is dinner food; the others are breakfast breads" },
    { group: ["🍪", "🍰", "🧁"], odd: "🍎", reason: "an apple is nature's snack; the others are baked sweets" },
    { group: ["🥛", "🧀", "🍦"], odd: "🥤", reason: "a soda is fizzy; the others are made from milk" },
    { group: ["🍇", "🍊", "🍉"], odd: "🌽", reason: "corn is a vegetable, not a fruit" },
  ],
};

export default function OddOneOutEngine({ game, onInteraction, onComplete }: Props) {
  const theme = String(game.config.theme || "animals");
  const { difficulty, supportLevel } = getAdaptiveGameConfig(game);
  const rows = ODD_SETS[theme] || ODD_SETS.animals;
  const roundCount = difficulty === "easy" || supportLevel === "high" ? Math.min(3, rows.length) : Math.min(4, rows.length);
  const adaptive = useAdaptiveSupport({ baseDelay: 6000 });

  const rounds = useMemo(
    () => Array.from({ length: roundCount }, (_, index) => rows[index % rows.length]),
    [roundCount, rows]
  );

  const [roundIndex, setRoundIndex] = useState(0);
  const [prompts, setPrompts] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("Which one does not belong?");
  const comboRef = useRef(0);
  const completedRef = useRef(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const { playHitSound, playMissSound } = useGameAudio();
  const { bursts, fireBurst } = useBursts();
  const { controls, wobble } = useWobble();
  const rec = useMemo(() => createSessionRecorder(game.id), [game.id]);

  const hintVisible = useHintLadder({
    enabled: supportLevel === "high" || adaptive.errorStreak >= 1,
    delayMs: adaptive.hintDelay,
    resetKey: roundIndex,
  });
  const row = rounds[roundIndex];

  const options = useMemo(() => {
    if (!row) return [];
    const baseGroupSize = supportLevel === "high" ? 2 : 3;
    const groupSize = Math.max(2, baseGroupSize + Math.min(0, adaptive.distractorAdjust));
    return shuffleItems([...row.group.slice(0, groupSize), row.odd]);
  }, [adaptive.distractorAdjust, row, supportLevel]);

  useEffect(() => {
    speak("Which one does not belong?");
    rec.mark();
  }, [rec, roundIndex]);

  if (!row) return null;

  const handlePick = (option: string) => {
    const pickKey = `${roundIndex}:${option}`;
    if (wrongPicks.includes(pickKey)) return;

    onInteraction();
    if (option === row.odd) {
      rec.trial({
        stimulus: `odd:${theme}#${roundIndex}`,
        correct: true,
        positionIndex: options.indexOf(option),
        choiceCount: options.length,
        options,
        prompted: wrongPicks.length > 0 || hintVisible,
      });
      adaptive.recordSuccess(wrongPicks.length > 0 || hintVisible);
      comboRef.current += 1;
      setCombo(comboRef.current);
      setWrongPicks([]);
      playHitSound(comboRef.current);
      fireBurst(50, 45, option);
      speak(`Yes! ${row.reason}.`);
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
          attemptsBySkill: { reasoning: rounds.length, categorization: rounds.length },
          observations: [
            `Solved all ${rounds.length} odd-one-out puzzles.`,
            prompts > 0 ? `Needed ${prompts} gentle retry prompt${prompts === 1 ? "" : "s"} before finding the difference.` : "Found every different item on the first try.",
          ],
        })));
        return;
      }
      setRoundIndex(nextRound);
      setFeedback("Which one does not belong?");
      return;
    }

    comboRef.current = 0;
    setCombo(0);
    setPrompts((value) => value + 1);
    setWrongPicks((current) => [...current, pickKey]);
    adaptive.recordError();    rec.trial({
      stimulus: `odd:${theme}#${roundIndex}`,
      correct: false,
      positionIndex: options.indexOf(option),
      choiceCount: options.length,
      prompted: false,
    });
    wobble();
    playMissSound();
    setFeedback(`Good thinking. Look again — which one is different?`);
    speak("Look again. Which one is different?");
  };

  return (
    <div className="mx-auto max-w-lg text-center">
      <LearningLabel game={game} />
      <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-primary">Odd One Out · Thinking</p>
      <p className="mb-2 text-sm font-semibold text-foreground">{feedback}</p>

      <div ref={boardRef} className="relative rounded-[2rem] border border-border bg-gradient-to-br from-sky-50/80 to-violet-50/70 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Round {roundIndex + 1} of {rounds.length}
          </span>
          <TokenStrip earned={roundIndex} total={rounds.length} token="🔍" />
        </div>
        <ComboBadge combo={combo} />
        <motion.div animate={controls} className={`grid gap-3 ${options.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
          {options.map((option) => {
            const pickKey = `${roundIndex}:${option}`;
            const dimmed = wrongPicks.includes(pickKey);
            return (
              <motion.button
                key={option}
                whileTap={{ scale: 0.92 }}
                onClick={() => handlePick(option)}
                disabled={dimmed}
                className={`touch-target aspect-square rounded-3xl border-2 bg-card text-6xl shadow-sm transition-colors ${
                  hintVisible && option === row.odd && !dimmed
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
        <p className="mt-4 text-xs text-muted-foreground">Three pictures match. One is different.</p>
      </div>
    </div>
  );
}
