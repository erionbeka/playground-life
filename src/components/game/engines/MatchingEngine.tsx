import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number) => void;
}

const emojiSets: Record<string, string[]> = {
  animals: ["🐶", "🐱", "🐰", "🐸", "🦊", "🐼", "🐨", "🦁"],
  food: ["🍎", "🍌", "🍕", "🍦", "🧁", "🍩", "🥕", "🍇"],
  vehicles: ["🚗", "🚌", "🚀", "✈️", "🚂", "🏍️", "🚲", "⛵"],
  emotions: ["😊", "😢", "😮", "😡", "🥰", "😴", "🤩", "😂"],
  nature: ["🌸", "🌻", "🌲", "🍂", "🌈", "⭐", "🌙", "☀️"],
  colors: ["🔴", "🔵", "🟢", "🟡", "🟣", "🟠", "⬛", "⬜"],
  letters: ["A", "B", "C", "D", "E", "F", "G", "H"],
  numbers: ["1", "2", "3", "4", "5", "6", "7", "8"],
  shapes: ["T", "S", "O", "D", "R", "H", "P", "C"],
  tools: ["Hammer", "Saw", "Wrench", "Brush", "Ruler", "Key", "Tape", "Nail"],
  textures: ["Soft", "Rough", "Smooth", "Bumpy", "Fuzzy", "Hard", "Wet", "Dry"],
  seasons: ["Spring", "Summer", "Fall", "Winter", "Rain", "Sun", "Snow", "Wind"],
  "body parts": ["Eye", "Ear", "Hand", "Foot", "Nose", "Mouth", "Arm", "Leg"],
  music: ["🎸", "🎹", "🎻", "🥁", "🎤", "🎧", "🎵", "🎼"],
  clothes: ["👕", "👖", "🧢", "🧤", "🧦", "👗", "👟", "🧥"],
  default: ["🔴", "🔵", "🟢", "🟡", "🟣", "🟠", "⬛", "⬜"],
};

type PairVariant = "open" | "flip" | "shadow";

interface PairCard {
  id: number;
  label: string;
  pairId: number;
  flipped: boolean;
  matched: boolean;
  role: "reference" | "shadow";
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  let state = seed >>> 0;

  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function buildPairDeck(labels: string[], seed: number | undefined): PairCard[] {
  const doubled = [...labels, ...labels].map((label, index) => ({
    id: index,
    label,
    pairId: index % labels.length,
    flipped: false,
    matched: false,
    role: (index < labels.length ? "reference" : "shadow") as "reference" | "shadow",
  }));

  return seed === undefined ? shuffleItems(doubled) : seededShuffle(doubled, seed);
}

function PairBoard({ game, onInteraction, onComplete, variant }: Props & { variant: PairVariant }) {
  const pairs = typeof game.config.pairs === "number" ? (game.config.pairs as number) : 4;
  const theme = String(game.config.theme || "default");
  const emojis = emojiSets[theme] || emojiSets.default;
  const pairList = game.config.pairList;
  const authorPairList = Array.isArray(pairList) ? (pairList as string[]) : [];
  const totalPairs = authorPairList.length > 0 ? authorPairList.length : pairs;
  const seed = typeof game.config.shuffleSeed === "number" ? (game.config.shuffleSeed as number) : undefined;
  const cardsVisible = typeof game.config.cardsVisible === "number" ? (game.config.cardsVisible as number) : undefined;

  const [cards, setCards] = useState<PairCard[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [resolving, setResolving] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    const authorList = Array.isArray(pairList) ? (pairList as string[]) : [];
    const labels = authorList.length > 0 ? authorList : emojis.slice(0, pairs);
    const deck = buildPairDeck(labels, seed);
    const visible = variant === "shadow" || cardsVisible === undefined ? deck : deck.slice(0, cardsVisible);

    setCards(visible);
    setSelected([]);
    setMoves(0);
    setMatchedCount(0);
    setResolving(false);
    completedRef.current = false;
  }, [pairList, emojis, pairs, seed, cardsVisible, variant]);

