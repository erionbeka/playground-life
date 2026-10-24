import { useMemo, useState } from "react";
import { activeGames, GameConfig } from "@/data/games";
import GameEngineView from "@/components/game/GameEngineView";
import InputModeProvider from "@/components/input/InputModeProvider";
import { useTargetRegion } from "@/components/input/context";
import { getGameAlignment } from "@/lib/alignment";

function initialGameId(): string {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("game");
  return activeGames.find((game) => game.id === requested)?.id || activeGames[0]?.id || "";
}

function GameEngineRegion({ game, onInteraction, onComplete }: { game: GameConfig; onInteraction: () => void; onComplete: (score: number) => void }) {
  const playRef = useTargetRegion("play", 20);
  return (
    <div data-input-target ref={playRef}>
      <GameEngineView
        game={game}
        onInteraction={onInteraction}
        onComplete={onComplete}
      />
    </div>
  );
}

export default function GameLab() {
  const [gameId, setGameId] = useState(initialGameId);
  const [interactions, setInteractions] = useState(0);
  const [completed, setCompleted] = useState<string | null>(null);
  const game = useMemo(() => activeGames.find((entry) => entry.id === gameId) || activeGames[0], [gameId]);

  const chooseGame = (next: GameConfig) => {
    setGameId(next.id);
    setInteractions(0);
    setCompleted(null);
    const url = new URL(window.location.href);
    url.searchParams.set("game", next.id);
    window.history.replaceState(null, "", url);
  };

  if (!game) return null;
  const alignment = getGameAlignment(game);
  const forceAccess = game.config.forceAccess;
  const modeOverride = forceAccess === "switch" || forceAccess === "dwell" ? forceAccess : undefined;

  return (
    <div className="min-h-screen bg-background p-4 text-foreground" data-testid="game-lab" data-lab-game={game.id}>
      <header className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Developer lab</p>
          <h1 className="truncate font-display text-xl font-bold">{game.id} · {game.name}</h1>
          <p className="text-xs text-muted-foreground">
            {game.engine} · {alignment.ablls.join(", ")} · AAC level {alignment.aac.matrixLevel}
          </p>
        </div>
        <select
          aria-label="Choose a game"
          value={game.id}
          onChange={(event) => {
            const next = activeGames.find((entry) => entry.id === event.target.value);
            if (next) chooseGame(next);
          }}
          className="max-w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          {activeGames.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.id} · {entry.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => chooseGame(activeGames[(activeGames.indexOf(game) + 1) % activeGames.length])}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold"
        >
          Next
        </button>
      </header>

      <main className="mx-auto max-w-3xl">
        <InputModeProvider modeOverride={modeOverride}>
          <GameEngineRegion
            game={game}
            onInteraction={() => setInteractions((value) => value + 1)}
            onComplete={(score) => setCompleted(`score ${score}`)}
          />
        </InputModeProvider>
      </main>

      <footer className="mx-auto mt-4 max-w-3xl text-xs text-muted-foreground">
        interactions: {interactions} · completed: {completed || "—"} · {game.archived ? "archived" : "active"}
      </footer>
    </div>
  );
}
