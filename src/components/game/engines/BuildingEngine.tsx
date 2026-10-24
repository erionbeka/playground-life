import { useMemo, useState } from "react";
import { GameConfig } from "@/data/games";
import { getAdaptiveGameConfig } from "@/lib/gameProgression";
import LearningLabel from "../LearningLabel";
import RoundProgress from "../RoundProgress";
import { useGameAudio } from "../useGameAudio";

interface Props {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number) => void;
}

const buildPieces: Record<string, string[]> = {
  house: ["[]", "/\\", "[]", "||"],
  garden: ["[]", "[]", "o", "Y"],
  spaceship: ["[]", "/\\", "||", "*"],
  castle: ["[]", "[]", "[]", "^"],
  farm: ["[]", "Y", "o", "||"],
  city: ["[]", "[]", "=", "||"],
  "ocean scene": ["~", "><>", "o", "^"],
  forest: ["Y", "Y", "[]", "*"],
  "vehicle puzzle": ["o", "[]", "[]", "->"],
  hospital: ["[]", "+", "[]", "||"],
  "fire station": ["[]", "[]", "T", "||"],
  classroom: ["[]", "[]", "=", "A"],
  kitchen: ["[]", "[]", "o", "+"],
  default: ["[]", "/\\", "[]", "*"],
};

