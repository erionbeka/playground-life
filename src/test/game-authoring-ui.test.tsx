import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import GameAuthoring from "@/components/therapist/GameAuthoring";
import { productionApi } from "@/lib/productionApi";

vi.mock("@/lib/productionApi", () => ({
  productionApi: {
    listGameDrafts: vi.fn().mockResolvedValue({ drafts: [] }),
    createGameDraft: vi.fn(),
    updateGameDraft: vi.fn(),
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

const draftRow = {
  id: "draft-1",
  status: "draft",
  originConfirmed: true,
  updatedAt: "2026-10-09T00:00:00.000Z",
  title: "Dino Pairs",
  description: "Find the matching dinosaur cards.",
  emoji: "🦕",
  difficulty: "easy",
  learningGoal: "Match two cards that are the same.",
  successCriteria: ["Finds all pairs"],
  skills: ["attention"],
  supportsShared: true,
  engine: "matching",
  config: { pairList: ["🦕", "🐲"] },
};

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

  it("labels the title field for sighted users", async () => {
    render(<GameAuthoring />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    expect(await screen.findByRole("textbox", { name: /title/i })).toBeTruthy();
    expect(screen.getByText("Game name")).toBeTruthy();
  });

  it("keeps validation feedback visible on the review step", async () => {
    render(<GameAuthoring />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
    expect(await screen.findByText(/check:/i)).toBeTruthy();
  });

  it("shows a reason when review submit is blocked by missing origin", async () => {
    render(<GameAuthoring />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /title/i }), { target: { value: "Dino Pairs" } });
    fireEvent.change(screen.getByRole("textbox", { name: /description/i }), { target: { value: "Find the matching dinosaur cards." } });
    fireEvent.click(screen.getAllByRole("button", { name: /submit for review/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /submit for review/i })[0]);
    expect(await screen.findByText(/origin confirmation is required/i)).toBeTruthy();
    expect(productionApi.submitGameDraft).not.toHaveBeenCalled();
  });

  it("submits an existing draft by updating instead of creating", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({ drafts: [draftRow] } as never);
    vi.mocked(productionApi.updateGameDraft).mockResolvedValue({ id: "draft-1" } as never);
    render(<GameAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^review$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /submit for review/i })[0]);

    await waitFor(() => expect(productionApi.submitGameDraft).toHaveBeenCalledWith("draft-1"));
    expect(productionApi.createGameDraft).not.toHaveBeenCalled();
    const [, payload] = vi.mocked(productionApi.updateGameDraft).mock.calls[0];
    expect(payload).toHaveProperty("originConfirmed", true);
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("updatedAt");
  });

  it("submits an already-confirmed row without needing the editor checkbox", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({ drafts: [draftRow] } as never);
    render(<GameAuthoring />);
    fireEvent.click((await screen.findAllByRole("button", { name: /submit for review/i }))[0]);
    await waitFor(() => expect(productionApi.submitGameDraft).toHaveBeenCalledWith("draft-1"));
  });

  it("opens the review step instead of submitting an unconfirmed row", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({ drafts: [{ ...draftRow, originConfirmed: false }] } as never);
    render(<GameAuthoring />);
    fireEvent.click((await screen.findAllByRole("button", { name: /submit for review/i }))[0]);
    expect(productionApi.submitGameDraft).not.toHaveBeenCalled();
    expect(await screen.findByText(/confirm the origin/i)).toBeTruthy();
  });

  it("resets to the basics step when editing a draft", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({ drafts: [draftRow] } as never);
    render(<GameAuthoring />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /submit for review/i })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    expect(screen.getByText("Game name")).toBeTruthy();
  });

  it("previews a decided draft via View without entering edit mode", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({
      drafts: [{ ...draftRow, status: "approved" }],
    } as never);
    render(<GameAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: /^view$/i }));

    expect(await screen.findByText("Draft preview")).toBeTruthy();
    expect(screen.getAllByLabelText(/🦕 card|🐲 card/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Game name")).toBeNull();
    expect(productionApi.updateGameDraft).not.toHaveBeenCalled();
  });
});