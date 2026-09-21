import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GuideCompanion from "@/components/game/GuideCompanion";
import { COMPANION, companionGreeting, companionProud, companionReady } from "@/lib/companion";

afterEach(cleanup);

describe("companion guide (Pip)", () => {
  it("defines a single companion identity named Pip", () => {
    expect(COMPANION.name).toBe("Pip");
    expect(COMPANION.emoji).toBe("🦊");
  });

  it("greets the child by name", () => {
    expect(companionGreeting("Emma")).toContain("Emma");
    expect(companionGreeting("Emma")).toContain("Pip");
    expect(companionReady("Emma")).toContain("Emma");
  });

  it("renders the fox avatar with a passed-in message", () => {
    render(<GuideCompanion message="Ready when you are, Emma!" />);
    expect(screen.getByText(/🦊/)).toBeTruthy();
    expect(screen.getByText(/Ready when you are, Emma!/i)).toBeTruthy();
  });

  it("falls back to a Pip greeting when no message is given", () => {
    render(<GuideCompanion />);
    expect(screen.getByText(/🦊/)).toBeTruthy();
    expect(screen.getByText(/Pip/i)).toBeTruthy();
  });

  it("provides a celebration line that credits Pip", () => {
    expect(companionProud()).toContain("Pip");
  });
});