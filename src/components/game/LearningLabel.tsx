import { GameConfig } from "@/data/games";
import { getLearningPurpose, getLearningPurposeIcon } from "@/lib/gameProgression";

interface Props { game: GameConfig; className?: string; }
export default function LearningLabel({ game, className = "" }: Props) {
  return (
    <p
      data-testid="learning-label"
      className={`mb-2 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold text-primary ${className}`}
    >
      <span aria-hidden="true">{getLearningPurposeIcon(game)}</span>
      <span>{getLearningPurpose(game)}</span>
    </p>
  );
}
