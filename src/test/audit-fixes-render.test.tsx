import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SortingEngine, { SORT_ITEM_MAP } from "@/components/game/engines/SortingEngine";
import MagicToysEngine from "@/components/game/engines/MagicToysEngine";
import MatchingEngine from "@/components/game/engines/MatchingEngine";
import { allGames } from "@/data/games";

afterEach(cleanup);

const FALLBACK = ["⭐", "🎈", "🧩", "🎨"];

function catalogGame(name: string) {
  const game = allGames.find((candidate) => candidate.name === name);
  if (!game) throw new Error(`catalog game not found: ${name}`);
  return game;
}

function collectSortedEmoji(name: string, groupMaps: Array<[string, string[]]>) {
  render(<SortingEngine game={catalogGame(name)} onInteraction={vi.fn()} onComplete={vi.fn()} />);
  const seen: string[] = [];
  for (let index = 0; index < 4 * groupMaps.length; index += 1) {
    const emoji = document.querySelector("div.text-7xl")?.textContent || "";
    seen.push(emoji);
    const binLabel = groupMaps.find(([, items]) => (items || []).includes(emoji))?.[0] ?? groupMaps[0][0];
    const bin = screen.getByRole("button", { name: new RegExp(`^${binLabel}`) });
    fireEvent.click(bin);
  }
  return seen;
}

describe("sorting engine item coverage", () => {
  it("Sort Wet vs Dry drives 8 real wet/dry items with no fallback", () => {
    const seen = collectSortedEmoji("Sort Wet vs Dry", [
      ["Wet", SORT_ITEM_MAP.wet || []],
      ["Dry", SORT_ITEM_MAP.dry],
    ]);
    expect([...seen].sort()).toEqual([...(SORT_ITEM_MAP.wet || []), ...SORT_ITEM_MAP.dry].sort());
    for (const emoji of seen) expect(FALLBACK).not.toContain(emoji);
  });

  it("Sort Toys vs Tools drives 8 real toy/tool items with no fallback and visible hints", () => {
    const seen = collectSortedEmoji("Sort Toys vs Tools", [
      ["Toys", SORT_ITEM_MAP.toyset],
      ["Tools", SORT_ITEM_MAP.tools || []],
    ]);
    expect([...seen].sort()).toEqual([...(SORT_ITEM_MAP.toys || []), ...(SORT_ITEM_MAP.tools || [])].sort());
    for (const emoji of seen) expect(FALLBACK).not.toContain(emoji);
    expect(screen.getByText("play things for fun")).toBeTruthy();
    expect(screen.getByText("work tools for building")).toBeTruthy();
  });
});

describe("magic-toys themed sets", () => {
  it("Forest Magic uses forest items, not the default set", () => {
    render(<MagicToysEngine game={catalogGame("Forest Magic")} onInteraction={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText("🌲")).toBeTruthy();
    expect(screen.getByText("🍄")).toBeTruthy();
    expect(screen.queryByText("⭐")).toBeNull();
  });

  it("Dinosaur Magic uses dino items, not the default set", () => {
    render(<MagicToysEngine game={catalogGame("Dinosaur Magic")} onInteraction={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText("🦖")).toBeTruthy();
    expect(screen.getByText("🦕")).toBeTruthy();
    expect(screen.queryByText("🎉")).toBeNull();
  });
});

describe("magic-toys find-the-X trials", () => {
  it("treasures only the prompted toy; wrong taps are misses", () => {
    const onComplete = vi.fn();
    render(<MagicToysEngine game={catalogGame("Forest Magic")} onInteraction={vi.fn()} onComplete={onComplete} />);

    // Prompted toy is toys[remaining[0]] => index 0 (🌲). Tap index 1 first: miss.
    fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[1]);
    expect(screen.getByText(/found 0 of 6/i)).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    // Tap prompted toy: found.
    fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[0]);
    expect(screen.getByText(/found 1 of 6/i)).toBeTruthy();

    // Finish: tap remaining toys in order.
    for (let index = 1; index < 6; index += 1) {
      fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[index]);
    }
    expect(onComplete).toHaveBeenCalled();
  });

  it("reports real errors for wrong taps in completion metrics", () => {
    const onComplete = vi.fn();
    render(<MagicToysEngine game={catalogGame("Forest Magic")} onInteraction={vi.fn()} onComplete={onComplete} />);

    fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[1]); // wrong
    fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[0]); // correct (🌲)
    for (let index = 1; index < 6; index += 1) {
      fireEvent.click(screen.getAllByRole("button", { name: /magic toy/i })[index]);
    }

    expect(onComplete).toHaveBeenCalled();
    const metrics = onComplete.mock.calls[0][2] as { errors?: number; correctTrials?: number };
    expect(metrics.errors).toBeGreaterThanOrEqual(1);
    expect(metrics.correctTrials).toBe(6);
  });
});

describe("matching silhouette hides readable labels", () => {
  it("shadow cards expose the item label only via sr-only, never as visible text", () => {
    render(<MatchingEngine game={catalogGame("Froebel Shadow Forms")} onInteraction={vi.fn()} onComplete={vi.fn()} />);

    const cardButtons = screen.getAllByRole("button", { name: /card$/i });
    const visibleLabels = document.querySelectorAll("span.text-xs.font-black.uppercase.tracking-wide.text-foreground");
    const hiddenLabels = document.querySelectorAll("span.text-xs.font-black.uppercase.tracking-wide.sr-only");

    expect(cardButtons.length).toBeGreaterThan(0);
    // each pair keeps exactly one reference card with a readable label...
    expect(visibleLabels.length).toBe(cardButtons.length / 2);
    // ...and its shadow match labels the picture only for screen readers.
    expect(hiddenLabels.length).toBe(cardButtons.length / 2);
  });
});