const pieceVisuals: Record<string, { emoji: string; label: string; bg: string }> = {
  "[]": { emoji: "🧱", label: "Wall Block", bg: "bg-amber-100 text-amber-900 border-amber-300" },
  "/\\": { emoji: "🏠", label: "Roof Peak", bg: "bg-rose-100 text-rose-900 border-rose-300" },
  "||": { emoji: "🪵", label: "Support Pillar", bg: "bg-yellow-100 text-yellow-900 border-yellow-300" },
  "o": { emoji: "⚪", label: "Round Stone", bg: "bg-slate-100 text-slate-900 border-slate-300" },
  "Y": { emoji: "🌲", label: "Tree", bg: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  "*": { emoji: "⭐", label: "Star Topper", bg: "bg-yellow-200 text-yellow-900 border-yellow-400" },
  "^": { emoji: "🏰", label: "Castle Spire", bg: "bg-purple-100 text-purple-900 border-purple-300" },
  "=": { emoji: "🪟", label: "Window Pane", bg: "bg-sky-100 text-sky-900 border-sky-300" },
  "<>": { emoji: "💎", label: "Gem", bg: "bg-cyan-100 text-cyan-900 border-cyan-300" },
  "+": { emoji: "🚪", label: "Door", bg: "bg-orange-100 text-orange-900 border-orange-300" },
  "A": { emoji: "📚", label: "Bookstack", bg: "bg-indigo-100 text-indigo-900 border-indigo-300" },
  "~": { emoji: "🌊", label: "Wave", bg: "bg-blue-100 text-blue-900 border-blue-300" },
  "><>": { emoji: "🐠", label: "Fish", bg: "bg-orange-200 text-orange-900 border-orange-400" },
  "X": { emoji: "🎨", label: "Tile", bg: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300" },
  "T": { emoji: "🪴", label: "Plant", bg: "bg-emerald-200 text-emerald-900 border-emerald-400" },
  "->": { emoji: "🚗", label: "Vehicle", bg: "bg-sky-200 text-sky-900 border-sky-400" },
};

interface ShapeBuildConfig {
  scene?: string;
  template?: string[];
  pieceOptions?: string[];
  objective?: string;
  modelLabel?: string;
  supportLevel?: "high" | "moderate" | "light";
}

export function getBuildTemplate(config: ShapeBuildConfig) {
  return config.template || buildPieces[String(config.scene || "default")] || buildPieces.default;
}

export function getBuildPieceOptions(config: ShapeBuildConfig, template: string[]) {
  const defaults = Array.from(new Set([...template, "[]", "/\\", "o", "=", "||", "*", "<>"]));
  return config.pieceOptions || defaults.slice(0, Math.max(defaults.length, template.length + 2));
}

export default function BuildingEngine({ game, onInteraction, onComplete }: Props) {
  const config = game.config as ShapeBuildConfig;
  const { difficulty, supportLevel, readinessStage } = getAdaptiveGameConfig(game);
  const template = useMemo(
    () => getBuildTemplate(config),
    [config]
  );
  const pieceOptions = useMemo(() => {
    const options = getBuildPieceOptions(config, template);
    if (supportLevel === "high") {
      return Array.from(new Set([...template.slice(0, Math.min(template.length, 2)), ...options])).slice(0, Math.max(4, template.length));
    }
    if (supportLevel === "light") {
      return Array.from(new Set([...options, "X", "T"]));
    }
    return options;
  }, [config, supportLevel, template]);

  const objective = config.objective || `Build the ${game.name.toLowerCase()}`;
  const modelLabel = config.modelLabel || game.name;
  const [placed, setPlaced] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const { playCelebrationSound } = useGameAudio();

  const nextExpected = template[placed.length];

  const handleSelectPiece = (piece: string) => {
    onInteraction();
    if (piece === nextExpected) {
      const nextPlaced = [...placed, piece];
      if (nextPlaced.length >= template.length) {
        playCelebrationSound();
        const score = Math.max(difficulty === "hard" ? 50 : 60, 100 - mistakes * (difficulty === "hard" ? 14 : 12));
        onComplete(score);
        return;
      }
      setPlaced(nextPlaced);
      return;
    }

    setMistakes((current) => current + 1);
  };

  return (
    <div className="mx-auto max-w-2xl px-2 sm:px-4 py-2">
      <div className="mb-4 flex items-center justify-between">
        <LearningLabel game={game} />
        <RoundProgress current={placed.length} total={template.length} />
      </div>

      <div className="mb-5 rounded-3xl bg-card border border-border p-5 text-center shadow-md">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Spatial Construction & Model Matching</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground">{objective}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Step {placed.length + 1} of {template.length} — Tap the matching block to build!
        </p>
      </div>

      {/* Model Blueprint Preview */}
      <div className="mb-6 rounded-3xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">📋 Blueprint Target: {modelLabel}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {template.map((piece, index) => {
            const visual = pieceVisuals[piece] || { emoji: "🧱", label: piece, bg: "bg-amber-100 text-amber-900 border-amber-300" };
            return (
              <div key={index} className="flex flex-col items-center">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-2xl shadow-sm ${visual.bg}`}>
                  {visual.emoji}
                </div>
                <span className="mt-1 text-[10px] font-bold text-muted-foreground">Part {index + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Construction Progress Slots */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {template.map((piece, index) => {
          const isFilled = index < placed.length;
          const isCurrent = index === placed.length;
          const visual = pieceVisuals[placed[index]] || pieceVisuals[piece] || { emoji: "🧱", label: piece, bg: "bg-amber-100 text-amber-900 border-amber-300" };

          return (
            <div
              key={`${piece}-${index}`}
              className={`rounded-3xl border-2 p-4 text-center transition-all ${
                isFilled
                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                  : isCurrent
                  ? "border-amber-400 bg-amber-50 animate-pulse shadow-md ring-4 ring-amber-200"
                  : "border-border bg-card/60 text-muted-foreground opacity-60"
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {isFilled ? "✓ Placed" : isCurrent ? "⭐ Build Here" : "Locked"}
              </p>
              <div className="my-2 flex h-16 items-center justify-center text-4xl">
                {isFilled || supportLevel === "high" || difficulty === "easy" ? visual.emoji : "❓"}
              </div>
              <p className="text-xs font-bold text-foreground">
                {isFilled ? visual.label : isCurrent ? "Active Step" : `Step ${index + 1}`}
              </p>
            </div>
          );
        })}
      </div>

      {/* Interactive Piece Selection Tray */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-lg">
        <p className="mb-3 text-sm font-bold text-foreground">Tap the correct building piece from your tray:</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {pieceOptions.map((piece, index) => {
            const visual = pieceVisuals[piece] || { emoji: "🧱", label: piece, bg: "bg-amber-100 text-amber-900 border-amber-300" };
            return (
              <button
                key={`${piece}-${index}`}
                onClick={() => handleSelectPiece(piece)}
                aria-label={`piece ${piece}`}
                className={`touch-target flex flex-col items-center justify-center rounded-3xl border-2 p-5 transition-all hover:scale-105 active:scale-95 shadow-sm ${visual.bg}`}
              >
                <span className="text-4xl mb-1">{visual.emoji}</span>
                <span className="text-xs font-extrabold">{visual.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Mistakes to correct: {mistakes}</span>
          <span className="font-semibold text-primary">Interactive block placement active</span>
        </div>
      </div>
    </div>
  );
}
