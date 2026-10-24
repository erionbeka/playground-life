import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BlobCritter from "@/components/home/BlobCritter";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches,
      media: "",
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("blob critter arms", () => {
  it("renders a left arm and a right arm with a hand on each when reaching", () => {
    mockMatchMedia(false);

    render(<BlobCritter shape="cat" color="#4daace" size={210} reach />);

    expect(screen.getByTestId("blob-arm-left")).toBeInTheDocument();
    expect(screen.getByTestId("blob-arm-right")).toBeInTheDocument();
    expect(screen.getByTestId("blob-hand-left")).toBeInTheDocument();
    expect(screen.getByTestId("blob-hand-right")).toBeInTheDocument();
  });

  it("renders no arms when reaching is off", () => {
    mockMatchMedia(false);

    render(<BlobCritter shape="cat" color="#4daace" size={110} />);

    expect(screen.queryByTestId("blob-arm-left")).toBeNull();
    expect(screen.queryByTestId("blob-arm-right")).toBeNull();
  });

  it("renders no arms when the OS prefers reduced motion", () => {
    mockMatchMedia(true);

    render(<BlobCritter shape="cat" color="#4daace" size={210} reach />);

    expect(screen.queryByTestId("blob-arm-left")).toBeNull();
    expect(screen.queryByTestId("blob-arm-right")).toBeNull();
  });
});

function armRotation(testId: string) {
  const transform = screen.getByTestId(testId).getAttribute("style") ?? "";
  const match = /rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(transform);
  if (!match) throw new Error(`no rotate() in "${transform}"`);
  return Number(match[1]);
}

/** Waits for the arm spring to come to rest, then returns its rotation. */
async function settledRotation(testId: string) {
  const startedAt = Date.now();
  let last = Number.NaN;
  let stable = 0;

  await waitFor(
    () => {
      const angle = armRotation(testId);
      // The springs take a moment to start moving, so only start looking for
      // a settled value once they are clearly under way.
      const underWay = Date.now() - startedAt > 1000;
      stable = underWay && Math.abs(angle - last) < 0.3 ? stable + 1 : 0;
      last = angle;
      expect(stable).toBeGreaterThanOrEqual(3);
    },
    { timeout: 8000, interval: 100 }
  );

  return last;
}

describe("blob critter two-handed reach", () => {
  it("extends both arms when the pointer is below the blob", async () => {
    mockMatchMedia(false);

    render(<BlobCritter shape="cat" color="#4daace" size={210} reach />);

    // jsdom reports a zero-size rect for the blob, so the component sees the
    // cursor at its own origin (0, size * 0.1). A pointer at (0, 600) is
    // therefore well below the blob.
    await act(async () => {
      fireEvent.pointerMove(window, { clientX: 0, clientY: 600 });
    });

    await waitFor(() => {
      expect(screen.getByTestId("blob-arm-left")).toHaveAttribute("data-reach", "both");
      expect(screen.getByTestId("blob-arm-right")).toHaveAttribute("data-reach", "both");
    });
  });

  it("extends only the nearer arm when the pointer is to the side", async () => {
    mockMatchMedia(false);

    render(<BlobCritter shape="cat" color="#4daace" size={210} reach />);

    await act(async () => {
      fireEvent.pointerMove(window, { clientX: 600, clientY: 0 });
    });

    await waitFor(() => {
      expect(screen.getByTestId("blob-arm-right")).toHaveAttribute("data-reach", "nearest");
      expect(screen.getByTestId("blob-arm-left")).toHaveAttribute("data-reach", "rest");
    });
  });

  it("turns the nearer arm toward a pointer on the left", async () => {
    mockMatchMedia(false);

    render(<BlobCritter shape="cat" color="#4daace" size={210} reach />);

    await act(async () => {
      fireEvent.pointerMove(window, { clientX: -600, clientY: 21 });
    });

    await waitFor(() => {
      expect(screen.getByTestId("blob-arm-left")).toHaveAttribute("data-reach", "nearest");
    });

    // The left arm hangs from its shoulder and points along local -x, so a
    // rotation between -90 and 90 aims it at a pointer on the left. Any other
    // angle means the arm swung the long way round the circle instead of
    // turning towards the pointer.
    const angle = await settledRotation("blob-arm-left");
    expect(angle).toBeGreaterThan(-90);
    expect(angle).toBeLessThan(90);
  });

  it("turns the nearer arm toward a pointer on the right", async () => {
    mockMatchMedia(false);

    render(<BlobCritter shape="cat" color="#4daace" size={210} reach />);

    await act(async () => {
      fireEvent.pointerMove(window, { clientX: 600, clientY: 21 });
    });

    await waitFor(() => {
      expect(screen.getByTestId("blob-arm-right")).toHaveAttribute("data-reach", "nearest");
    });

    // The right arm points along local +x, so the same range aims it at a
    // pointer on the right.
    const angle = await settledRotation("blob-arm-right");
    expect(angle).toBeGreaterThan(-90);
    expect(angle).toBeLessThan(90);
  });
});
