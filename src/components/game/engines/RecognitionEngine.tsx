import { useMemo, useState } from "react";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";

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
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);

  const handlePick = (index: number, value: string) => {
    if (selected.includes(index)) return;

    onInteraction();
    const nextSelected = [...selected, index];
    const isCorrect = correctSet.has(value);
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextMistakes = mistakes + (isCorrect ? 0 : 1);

    setSelected(nextSelected);
    setCorrect(nextCorrect);
    setMistakes(nextMistakes);

    if (nextCorrect >= totalCorrect) {
      const score = Math.max(40, 100 - nextMistakes * 20);
      onComplete(score);
    }
  };

  return (
    <div className="mx-auto max-w-lg text-center">
      <p className="mb-4 text-sm text-muted-foreground">{effective.target}</p>
      <p className="mb-4 text-xs text-muted-foreground">Find {totalCorrect} correct item{totalCorrect === 1 ? "" : "s"}.</p>
      <div className="grid grid-cols-3 gap-3">
        {pool.map((item, index) => (
          <button
            key={`${item}-${index}`}
            onClick={() => handlePick(index, item)}
            className={`touch-target rounded-2xl border-2 p-5 text-4xl transition-colors ${
              selected.includes(index) ? "border-secondary bg-secondary/20" : "border-border bg-card hover:border-primary"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
