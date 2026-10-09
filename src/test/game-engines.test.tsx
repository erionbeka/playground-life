import { ComponentType } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allGames, GameConfig } from "@/data/games";
import { shuffleItems } from "@/lib/shuffle";
import PlaygroundEngine from "@/components/game/engines/PlaygroundEngine";
import MatchingEngine from "@/components/game/engines/MatchingEngine";
import SequenceEngine from "@/components/game/engines/SequenceEngine";
import SortingEngine from "@/components/game/engines/SortingEngine";
import TappingEngine from "@/components/game/engines/TappingEngine";
import SocialEngine from "@/components/game/engines/SocialEngine";
import RecognitionEngine from "@/components/game/engines/RecognitionEngine";
import CountingEngine from "@/components/game/engines/CountingEngine";
import MemoryEngine from "@/components/game/engines/MemoryEngine";
import BuildingEngine, { getBuildTemplate } from "@/components/game/engines/BuildingEngine";
import ChoiceRequestEngine from "@/components/game/engines/ChoiceRequestEngine";
import RegulationEngine from "@/components/game/engines/RegulationEngine";
import FlexibleThinkingEngine from "@/components/game/engines/FlexibleThinkingEngine";
import MagicToysEngine from "@/components/game/engines/MagicToysEngine";
import PatternNextEngine from "@/components/game/engines/PatternNextEngine";
import OddOneOutEngine from "@/components/game/engines/OddOneOutEngine";

interface GameEngineProps {
  game: GameConfig;
  onInteraction: () => void;
  onComplete: (score: number) => void;
}

const engineComponents: Record<string, ComponentType<GameEngineProps>> = {
  sandbox: PlaygroundEngine,
  slide: PlaygroundEngine,
  bench: PlaygroundEngine,
  matching: MatchingEngine,
  sequence: SequenceEngine,
  sorting: SortingEngine,
  tapping: TappingEngine,
  social: SocialEngine,
  building: BuildingEngine,
  recognition: RecognitionEngine,
  counting: CountingEngine,
  memory: MemoryEngine,
  "choice-request": ChoiceRequestEngine,
  regulation: RegulationEngine,
  flexible: FlexibleThinkingEngine,
  "magic-toys": MagicToysEngine,
  "pattern-next": PatternNextEngine,
  "odd-one-out": OddOneOutEngine,
};

const recognitionTargets: Record<string, string[]> = {
  "red things": ["🍎", "🚗", "🍓", "🌹"],
  "blue things": ["🫐", "🐟", "🔵"],
  "round objects": ["⚽", "🟡", "🍪"],
  "square objects": ["🟦", "⬜", "📦"],
  "learn animals": ["🐶", "🐱", "🐸", "🐰"],
  "learn emotions": ["😊", "😮", "😢", "😡"],
  "learn colors": ["🔴", "🔵", "🟢"],
  "learn shapes": ["🔺", "🟦", "⭐"],
  default: ["⭐"],
};

const sortingItemMap: Record<string, string[]> = {
  farm: ["🐄", "🐑", "🐓", "🚜"],
  city: ["🏙️", "🚕", "🚦", "🏢"],
};

