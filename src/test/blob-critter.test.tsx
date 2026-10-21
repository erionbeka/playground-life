import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
