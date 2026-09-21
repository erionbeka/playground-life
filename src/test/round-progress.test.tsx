import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RoundProgress from "@/components/game/RoundProgress";

afterEach(cleanup);

describe("RoundProgress", () => {
  it("renders an accessible step counter", () => {
    render(<RoundProgress current={0} total={4} />);
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  });

  it("clamps current beyond total to the total", () => {
    render(<RoundProgress current={9} total={4} />);
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
  });

  it("uses a polite live region", () => {
    const { container } = render(<RoundProgress current={0} total={3} />);
    expect(container.querySelector("[aria-live=polite]")).toBeTruthy();
  });

  it("renders the end-of-round counter", () => {
    render(<RoundProgress current={2} total={3} />);
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
  });

  it("handles a zero total without dividing by zero", () => {
    render(<RoundProgress current={0} total={0} />);
    expect(screen.getByText("Step 1 of 0")).toBeTruthy();
  });
});