import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RealWorldExtension from "@/components/game/RealWorldExtension";

describe("real-world extension", () => {
  it("shows the caregiver prompt prominently, with an optional metric", () => {
    render(<RealWorldExtension prompt="Offer two real objects and take turns." metric="Independent matches" />);
    expect(screen.getByTestId("real-world-extension")).toBeInTheDocument();
    expect(screen.getByText(/take it into the real world/i)).toBeInTheDocument();
    expect(screen.getByText("Offer two real objects and take turns.")).toBeInTheDocument();
    expect(screen.getByText(/independent matches/i)).toBeInTheDocument();
  });
});
