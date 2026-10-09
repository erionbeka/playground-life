import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CoreWordBar from "@/components/aac/CoreWordBar";
import { speak } from "@/lib/speech";

vi.mock("@/lib/speech", () => ({
  speak: vi.fn(),
  cancelSpeech: vi.fn(),
}));

function tapWord(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AAC core word bar", () => {
  it("renders every core word as an accessible button", () => {
    render(<CoreWordBar />);
    for (const label of ["I", "want", "more", "go", "stop", "help", "all done", "my turn", "please", "yes", "no", "look"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("builds a sentence strip as words are tapped and speaks each word", () => {
    render(<CoreWordBar />);
    tapWord("I");
    tapWord("want");
    expect(screen.getByTestId("aac-strip").textContent).toBe("I want");
    expect(speak).toHaveBeenNthCalledWith(1, "I");
    expect(speak).toHaveBeenNthCalledWith(2, "want");
  });

  it("speaks the whole message when Say it is pressed", () => {
    render(<CoreWordBar />);
    tapWord("I");
    tapWord("want");
    tapWord("go");
    fireEvent.click(screen.getByRole("button", { name: /say it/i }));
    expect(speak).toHaveBeenLastCalledWith("I want go");
  });

  it("removes the last word with backspace", () => {
    render(<CoreWordBar />);
    tapWord("more");
    tapWord("stop");
    fireEvent.click(screen.getByRole("button", { name: /remove last word/i }));
    expect(screen.getByTestId("aac-strip").textContent).toBe("more");
  });

  it("clears the message", () => {
    render(<CoreWordBar />);
    tapWord("help");
    fireEvent.click(screen.getByRole("button", { name: /clear message/i }));
    expect(screen.getByTestId("aac-strip").textContent).toBe("");
  });

  it("reports each word to the event log", () => {
    const onLog = vi.fn();
    render(<CoreWordBar onLog={onLog} />);
    tapWord("yes");
    expect(onLog).toHaveBeenCalledWith("aac_word", "yes");
  });
});
