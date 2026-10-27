import { useEffect, useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiAppProvider } from "@/context/ApiAppProvider";
import { useApp } from "@/context/AppContext";
import { ApiError, productionApi } from "@/lib/productionApi";

vi.mock("@/lib/productionApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/productionApi")>("@/lib/productionApi");
  return {
    ...actual,
    productionApi: {
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
      getFamilySession: vi.fn(),
    },
  };
});

function SignInProbe() {
  const { signInTherapist } = useApp();
  const [status, setStatus] = useState("idle");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (signInTherapist("therapist@playgroundlife.app", "therapist123") as Promise<boolean>)
      .then((ok) => setStatus(ok ? "signed-in" : "signed-in-false"))
      .catch((error) => setStatus(error instanceof ApiError ? `threw:${error.code}` : "threw:other"));
  }, [signInTherapist]);

  return <span data-testid="status">{status}</span>;
}

function FamilySignInProbe() {
  const { signInFamily } = useApp();
  const [status, setStatus] = useState("idle");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (signInFamily("555-0101", "pass") as Promise<{ childId: string; familyMemberId: string } | null>)
      .then((match) => setStatus(match ? "signed-in" : "signed-in-null"))
      .catch((error) => setStatus(error instanceof ApiError ? `threw:${error.code}` : "threw:other"));
  }, [signInFamily]);

  return <span data-testid="family-status">{status}</span>;
}


function SessionRestoreProbe() {
  const { sessionRestoreStatus, session, retrySessionRestore } = useApp();

  return (
    <>
      <span data-testid="restore-status">{sessionRestoreStatus}</span>
      <span data-testid="restored-role">{session?.role ?? "none"}</span>
      <button onClick={retrySessionRestore}>Retry restore</button>
    </>
  );
}

function readStatus() {
  return document.querySelector('[data-testid="status"]')?.textContent ?? "";
}

function readFamilyStatus() {
  return document.querySelector('[data-testid="family-status"]')?.textContent ?? "";
}

describe("sign-in error contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productionApi.me).mockRejectedValue(new Error("no session"));
    vi.mocked(productionApi.listChildren).mockResolvedValue({ children: [] } as never);
    vi.mocked(productionApi.listAssignments).mockResolvedValue({ assignments: [] } as never);
    vi.mocked(productionApi.listAuditLog).mockResolvedValue({ auditLog: [] } as never);
    vi.mocked(productionApi.listFamilyLinks).mockResolvedValue({ familyLinks: [] } as never);
    vi.mocked(productionApi.listGoals).mockResolvedValue({ goals: [] } as never);
    vi.mocked(productionApi.listStaff).mockResolvedValue({ staff: [] } as never);
    vi.mocked(productionApi.listCustomGames).mockResolvedValue({ games: [] } as never);
    vi.mocked(productionApi.logout).mockResolvedValue(undefined);
  });

  it("returns false for rejected credentials", async () => {
    vi.mocked(productionApi.login).mockRejectedValue(
      new ApiError("Invalid credentials", { status: 401, code: "http" })
    );

    render(
      <ApiAppProvider>
        <SignInProbe />
      </ApiAppProvider>
    );

    await waitFor(() => expect(readStatus()).toBe("signed-in-false"));
  });

  it("throws when the backend is unreachable", async () => {
    vi.mocked(productionApi.login).mockRejectedValue(
      new ApiError("Can't reach the clinic server.", { status: null, code: "network" })
    );

    render(
      <ApiAppProvider>
        <SignInProbe />
      </ApiAppProvider>
    );

    await waitFor(() => expect(readStatus()).toBe("threw:network"));
  });

  it("keeps the sign-in successful when a refresh fails afterwards", async () => {
    vi.mocked(productionApi.login).mockResolvedValue({
      user: { role: "therapist", id: "therapist-1", name: "Dr. Maya Lane" },
    } as never);
    vi.mocked(productionApi.listChildren).mockRejectedValue(
      new ApiError("Can't reach the clinic server.", { status: null, code: "network" })
    );

    render(
      <ApiAppProvider>
        <SignInProbe />
      </ApiAppProvider>
    );

    await waitFor(() => expect(readStatus()).toBe("signed-in"));
  });

  it("logs out when a staff account signs in on the family form", async () => {
    vi.mocked(productionApi.login).mockResolvedValue({
      user: { role: "therapist", id: "therapist-1", name: "Dr. Maya Lane" },
    } as never);

    render(
      <ApiAppProvider>
        <FamilySignInProbe />
      </ApiAppProvider>
    );

    await waitFor(() => expect(readFamilyStatus()).toBe("signed-in-null"));
    expect(productionApi.logout).toHaveBeenCalled();
  });

  it("keeps the protected route after a temporary restore failure and retries successfully", async () => {
    window.history.pushState({}, "", "/therapist");

    vi.mocked(productionApi.me)
      .mockRejectedValueOnce(
        new ApiError("Can't reach the clinic server.", { status: null, code: "network" })
      )
      .mockResolvedValueOnce({
        user: { role: "therapist", id: "therapist-1", name: "Dr. Maya Lane" },
      } as never);

    render(
      <ApiAppProvider>
        <SessionRestoreProbe />
      </ApiAppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("restore-status").textContent).toBe("error");
    });

    expect(window.location.pathname).toBe("/therapist");
    expect(screen.getByTestId("restored-role").textContent).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "Retry restore" }));

    await waitFor(() => {
      expect(screen.getByTestId("restore-status").textContent).toBe("ready");
      expect(screen.getByTestId("restored-role").textContent).toBe("therapist");
    });

    expect(window.location.pathname).toBe("/therapist");
  });
});
