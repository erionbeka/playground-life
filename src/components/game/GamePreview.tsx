import { useState } from "react";
import type { GameConfig } from "@/data/games";
import MatchingEngine from "./engines/MatchingEngine";
import SortingEngine from "./engines/SortingEngine";
import RecognitionEngine from "./engines/RecognitionEngine";
import MemoryEngine from "./engines/MemoryEngine";
import ChoiceRequestEngine from "./engines/ChoiceRequestEngine";
import OddOneOutEngine from "./engines/OddOneOutEngine";

export default function GamePreview({ game }: { game: GameConfig }) {
  const [rounds, setRounds] = useState(0);
  const props = {
    game,
    onInteraction: () => setRounds((value) => value + 1),
    onComplete: () => setRounds(0),
  };
  switch (game.engine) {
    case "matching":
      return <MatchingEngine {...props} />;
    case "sorting":
      return <SortingEngine {...props} />;
    case "recognition":
      return <RecognitionEngine {...props} />;
    case "memory":
      return <MemoryEngine {...props} />;
    case "choice-request":
      return <ChoiceRequestEngine {...props} />;
    case "odd-one-out":
      return <OddOneOutEngine {...props} />;
    default:
      return <p className="text-sm text-muted-foreground">Preview not available for {game.engine}.</p>;
  }
}
