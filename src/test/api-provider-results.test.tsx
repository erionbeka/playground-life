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
      logout: vi.fn(),
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
  const { session, signInTherapist, signOut, completeGame } = useApp();
  const [ready, setReady] = useState(false);
  const signInStarted = useRef(false);

  useEffect(() => {
    if (signInStarted.current) return;

    signInStarted.current = true;
    void Promise.resolve(signInTherapist("therapist@example.com", "password")).then(setReady);
  }, [signInTherapist]);

  return (
    <>
      <span>{session ? "Signed in" : "Signed out"}</span>
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
      <button onClick={() => void signOut()}>Sign out</button>
    </>
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
    vi.mocked(productionApi.logout).mockResolvedValue({} as never);
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
      userId: "therapist-1",
      assignmentId: "assignment-1",
      status: "pending",
      payload: expect.objectContaining({ gameId: "game-020" }),
    }));
    expect(queuedSubmission.payload.submissionId).toMatch(
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
      queuedSubmission.payload
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
    expect(remainingSubmission.payload.submissionId).toBe(originalSubmission.payload.submissionId);
  });

  it("preserves another account's and legacy queue entries without submitting them", async () => {
    const otherAccountEntry = {
      userId: "therapist-2",
      assignmentId: "assignment-2",
      status: "pending",
      payload: { submissionId: "other-submission", gameId: "game-020" },
    };
    const legacyEntry = {
      assignmentId: "assignment-legacy",
      submissionId: "legacy-submission",
      gameId: "game-020",
    };
    localStorage.setItem("pendingGameResults", JSON.stringify([otherAccountEntry, legacyEntry]));

    renderProvider();

    await waitFor(() => expect(screen.getByRole("button", { name: "Complete game" })).toBeEnabled());
    expect(productionApi.recordGameResult).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("pendingGameResults") || "[]")).toEqual([
      otherAccountEntry,
      legacyEntry,
    ]);
  });

  it("retains a permanently rejected result as blocked instead of deleting it", async () => {
    const queuedEntry = {
      userId: "therapist-1",
      assignmentId: "assignment-1",
      status: "pending",
      payload: { submissionId: "rejected-submission", gameId: "game-020" },
    };
    localStorage.setItem("pendingGameResults", JSON.stringify([queuedEntry]));
    vi.mocked(productionApi.recordGameResult).mockRejectedValueOnce(
      new ApiError("Submission rejected", { status: 409, code: "http" })
    );

    renderProvider();

    await waitFor(() => {
      const [stored] = JSON.parse(localStorage.getItem("pendingGameResults") || "[]");
      expect(stored?.status).toBe("blocked");
      expect(stored?.lastErrorStatus).toBe(409);
      expect(stored?.payload?.submissionId).toBe("rejected-submission");
    });

    expect(productionApi.recordGameResult).toHaveBeenCalledTimes(1);
  });

  it("cancels an in-flight retry before the server logout request resolves", async () => {
    const queuedEntry = {
      userId: "therapist-1",
      assignmentId: "assignment-1",
      status: "pending",
      payload: { submissionId: "in-flight-submission", gameId: "game-020" },
    };
    localStorage.setItem("pendingGameResults", JSON.stringify([queuedEntry]));

    let resolveRequest!: (value: never) => void;
    vi.mocked(productionApi.recordGameResult).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRequest = resolve as (value: never) => void;
      }) as never
    );

    let resolveLogout!: (value: never) => void;
    vi.mocked(productionApi.logout).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveLogout = resolve as (value: never) => void;
      }) as never
    );

    renderProvider();

    await waitFor(() => {
      expect(productionApi.recordGameResult).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(productionApi.logout).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Signed out")).toBeInTheDocument();

    await act(async () => {
      resolveRequest({} as never);
    });

    expect(JSON.parse(localStorage.getItem("pendingGameResults") || "[]")).toEqual([
      queuedEntry,
    ]);

    await act(async () => {
      resolveLogout({} as never);
    });
  });

  it("preserves a new result queued while an older result retry is in flight", async () => {
    const olderEntry = {
      userId: "therapist-1",
      assignmentId: "assignment-1",
      status: "pending",
      payload: { submissionId: "older-submission", gameId: "game-020" },
    };
    localStorage.setItem("pendingGameResults", JSON.stringify([olderEntry]));

    let resolveOlderRequest!: (value: never) => void;
    vi.mocked(productionApi.recordGameResult)
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveOlderRequest = resolve as (value: never) => void;
        }) as never
      )
      .mockRejectedValueOnce(
        new ApiError("Network unavailable", { status: null, code: "network" })
      );

    renderProvider();

    await waitFor(() => {
      expect(productionApi.recordGameResult).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Complete game" }));

    await waitFor(() => {
      expect(productionApi.recordGameResult).toHaveBeenCalledTimes(2);
      expect(JSON.parse(localStorage.getItem("pendingGameResults") || "[]")).toHaveLength(2);
    });

    const [, newlyQueuedEntry] = JSON.parse(
      localStorage.getItem("pendingGameResults") || "[]"
    );

    expect(newlyQueuedEntry.payload.submissionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    await act(async () => {
      resolveOlderRequest({} as never);
    });

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("pendingGameResults") || "[]")).toEqual([
        newlyQueuedEntry,
      ]);
    });
  });

});
