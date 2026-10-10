import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import GameAuthoring from "@/components/therapist/GameAuthoring";
import { productionApi } from "@/lib/productionApi";

vi.mock("@/lib/productionApi", () => ({
  productionApi: {
    listGameDrafts: vi.fn().mockResolvedValue({ drafts: [] }),
    createGameDraft: vi.fn(),
    submitGameDraft: vi.fn().mockResolvedValue({ id: "draft-1", status: "submitted" }),
  },
}));

vi.mock("@/lib/customCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/customCatalog")>();
  return {
    ...actual,
    initCustomCatalog: () => [],
  };
});

describe("GameAuthoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_DATA_MODE", "api");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a draft and shows it in the list", async () => {
    vi.mocked(productionApi.createGameDraft).mockResolvedValue({ id: "draft-1" } as never);
    render(<GameAuthoring />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Dino Pairs" } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Find the matching dinosaur cards." } });
    fireEvent.click(screen.getByRole("button", { name: /create draft/i }));

    await waitFor(() => expect(productionApi.createGameDraft).toHaveBeenCalled());
  });

  it("shows validation errors before creating", async () => {
    render(<GameAuthoring />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    fireEvent.click(screen.getByRole("button", { name: /create draft/i }));
    expect(await screen.findByText(/title/i)).toBeTruthy();
  });

  it("requires origin confirmation before submitting", async () => {
    render(<GameAuthoring />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
    expect(await screen.findByText(/origin/i)).toBeTruthy();
  });
});