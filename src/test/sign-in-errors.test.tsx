import { useEffect, useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
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

function readStatus() {
  return document.querySelector('[data-testid="status"]')?.textContent ?? "";
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
});