function normalizeCategory(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function renderGame(game: GameConfig, onComplete = vi.fn()) {
  const Engine = engineComponents[game.engine];
  const utils = render(<Engine game={game} onInteraction={vi.fn()} onComplete={onComplete} />);
  return { ...utils, onComplete };
}

async function playGame(game: GameConfig, onComplete: ReturnType<typeof vi.fn>, container: HTMLElement) {
  switch (game.engine) {
    case "sandbox":
    case "slide":
    case "bench": {
      let safety = 0;
      while (!onComplete.mock.calls.length && safety < 12) {
        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[buttons.length - 1]);
        safety += 1;
      }
      break;
    }
    case "building": {
      const template = getBuildTemplate(game.config as { scene?: string; template?: string[] });
      for (const piece of template) {
        fireEvent.click(screen.getByRole("button", { name: `piece ${piece}` }));
      }
      break;
    }
    case "matching": {
      if (String(game.config.matchStyle || game.config.variant) === "category") {
        let safety = 0;
        while (!onComplete.mock.calls.length && safety < 200) {
          const card = screen.queryByRole("button", { name: /card$/i });
          if (card) fireEvent.click(card);
          const bins = screen.queryAllByRole("button", { name: /category$/i });
          for (const bin of bins) {
            if (onComplete.mock.calls.length) break;
            fireEvent.click(bin);
            await advance(20);
          }
          await advance(50);
          safety += 1;
        }
        break;
      }
      let safety = 0;
      while (!onComplete.mock.calls.length && safety < 200) {
        const groups = new Map<string, HTMLButtonElement[]>();
        const buttons = Array.from(container.querySelectorAll("button")) as HTMLButtonElement[];
        for (const button of buttons) {
          if (button.disabled) continue;
          const label = button.getAttribute("aria-label") || button.textContent || "";
          groups.set(label, [...(groups.get(label) || []), button]);
        }
        let progressed = false;
        for (const group of groups.values()) {
          if (onComplete.mock.calls.length) break;
          if (group.length >= 2) {
            fireEvent.click(group[0]);
            fireEvent.click(group[1]);
            progressed = true;
            await advance(600);
          }
        }
        if (!progressed) await advance(600);
        safety += 1;
      }
      break;
    }
    case "sequence": {
      const length = Number(game.config.length || game.config.steps || 4);
      let buttons = screen.queryAllByRole("button");
      let safety = 0;
      while (buttons.length === 0 && safety < 12) {
        await advance(700);
        buttons = screen.queryAllByRole("button");
        safety += 1;
      }
      expect(buttons.length).toBeGreaterThan(0);
      for (let index = 0; index < length; index += 1) {
        fireEvent.click(buttons[index % buttons.length]);
      }
      break;
    }
    case "sorting": {
      let safety = 0;
      while (!onComplete.mock.calls.length && safety < 16) {
        fireEvent.click(screen.getAllByRole("button")[0]);
        safety += 1;
      }
      break;
    }
    case "tapping": {
      await advance(31000);
      break;
    }
    case "social": {
      let safety = 0;
      while (!onComplete.mock.calls.length && safety < 8) {
        fireEvent.click(screen.getAllByRole("button")[0]);
        await advance(1600);
        safety += 1;
      }
      break;
    }
    case "recognition": {
      for (const button of screen.getAllByRole("button")) {
        if (onComplete.mock.calls.length) break;
        fireEvent.click(button);
      }
      break;
    }
    case "counting": {
      fireEvent.click(screen.getAllByRole("button")[0]);
      await advance(600);
      break;
    }
    case "memory": {
      await advance(2000);
      fireEvent.click(screen.getAllByRole("button")[0]);
      break;
    }
    case "choice-request": {
      let safety = 0;
      while (!onComplete.mock.calls.length && safety < 16) {
        const buttons = screen.queryAllByRole("button");
        if (buttons.length === 0) break;
        fireEvent.click(buttons[buttons.length - 1]);
        await advance(2000);
        safety += 1;
      }
      break;
    }
    case "regulation":
    case "flexible": {
      let safety = 0;
      while (!onComplete.mock.calls.length && safety < 24) {
        const buttons = screen.queryAllByRole("button");
        if (buttons.length === 0) break;
        fireEvent.click(buttons[buttons.length - 1]);
        await advance(400);
        safety += 1;
      }
      break;
    }
    case "magic-toys":
    case "pattern-next":
    case "odd-one-out": {
      let safety = 0;
      while (!onComplete.mock.calls.length && safety < 60) {
        const buttons = screen.queryAllByRole("button");
        if (buttons.length === 0) {
          await advance(200);
          safety += 1;
          continue;
        }
        for (const button of buttons) {
          if (onComplete.mock.calls.length) break;
          fireEvent.click(button);
          await advance(150);
        }
        await advance(500);
        safety += 1;
      }
      break;
    }
    default:
      throw new Error(`Unhandled engine ${game.engine}`);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("game engine smoke coverage", () => {
  for (const game of allGames) {
    it(`completes ${game.id} ${game.name}`, async () => {
      const { container, onComplete } = renderGame(game);
      await playGame(game, onComplete, container);
      expect(onComplete).toHaveBeenCalled();
    });
  }
});

describe("regressions", () => {
  it("recognition games complete after finding only the intended answers", () => {
    const game: GameConfig = {
      id: "recognition-round",
      name: "Round Objects",
      emoji: "o",
      category: "colors-shapes",
      engine: "recognition",
      description: "",
      skills: [],
      difficulty: "easy",
      estimatedMinutes: 1,
      supportsShared: false,
      supportsMultiplayer: false,
      config: { theme: "round objects" },
    };

    const onComplete = vi.fn();
    renderGame(game, onComplete);

    for (const token of recognitionTargets["round objects"]) {
      fireEvent.click(screen.getByRole("button", { name: token }));
    }

    expect(onComplete).toHaveBeenCalledWith(100);
  });

  it("sorting keeps a stable deck order while the player advances", () => {
    const game: GameConfig = {
      id: "sorting-stable",
      name: "Sort Farm vs City",
      emoji: "o",
      category: "sorting",
      engine: "sorting",
      description: "",
      skills: [],
      difficulty: "easy",
      estimatedMinutes: 1,
      supportsShared: false,
      supportsMultiplayer: false,
      config: { categories: ["Farm", "City"] },
    };

    const expected = shuffleItems(
      ["farm", "city"].flatMap((category) => sortingItemMap[category])
    );
    const onComplete = vi.fn();
    renderGame(game, onComplete);

    for (const emoji of expected) {
      expect(screen.getByText(emoji)).toBeInTheDocument();
      fireEvent.click(screen.getAllByRole("button", { name: /Farm|City/ })[0]);
    }

    expect(onComplete).toHaveBeenCalled();
  });

  it("tapping games spawn visible targets before the countdown ends", async () => {
    const game: GameConfig = {
      id: "tap-bubbles",
      name: "Tap Bubbles",
      emoji: "👆",
      category: "motor-skills",
      engine: "tapping",
      description: "",
      skills: [],
      difficulty: "easy",
      estimatedMinutes: 1,
      supportsShared: false,
      supportsMultiplayer: false,
      config: { theme: "bubbles", speed: "medium" },
    };

    renderGame(game);

    await advance(50);

    expect(screen.getAllByRole("button", { name: "bubbles target" }).length).toBeGreaterThan(0);
  });

  it("building shape games require the next correct piece", () => {
    const game: GameConfig = {
      id: "shape-build",
      name: "Build a Triangle",
      emoji: "[]",
      category: "building",
      engine: "building",
      description: "",
      skills: [],
      difficulty: "easy",
      estimatedMinutes: 1,
      supportsShared: true,
      supportsMultiplayer: false,
      config: { template: ["/\\", "[]", "/\\"], pieceOptions: ["/\\", "[]", "o"] },
    };

    const onComplete = vi.fn();
    renderGame(game, onComplete);

    fireEvent.click(screen.getByRole("button", { name: "piece o" }));
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "piece /\\" }));
    fireEvent.click(screen.getByRole("button", { name: "piece []" }));
    fireEvent.click(screen.getByRole("button", { name: "piece /\\" }));

    expect(onComplete).toHaveBeenCalled();
  });
});
