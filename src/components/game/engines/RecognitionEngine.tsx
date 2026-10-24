import { useMemo, useState, useRef } from "react";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import LearningLabel from "../LearningLabel";
import RoundProgress from "../RoundProgress";
import { speak } from "@/lib/speech";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number) => void;
}

const themeTargets: Record<string, { target: string; items: string[]; correctItems: string[] }> = {
  "red things": { target: "Pick the red things", items: ["🍎", "🚗", "🍓", "🔵", "🌹", "🟢"], correctItems: ["🍎", "🚗", "🍓", "🌹"] },
  "blue things": { target: "Pick the blue things", items: ["🫐", "🐟", "🔵", "🍋", "🍎", "🟡"], correctItems: ["🫐", "🐟", "🔵"] },
  "round objects": { target: "Pick the round objects", items: ["⚽", "🟡", "🍪", "📘", "🧱", "🔺"], correctItems: ["⚽", "🟡", "🍪"] },
  "square objects": { target: "Pick the square objects", items: ["🟦", "⬜", "📦", "⚽", "🍊", "🌙"], correctItems: ["🟦", "⬜", "📦"] },
  "learn animals": { target: "Tap the animals", items: ["🐶", "🚗", "🐱", "🐸", "🎈", "🐰"], correctItems: ["🐶", "🐱", "🐸", "🐰"] },
  "learn emotions": { target: "Tap the faces showing emotions", items: ["😊", "😮", "📘", "😢", "🧩", "😡"], correctItems: ["😊", "😮", "😢", "😡"] },
  "learn colors": { target: "Tap the color circles", items: ["🔴", "🔵", "🟢", "🍎", "🚗", "🌼"], correctItems: ["🔴", "🔵", "🟢"] },
  "learn shapes": { target: "Tap the shapes", items: ["🔺", "🟦", "⭐", "🍎", "🚗", "🌼"], correctItems: ["🔺", "🟦", "⭐"] },
  "rainbow sort": { target: "Pick the rainbow colors", items: ["Red", "Orange", "Yellow", "Green", "Blue", "Book"], correctItems: ["Red", "Orange", "Yellow", "Green", "Blue"] },
  "shape shadows": { target: "Pick the shape shadows", items: ["Triangle", "Square", "Circle", "Diamond", "Tree", "Car"], correctItems: ["Triangle", "Square", "Circle", "Diamond"] },
  "color mixing": { target: "Pick the mixed colors", items: ["Purple", "Green", "Orange", "Red", "Blue", "Yellow"], correctItems: ["Purple", "Green", "Orange"] },
  "pattern fill": { target: "Pick the repeating pattern pieces", items: ["AB", "BA", "AAB", "BBA", "Car", "Sun"], correctItems: ["AB", "BA", "AAB", "BBA"] },
  "shape puzzle": { target: "Pick the puzzle shapes", items: ["Triangle", "Square", "Circle", "Diamond", "Fish", "Leaf"], correctItems: ["Triangle", "Square", "Circle", "Diamond"] },
  "color match": { target: "Pick the color matches", items: ["Red", "Blue", "Green", "Yellow", "Dog", "Cup"], correctItems: ["Red", "Blue", "Green", "Yellow"] },
  "triangle hunt": { target: "Find the triangles", items: ["Triangle", "Triangle", "Triangle", "Square", "Circle", "Diamond"], correctItems: ["Triangle"] },
  "symmetry mirror": { target: "Pick the mirrored pairs", items: ["||", "<>", "()", "[]", "T", "L"], correctItems: ["||", "<>", "()", "[]"] },
  default: { target: "Pick the matching items", items: ["⭐", "⭐", "🎈", "🧩", "⭐", "🎨"], correctItems: ["⭐"] },
};

export default function RecognitionEngine({ game, onInteraction, onComplete }: Props) {
  const theme = String(game.config.theme || "default");
  const pack = themeTargets[theme] || themeTargets.default;
  const effective = {
    target: typeof game.config.target === "string" && game.config.target ? game.config.target : pack.target,
    items: Array.isArray(game.config.items) ? (game.config.items as string[]) : pack.items,
    correctItems: Array.isArray(game.config.correctItems) ? (game.config.correctItems as string[]) : pack.correctItems,
  };
  const { personalized, supportLevel } = getAdaptiveGameConfig(game);
  const correctItems = useMemo(() => {
    if (personalized && supportLevel === "high") return effective.correctItems.slice(0, Math.min(2, effective.correctItems.length));
    return effective.correctItems;
  }, [effective.correctItems, personalized, supportLevel]);
  const correctSet = useMemo(() => new Set(correctItems), [correctItems]);
  const pool = useMemo(() => {
    const wrongItems = effective.items.filter((item) => !effective.correctItems.includes(item));
    const wrongLimit = personalized && supportLevel === "high" ? 2 : wrongItems.length;
    return shuffleItems([...correctItems, ...wrongItems.slice(0, wrongLimit)]);
  }, [correctItems, effective.correctItems, effective.items, personalized, supportLevel]);

  const totalCorrect = correctItems.length;
  const [selected, setSelected] = useState<number[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);

  const handlePick = (index: number, value: string) => {
    if (selected.includes(index)) return;

    onInteraction();
    const nextSelected = [...selected, index];
    const isCorrect = correctSet.has(value);
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    const nextMistakes = mistakes + (isCorrect ? 0 : 1);

    setSelected(nextSelected);
    setCorrectCount(nextCorrect);
    setMistakes(nextMistakes);

    if (nextCorrect >= totalCorrect) {
      const score = Math.max(40, 100 - nextMistakes * 20);
      onComplete(score);
    }
  };

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mb-4 flex items-center justify-between">
        <LearningLabel game={game} />
        <RoundProgress current={correctCount} total={totalCorrect} />
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">ABLLS-R Listener Responding</p>
          <p className="text-lg font-display font-bold text-foreground">{effective.target}</p>
        </div>
        <button
          onClick={() => speak(effective.target)}
          className="rounded-xl bg-primary/10 p-3 text-primary hover:bg-primary/20 touch-target"
          title="Play audio prompt"
        >
          🔊
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {pool.map((item, index) => {
          const isSelected = selected.includes(index);
          const isTarget = correctSet.has(item);
          const showPromptCue = (supportLevel === "high" || supportLevel === "moderate") && isTarget && !isSelected;

          return (
            <button
              key={`${item}-${index}`}
              onClick={() => handlePick(index, item)}
              aria-label={item}
              className={`touch-target relative rounded-2xl border-2 p-6 text-4xl transition-all ${
                isSelected
                  ? "border-secondary bg-secondary/20 scale-95"
                  : showPromptCue
                  ? "border-primary/60 bg-primary/5 animate-pulse shadow-md"
                  : "border-border bg-card hover:border-primary"
              }`}
            >
              {item}
              {showPromptCue && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground pointer-events-none">
                  ★
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {supportLevel === "high" || supportLevel === "moderate" ? "💡 Errorless learning prompt active: Correct targets have a gold star-cue." : "Select all correct matching targets."}
      </p>
    </div>
  );
}
