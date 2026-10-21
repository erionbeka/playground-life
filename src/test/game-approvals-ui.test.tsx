import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import GameApprovals from "@/components/admin/GameApprovals";
import { productionApi } from "@/lib/productionApi";

vi.mock("@/lib/productionApi", () => ({
  productionApi: {
    listGameDrafts: vi.fn(),
    decideGameDraft: vi.fn(),
  },
}));

const submittedRow = {
  id: "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f",
  clinicId: "clinic-1",
  authorId: "user-1",
  status: "submitted",
  title: "Dino Pairs",
  description: "Find the matching dinosaur cards.",
  emoji: "🦕",
  difficulty: "easy",
  learningGoal: "Match two cards that are the same.",
  successCriteria: ["Finds all pairs"],
  skills: ["attention"],
  supportsShared: true,
  engine: "matching",
  config: { pairList: ["🦕", "🐲", "🦖", "🐉"] },
  originConfirmed: true,
  createdAt: "2026-10-09T00:00:00Z",
  updatedAt: "2026-10-09T00:00:00Z",
};

describe("GameApprovals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("lists submitted drafts in the review queue", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({ drafts: [submittedRow] } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/Dino Pairs/)).toBeTruthy());
  });

  it("approves a draft and removes it from the queue", async () => {
    vi.mocked(productionApi.listGameDrafts)
      .mockResolvedValueOnce({ drafts: [submittedRow] } as never)
      .mockResolvedValueOnce({ drafts: [] } as never);
    vi.mocked(productionApi.decideGameDraft).mockResolvedValue({ id: submittedRow.id, status: "approved" } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/Dino Pairs/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(screen.queryByText(/Dino Pairs/)).toBeNull());
    expect(window.confirm).toHaveBeenCalled();
    expect(productionApi.decideGameDraft).toHaveBeenCalledWith(submittedRow.id, "approve");
  });

  it("rejects with an optional note", async () => {
    vi.mocked(productionApi.listGameDrafts)
      .mockResolvedValueOnce({ drafts: [submittedRow] } as never)
      .mockResolvedValueOnce({ drafts: [] } as never);
    vi.mocked(productionApi.decideGameDraft).mockResolvedValue({ id: submittedRow.id, status: "rejected" } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/Dino Pairs/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    await waitFor(() => expect(screen.queryByText(/Dino Pairs/)).toBeNull());
    expect(window.confirm).toHaveBeenCalled();
    expect(productionApi.decideGameDraft).toHaveBeenCalled();
    expect(productionApi.decideGameDraft).toHaveBeenCalledWith(submittedRow.id, "reject");
  });

  it("requests changes through the confirmation gate", async () => {
    vi.mocked(productionApi.listGameDrafts)
      .mockResolvedValueOnce({ drafts: [submittedRow] } as never)
      .mockResolvedValueOnce({ drafts: [] } as never);
    vi.mocked(productionApi.decideGameDraft).mockResolvedValue({ id: submittedRow.id, status: "changes_requested" } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/Dino Pairs/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /request changes/i }));
    await waitFor(() => expect(screen.queryByText(/Dino Pairs/)).toBeNull());
    expect(window.confirm).toHaveBeenCalled();
    expect(productionApi.decideGameDraft).toHaveBeenCalledWith(submittedRow.id, "changes_requested");
  });

  it("does not decide when the confirmation dialog is declined", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({ drafts: [submittedRow] } as never);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/Dino Pairs/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(productionApi.decideGameDraft).not.toHaveBeenCalled();
    expect(screen.getByText(/Dino Pairs/)).toBeTruthy();
  });

  it("keeps the row and surfaces an error when a decision fails", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({ drafts: [submittedRow] } as never);
    vi.mocked(productionApi.decideGameDraft).mockRejectedValue(new Error("network down"));
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/Dino Pairs/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(screen.getByText(/couldn't save that decision/i)).toBeTruthy());
    expect(productionApi.decideGameDraft).toHaveBeenCalledWith(submittedRow.id, "approve");
    expect(screen.getByText(/Dino Pairs/)).toBeTruthy();
  });

  it("shows an error state instead of the empty queue when loading fails", async () => {
    vi.mocked(productionApi.listGameDrafts).mockRejectedValue(new Error("network down"));
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/couldn't load game submissions/i)).toBeTruthy());
    expect(screen.queryByText(/No games waiting for review/i)).toBeNull();
  });

  it("keeps drafts awaiting changes out of the review queue but surfaces them", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({
      drafts: [{ ...submittedRow, id: "changes-1", status: "changes_requested" }],
    } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/No games waiting for review/i)).toBeTruthy());
    expect(screen.getByText(/Changes requested/i)).toBeTruthy();
    expect(screen.getByText(/Dino Pairs/)).toBeTruthy();
  });

  it("surfaces changes-requested drafts with the reviewer note", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({
      drafts: [{ ...submittedRow, id: "changes-1", status: "changes_requested", decisionNote: "add more pairs" }],
    } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/Changes requested/i)).toBeTruthy());
    expect(screen.getByText(/add more pairs/)).toBeTruthy();
  });

  it("renders the originality snapshot for a submitted draft", async () => {
    vi.mocked(productionApi.listGameDrafts).mockResolvedValue({
      drafts: [{
        ...submittedRow,
        originalitySnapshot: { tokenHits: ["acme"], banned: ["copyright"], runAt: "2026-10-09T00:00:00Z" },
      }],
    } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/Originality check/i)).toBeTruthy());
    expect(screen.getByText(/acme/)).toBeTruthy();
    expect(screen.getByText(/copyright/)).toBeTruthy();
  });

  it("sends the admin note with the decision", async () => {
    vi.mocked(productionApi.listGameDrafts)
      .mockResolvedValueOnce({ drafts: [submittedRow] } as never)
      .mockResolvedValueOnce({ drafts: [] } as never);
    vi.mocked(productionApi.decideGameDraft).mockResolvedValue({ id: submittedRow.id, status: "changes_requested" } as never);
    render(<GameApprovals />);
    await waitFor(() => expect(screen.getByText(/Dino Pairs/)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/admin note/i), { target: { value: "please tweak the pairs" } });
    fireEvent.click(screen.getByRole("button", { name: /request changes/i }));
    await waitFor(() => expect(productionApi.decideGameDraft).toHaveBeenCalledWith(submittedRow.id, "changes_requested", "please tweak the pairs"));
  });
});
