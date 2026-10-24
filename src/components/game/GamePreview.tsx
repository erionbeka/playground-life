import { useState } from "react";
import type { GameConfig } from "@/data/games";
import GameEngineView from "./GameEngineView";

export default function GamePreview({ game }: { game: GameConfig }) {
  const [rounds, setRounds] = useState(0);
  const props = {
    game,
    onInteraction: () => setRounds((value) => value + 1),
    onComplete: () => setRounds(0),
  };
  return (
    <div data-preview-rounds={rounds} data-preview-engine={game.engine}>
      <GameEngineView {...props} />
    </div>
  );
}
