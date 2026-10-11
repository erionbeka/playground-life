import { useEffect, useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ApiAppProvider } from "@/context/ApiAppProvider";
import { useApp } from "@/context/AppContext";
import { getCatalogGameById, registerCustomGames } from "@/lib/customCatalog";
import { productionApi } from "@/lib/productionApi";
import type { PublishedGame } from "@/lib/gameAuthoring";

vi.mock("@/lib/productionApi", () => ({
  productionApi: {
    me: vi.fn(),
    login: vi.fn(),
    getFamilySession: vi.fn(),
    listChildren: vi.fn(),
    listAssignments: vi.fn(),
    listAuditLog: vi.fn(),
    listFamilyLinks: vi.fn(),
    listGoals: vi.fn(),
    listCustomGames: vi.fn(),
    logout: vi.fn(),
    createChild: vi.fn(),
    updateChild: vi.fn(),
  },
}));

const CUSTOM_ID = "d00998e2-c9f0-4b3a-9f7c-1a2b3c4d5e6f";

function makePublished(overrides: Partial<PublishedGame> = {}): PublishedGame {
  return {
    id: CUSTOM_ID,
    title: "Dino Pairs", description: "Find the matching dinosaur cards.", emoji: "🦕",
    difficulty: "easy", learningGoal: "Match two cards that are the same.",
    successCriteria: ["Finds all pairs"], skills: ["attention"], supportsShared: true,
    engine: "matching", config: { pairList: ["🦕", "🐲"] },
    status: "approved", createdAt: "2026-10-09T00:00:00Z", ...overrides,
  };
}

function StaffSignInProbe() {
  const { signInTherapist } = useApp();
  const [status, setStatus] = useState("idle");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (signInTherapist("therapist@playgroundlife.app", "therapist123") as Promise<boolean>).then((ok) => setStatus(ok ? "signed-in" : "failed"));
  }, [signInTherapist]);
  return <span>{status}</span>;
}

function FamilySignInProbe() {
  const { signInFamily } = useApp();
  const [status, setStatus] = useState("idle");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (signInFamily("555-0101", "emma123") as Promise<{ childId: string; familyMemberId: string } | null>).then(() => setStatus("done"));
  }, [signInFamily]);
  return <span>{status}</span>;
}

function AgePersistenceProbe() {
  const { signInTherapist, updateChild, addChild } = useApp();
  const [status, setStatus] = useState("idle");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (signInTherapist("therapist@playgroundlife.app", "therapist123") as Promise<boolean>).then(async () => {
      await updateChild("child-1", { age: 9 } as never);
      await addChild({ name: "New Kid", avatar: "kid", age: 4 } as never);
      setStatus("done");
    });
  }, [signInTherapist, updateChild, addChild]);
  return <span>{status}</span>;
}

describe("ApiAppProvider sign-in catalog hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    registerCustomGames([]);
    vi.mocked(productionApi.me).mockRejectedValue(new Error("no session"));
    vi.mocked(productionApi.login).mockResolvedValue({ user: { role: "therapist", id: "therapist-1", name: "Dr. Maya Lane" } } as never);
    vi.mocked(productionApi.listChildren).mockResolvedValue({ children: [] } as never);
    vi.mocked(productionApi.listAssignments).mockResolvedValue({ assignments: [] } as never);
    vi.mocked(productionApi.listAuditLog).mockResolvedValue({ auditLog: [] } as never);
    vi.mocked(productionApi.listFamilyLinks).mockResolvedValue({ familyLinks: [] } as never);
    vi.mocked(productionApi.listGoals).mockResolvedValue({ goals: [] } as never);
    vi.mocked(productionApi.listCustomGames).mockResolvedValue({ games: [makePublished()] } as never);
    vi.mocked(productionApi.createChild).mockResolvedValue({ id: "child-new" } as never);
    vi.mocked(productionApi.updateChild).mockResolvedValue({ id: "child-1" } as never);
  });

  it("registers published games when a staff member signs in", async () => {
    render(
      <ApiAppProvider>
        <StaffSignInProbe />
      </ApiAppProvider>
    );
    await waitFor(() => expect(getCatalogGameById(CUSTOM_ID)?.name).toBe("Dino Pairs"));
    expect(productionApi.listCustomGames).toHaveBeenCalled();
  });

  it("registers published games when a family member signs in", async () => {
    vi.mocked(productionApi.login).mockResolvedValue({ user: { role: "parent", id: "fm-1", name: "Sarah" } } as never);
    vi.mocked(productionApi.getFamilySession).mockResolvedValue({ children: [], assignments: [] } as never);
    render(
      <ApiAppProvider>
        <FamilySignInProbe />
      </ApiAppProvider>
    );
    await waitFor(() => expect(getCatalogGameById(CUSTOM_ID)?.name).toBe("Dino Pairs"));
  });

  it("persists a child's age as birthDate on update and create", async () => {
    const year = new Date().getFullYear();
    render(
      <ApiAppProvider>
        <AgePersistenceProbe />
      </ApiAppProvider>
    );
    await waitFor(() => expect(productionApi.updateChild).toHaveBeenCalled());
    expect(productionApi.updateChild).toHaveBeenCalledWith("child-1", expect.objectContaining({ birthDate: `${year - 9}-01-01` }));
    expect(productionApi.createChild).toHaveBeenCalledWith(expect.objectContaining({ birthDate: `${year - 4}-01-01` }));
  });
});