  const handleTap = (index: number) => {
    if (resolving || selected.length >= 2) return;

    const card = cards[index];
    if (!card || card.flipped || card.matched) return;

    onInteraction();
    const nextCards = cards.map((entry, entryIndex) => (entryIndex === index ? { ...entry, flipped: true } : entry));
    const nextSelected = [...selected, index];

    setCards(nextCards);
    setSelected(nextSelected);

    if (nextSelected.length !== 2) return;

    setResolving(true);
    setMoves((currentMoves) => currentMoves + 1);

    const [firstIndex, secondIndex] = nextSelected;
    const isMatch = nextCards[firstIndex].pairId === nextCards[secondIndex].pairId;

    if (isMatch) {
      window.setTimeout(() => {
        setCards((currentCards) =>
          currentCards.map((entry, entryIndex) =>
            entryIndex === firstIndex || entryIndex === secondIndex ? { ...entry, matched: true } : entry
          )
        );
        setMatchedCount((currentMatchedCount) => {
          const updatedMatchedCount = currentMatchedCount + 1;
          if (updatedMatchedCount >= totalPairs && !completedRef.current) {
            completedRef.current = true;
            const score = Math.max(20, 100 - Math.max(0, moves + 1 - totalPairs) * 5);
            onComplete(Math.min(100, score));
          }
          return updatedMatchedCount;
        });
        setSelected([]);
        setResolving(false);
      }, 500);
      return;
    }

    window.setTimeout(() => {
      setCards((currentCards) =>
        currentCards.map((entry, entryIndex) =>
          entryIndex === firstIndex || entryIndex === secondIndex ? { ...entry, flipped: false } : entry
        )
      );
      setSelected([]);
      setResolving(false);
    }, 800);
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 text-center">
        {variant === "flip" ? (
          <p className="text-sm text-muted-foreground">
            Matched {matchedCount} of {totalPairs} pairs
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Matched: {matchedCount}/{totalPairs} · Moves: {moves}
          </p>
        )}
      </div>

      <div style={{ gridTemplateColumns: "repeat(4, 1fr)" }} className="grid gap-3">
        {cards.map((card, index) => (
          <motion.button
            key={card.id}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => handleTap(index)}
            disabled={resolving}
            aria-label={`${card.label} card`}
            className={`touch-target flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 text-3xl transition-all ${
              card.matched
                ? "border-secondary bg-secondary/30"
                : card.flipped
                  ? "border-primary bg-card shadow-lg"
                  : "border-border bg-primary/10"
            } ${variant === "shadow" && card.role === "shadow" ? "opacity-70" : ""}`}
          >
            {variant === "shadow" ? (
              <>
                <span className="text-4xl" aria-hidden="true">
                  {card.label}
                </span>
                <span
                  className={
                    card.role === "reference"
                      ? "text-xs font-black uppercase tracking-wide text-foreground"
                      : "text-xs font-black uppercase tracking-wide sr-only"
                  }
                >
                  {card.label}
                </span>
              </>
            ) : card.flipped || card.matched ? (
              card.label
            ) : (
              "❓"
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

interface CategoryItem {
  label: string;
  category: string;
}

function CategoryBoard({ game, onInteraction, onComplete }: Props) {
  const categories = Array.isArray(game.config.categories) ? (game.config.categories as string[]) : [];
  const categoryItems = (game.config.categoryItems as Record<string, string[]> | undefined) || {};
  const items: CategoryItem[] = categories.flatMap((category) =>
    (categoryItems[category] || []).map((label) => ({ label, category }))
  );
  const total = items.length;
  const cardsVisible = typeof game.config.cardsVisible === "number" ? (game.config.cardsVisible as number) : 1;

  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [resolving, setResolving] = useState(false);
  const completedRef = useRef(false);

  const handleItem = (label: string) => {
    if (resolving || placed.includes(label)) return;
    onInteraction();
    setSelectedItem(label);
    setStatus("idle");
  };

  const handleCategory = (category: string) => {
    if (resolving || !selectedItem) return;

    const item = items.find((entry) => entry.label === selectedItem);
    if (!item) return;

    onInteraction();

    if (item.category === category) {
      setResolving(true);
      const updatedPlaced = [...placed, item.label];
      setPlaced(updatedPlaced);
      setStatus("correct");
      if (updatedPlaced.length >= total && !completedRef.current) {
        completedRef.current = true;
        onComplete(100);
      }
      window.setTimeout(() => {
        setSelectedItem(null);
        setStatus("idle");
        setResolving(false);
      }, 600);
    } else {
      setStatus("wrong");
      window.setTimeout(() => setStatus("idle"), 300);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex flex-wrap justify-center gap-3">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            aria-label={`${category} category`}
            onClick={() => handleCategory(category)}
            disabled={resolving}
            className={`touch-target rounded-2xl border-2 px-6 py-4 text-lg font-bold transition-all ${
              status === "correct" && selectedItem && items.find((entry) => entry.label === selectedItem)?.category === category
                ? "border-primary bg-primary/30"
                : "border-border bg-primary/10"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div style={{ gridTemplateColumns: "repeat(3, 1fr)" }} className="grid gap-3">
        {items
          .filter((item) => !placed.includes(item.label))
          .slice(0, cardsVisible)
          .map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={`${item.label} card`}
              onClick={() => handleItem(item.label)}
              disabled={resolving}
              className={`touch-target flex aspect-square items-center justify-center rounded-2xl border-2 text-2xl transition-all ${
                selectedItem === item.label ? "border-primary bg-card shadow-lg" : "border-border bg-primary/10"
              }`}
            >
              {item.label}
            </button>
          ))}
      </div>
    </div>
  );
}

export default function MatchingEngine(props: Props) {
  const variant = String(props.game.config.variant || "open");

  if (props.game.config.matchStyle === "category") {
    return <CategoryBoard {...props} />;
  }

  if (variant === "flip") {
    return <PairBoard {...props} variant="flip" />;
  }

  if (variant === "shadow") {
    return <PairBoard {...props} variant="shadow" />;
  }

  return <PairBoard {...props} variant="open" />;
}
