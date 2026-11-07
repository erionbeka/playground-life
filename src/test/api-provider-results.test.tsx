import { useEffect, useRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiAppProvider } from "@/context/ApiAppProvider";
import { useApp } from "@/context/AppContext";
import { ApiError, productionApi } from "@/lib/productionApi";

vi.mock("@/lib/productionApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/productionApi")>("@/lib/productionApi");

  return {
    ...actual,
    productionApi: {
      ...actual.productionApi,
      me: vi.fn(),
      login: vi.fn(),
      listChildren: vi.fn(),
      listAssignments: vi.fn(),
      listAuditLog: vi.fn(),
      listFamilyLinks: vi.fn(),
      listGoals: vi.fn(),
      listStaff: vi.fn(),
      listCustomGames: vi.fn(),
      recordGameResult: vi.fn(),
    },
  };
});

function CompletionProbe() {
  const { signInTherapist, completeGame } = useApp();
  const [ready, setReady] = useState(false);
  const signInStarted = useRef(false);

  useEffect(() => {
    if (signInStarted.current) return;

    signInStarted.current = true;
    void Promise.resolve(signInTherapist("therapist@example.com", "password")).then(setReady);
  }, [signInTherapist]);

  return (
    <button
      disabled={!ready}
      onClick={() => {
        void completeGame("assignment-1", {
          gameId: "game-020",
          completedAt: "2026-11-07",
          durationSeconds: 90,
          score: 85,
          interactions: 12,
        });
      }}
    >
      Complete game
    </button>
  );
}

function renderProvider() {
  render(
    <ApiAppProvider>
      <CompletionProbe />
    </ApiAppProvider>
  );
}

describe("ApiAppProvider game-result submission retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.mocked(productionApi.me).mockRejectedValue(new Error("No existing session"));
    vi.mocked(productionApi.login).mockResolvedValue({
      user: {
        id: "therapist-1",
        clinicId: "clinic-1",
        role: "therapist",
        name: "Test Therapist",
      },
    } as never);

    vi.mocked(productionApi.listChildren).mockResolvedValue({ children: [] } as never);
    vi.mocked(productionApi.listAssignments).mockResolvedValue({ assignments: [] } as never);
    vi.mocked(productionApi.listAuditLog).mockResolvedValue({ auditLog: [] } as never);
    vi.mocked(productionApi.listFamilyLinks).mockResolvedValue({ familyLinks: [] } as never);
    vi.mocked(productionApi.listGoals).mockResolvedValue({ goals: [] } as never);
    vi.mocked(productionApi.listStaff).mockResolvedValue({ staff: [] } as never);
    vi.mocked(productionApi.listCustomGames).mockResolvedValue({ games: [] } as never);
    vi.mocked(productionApi.recordGameResult).mockResolvedValue({
      assignmentId: "assignment-1",
      gameId: "game-020",
      resultId: "result-1",
      submissionId: "submission-1",
      reviewStatus: "pending",
      replayed: false,
    } as never);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("queues a UUID submission and retries the identical payload when the browser comes online", async () => {
    vi.mocked(productionApi.recordGameResult).mockRejectedValueOnce(
      new ApiError("Network unavailable", { status: null, code: "network" })
    );

    renderProvider();

    const button = await screen.findByRole("button", { name: "Complete game" });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("pendingGameResults") || "[]")).toHaveLength(1);
    });

    const [queuedSubmission] = JSON.parse(localStorage.getItem("pendingGameResults") || "[]");

    expect(queuedSubmission).toEqual(expect.objectContaining({
      assignmentId: "assignment-1",
      gameId: "game-020",
    }));
    expect(queuedSubmission.submissionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("pendingGameResults") || "[]")).toHaveLength(0);
    });

    expect(productionApi.recordGameResult).toHaveBeenNthCalledWith(
      2,
      "assignment-1",
      queuedSubmission
    );
  });

  it("keeps the same UUID queued when an online retry also fails", async () => {
    vi.mocked(productionApi.recordGameResult)
      .mockRejectedValueOnce(new ApiError("Network unavailable", { status: null, code: "network" }))
      .mockRejectedValueOnce(new ApiError("Still unavailable", { status: null, code: "network" }));

    renderProvider();

    const button = await screen.findByRole("button", { name: "Complete game" });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("pendingGameResults") || "[]")).toHaveLength(1);
    });

    const [originalSubmission] = JSON.parse(localStorage.getItem("pendingGameResults") || "[]");

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(productionApi.recordGameResult).toHaveBeenCalledTimes(2);
    });

    const [remainingSubmission] = JSON.parse(localStorage.getItem("pendingGameResults") || "[]");

    expect(remainingSubmission).toEqual(originalSubmission);
    expect(remainingSubmission.submissionId).toBe(originalSubmission.submissionId);
  });
});
