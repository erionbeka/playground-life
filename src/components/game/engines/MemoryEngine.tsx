import { useEffect, useMemo, useState } from "react";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number) => void;
}

const memoryThemes: Record<string, string[]> = {
  faces: [":)", "B)", "<3", ":|", ":D"],
  objects: ["t", "o", "b", "p", "c"],
  words: ["CAT", "SUN", "TREE", "BALL", "BIRD"],
  sounds: ["n", "t", "b", "m", "v"],
  positions: ["U", "R", "D", "L", "C"],
  stories: ["B", "P", "R", "H", "S"],
  sequences: ["1", "2", "3", "4", "5"],
  colors: ["R", "B", "G", "Y", "P"],
  shapes: ["T", "S", "*", "O", "D"],
  animals: ["D", "C", "F", "R", "B"],
  default: ["*", "O", "#", "A", "H"],
};

export default function MemoryEngine({ game, onInteraction, onComplete }: Props) {
  const { difficulty, supportLevel, readinessStage } = getAdaptiveGameConfig(game);
  const theme = String(game.config.theme || "default");
  const items = useMemo(
    () => (Array.isArray(game.config.cardItems) ? (game.config.cardItems as string[]) : memoryThemes[theme] || memoryThemes.default),
    [game.config.cardItems, theme]
  );
  const itemCount = difficulty === "easy" || supportLevel === "high" ? 3 : difficulty === "medium" ? 4 : 5;
  const visibleItems = useMemo(() => items.slice(0, itemCount), [itemCount, items]);
  const answerIndex = difficulty === "hard" && supportLevel === "light" ? visibleItems.length - 1 : Math.min(2, visibleItems.length - 1);
  const answer = visibleItems[answerIndex];
  const [phase, setPhase] = useState<"show" | "quiz">("show");

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase("quiz"), supportLevel === "high" ? 2400 : supportLevel === "light" ? 1400 : 1800);
    return () => window.clearTimeout(timer);
  }, [supportLevel]);

  const handleSelect = (item: string) => {
    if (phase !== "quiz") return;
    onInteraction();
    onComplete(item === answer ? 100 : 50);
  };

  return (
    <div className="max-w-lg mx-auto text-center">
      <p className="mb-3 text-xs text-muted-foreground">Support: {supportLevel} · Stage: {readinessStage}</p>
      {phase === "show" ? (
        <div className="bg-muted rounded-2xl p-8">
          <p className="text-sm text-muted-foreground mb-4">Remember these items</p>
          <div className="flex justify-center gap-4 flex-wrap">
            {visibleItems.map((item) => (
              <span key={item} className="text-4xl">{item}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-muted rounded-2xl p-8">
          <p className="text-sm text-muted-foreground mb-4">
            Which item was {answerIndex + 1}{answerIndex === 0 ? "st" : answerIndex === 1 ? "nd" : answerIndex === 2 ? "rd" : "th"}?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {shuffleItems(visibleItems).map((item) => (
              <button key={item} onClick={() => handleSelect(item)} className="bg-card border-2 border-border rounded-xl p-4 text-3xl touch-target hover:border-primary transition-colors">
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
