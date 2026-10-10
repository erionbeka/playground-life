import { useEffect, useMemo, useState } from "react";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number) => void;
}

export const SORT_ITEM_MAP: Record<string, string[]> = {
  farm: ["🐄", "🐑", "🐓", "🚜"],
  city: ["🏙️", "🚕", "🚦", "🏢"],
  hot: ["☀️", "🔥", "♨️", "🌶️"],
  cold: ["🧊", "❄️", "🥶", "⛄"],
  big: ["🐘", "🚌", "🏠", "🌳"],
  small: ["🐭", "🍓", "🔑", "🪙"],
  living: ["🌳", "🐶", "🦋", "🌻"],
  "non-living": ["🚗", "🪑", "⚽", "📘"],
  day: ["☀️", "🕶️", "🌤️", "🌼"],
  night: ["🌙", "⭐", "🛌", "🦉"],
  healthy: ["🍎", "🥕", "🥦", "💧"],
  unhealthy: ["🍩", "🍟", "🍬", "🥤"],
  land: ["🐘", "🚗", "🌳", "🏠"],
  water: ["🐠", "⛵", "🐳", "🪸"],
  loud: ["🥁", "📣", "🚨", "🦁"],
  quiet: ["🤫", "📚", "🌙", "🕊️"],
  soft: ["🧸", "☁️", "🧣", "🐇"],
  hard: ["🪨", "🔨", "🧱", "🥥"],
  fast: ["🚀", "🏎️", "🐆", "⚡"],
  slow: ["🐢", "🐌", "🕰️", "🚶"],
  indoor: ["🛋️", "🛏️", "📺", "🪴"],
  outdoor: ["🌳", "🛝", "⚽", "🌤️"],
  happy: ["😊", "😄", "🥳", "😁"],
  sad: ["😢", "☔", "😞", "💧"],
  sink: ["🪨", "🔑", "🧱", "🥄"],
  float: ["🛟", "🪵", "🎈", "🧽"],
  wild: ["🦁", "🐘", "🦊", "🐻"],
  domestic: ["🐶", "🐱", "🐔", "🐹"],
  fruits: ["🍎", "🍌", "🍓", "🍇"],
  vegetables: ["🥕", "🥦", "🌽", "🍅"],
  wet: ["💧", "🌊", "☔", "🫧"],
  dry: ["☀️", "🏜️", "🍂", "🧦"],
  toys: ["🧸", "🪁", "🎲", "🪀"],
  toyset: ["🧸", "🪁", "🎲", "🪀"],
  tools: ["🔨", "🪛", "🪚", "🧰"],
  sky: ["☁️", "🌈", "⭐", "🌤️"],
  sweets: ["🍬", "🍭", "🍫", "🍪"],
};

function normalizeCategory(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function createItems(normalizedCategories: string[], perCategory: number, authoredMap: Record<string, string[]>) {
  return shuffleItems(
    normalizedCategories.flatMap((category, categoryIndex) => {
      const authored = authoredMap[category] || [];
      const source = authored.length > 0 ? authored : SORT_ITEM_MAP[category] || ["⭐", "🎈", "🧩", "🎨"];
      return source.slice(0, perCategory).map((emoji) => ({ emoji, categoryIndex }));
    })
  );
}

export default function SortingEngine({ game, onInteraction, onComplete }: Props) {
  const authoredMap = useMemo(
    () => (game.config.itemsByCategory as Record<string, string[]> | undefined) ?? {},
    [game.config.itemsByCategory]
  );
  const authoredCategories = useMemo(() => Object.keys(authoredMap), [authoredMap]);
  const categories = useMemo(
    () =>
      authoredCategories.length > 0 ? authoredCategories : (game.config.categories as string[] | undefined) || ["Group A", "Group B"],
    [authoredCategories, game.config.categories]
  );
  const { supportLevel, readinessStage, personalized } = getAdaptiveGameConfig(game);
  const normalized = useMemo(() => categories.map(normalizeCategory), [categories]);
  const categoriesKey = normalized.join("|");
  const showToolHints = normalized.includes("toys") && normalized.includes("tools");
  const itemsPerCategory = personalized && supportLevel === "high" ? 2 : 4;
  const [items, setItems] = useState(() => createItems(normalized, itemsPerCategory, authoredMap));
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);

  useEffect(() => {
    setItems(createItems(normalized, itemsPerCategory, authoredMap));
    setIndex(0);
    setCorrect(0);
  }, [categoriesKey, itemsPerCategory, normalized, authoredMap]);

  const current = items[index];

  const handleChoice = (choice: number) => {
    if (!current) return;
    onInteraction();
    const nextCorrect = correct + (choice === current.categoryIndex ? 1 : 0);
    const nextIndex = index + 1;

    if (nextIndex >= items.length) {
      onComplete(Math.round((nextCorrect / items.length) * 100));
      return;
    }

    setCorrect(nextCorrect);
    setIndex(nextIndex);
  };

  if (!current) return null;

  return (
    <div className="max-w-lg mx-auto text-center">
      <p className="mb-3 text-sm text-muted-foreground">Sort item {index + 1} of {items.length}</p>
      <p className="mb-4 text-xs text-muted-foreground">Support: {supportLevel} · Stage: {readinessStage}</p>
      <div className="bg-muted rounded-2xl p-8 mb-4">
        <div className="text-7xl mb-5">{current.emoji}</div>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((label, categoryIndex) => (
            <button key={label} onClick={() => handleChoice(categoryIndex)} className="bg-card border-2 border-border rounded-xl p-4 font-semibold text-foreground touch-target hover:border-primary transition-colors">
              {label}
            </button>
          ))}
        </div>
        {showToolHints ? (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-semibold text-foreground">play things for fun</p>
            <p className="text-sm font-semibold text-foreground">work tools for building</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
