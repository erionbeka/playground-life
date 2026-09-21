import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LearningLabel from "@/components/game/LearningLabel";
import { getLearningPurpose, getLearningPurposeIcon } from "@/lib/gameProgression";
import { allGames } from "@/data/games";

describe("learning purpose helpers", () => {
  it("returns a non-empty literal purpose for every catalog game", () => {
    for (const game of allGames) {
      const purpose = getLearningPurpose(game);
      expect(purpose.length).toBeGreaterThan(8);
      expect(purpose).toMatch(/learn|practice|what|notice|follow|match|sort/i);
      expect(purpose).not.toMatch(/\b(piece of cake|break a leg|raining cats and dogs|in the zone|hit the nail|back to the drawing board)\b/i);
    }
  });

  it("every purpose has an icon", () => {
    for (const game of allGames) expect(getLearningPurposeIcon(game).length).toBeGreaterThan(0);
  });
});

describe("LearningLabel", () => {
  it("renders purpose caption in front of gameplay", () => {
    const game = allGames[0];
    render(<LearningLabel game={game} />);
    expect(screen.getByText(/what we learn|what we practice/i)).toBeTruthy();
  });
});
