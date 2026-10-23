import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { ApiAppProvider } from "@/context/ApiAppProvider";
import { ApiError, productionApi } from "@/lib/productionApi";

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
  Toaster: () => null,
}));

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
      createChild: vi.fn(),
      createStaff: vi.fn(),
    },
  };
});

function renderAdmin() {
  // The provider only probes /api/auth/me on a protected route, so the URL
  // has to look like one before the dashboard mounts.
  window.history.pushState({}, "", "/admin");
  return render(
    <ApiAppProvider>
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminDashboard />
      </MemoryRouter>
    </ApiAppProvider>
  );
}

describe("admin writes report failures instead of failing silently", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/admin");
    vi.mocked(productionApi.me).mockResolvedValue({
      user: { id: "admin-1", clinicId: "clinic-1", role: "admin", name: "Avery Cole" },
    } as never);
    vi.mocked(productionApi.listChildren).mockResolvedValue({ children: [] } as never);
    vi.mocked(productionApi.listAssignments).mockResolvedValue({ assignments: [] } as never);
    vi.mocked(productionApi.listAuditLog).mockResolvedValue({ auditLog: [] } as never);
    vi.mocked(productionApi.listFamilyLinks).mockResolvedValue({ familyLinks: [] } as never);
    vi.mocked(productionApi.listGoals).mockResolvedValue({ goals: [] } as never);
    vi.mocked(productionApi.listStaff).mockResolvedValue({ staff: [] } as never);
    vi.mocked(productionApi.listCustomGames).mockResolvedValue({ games: [] } as never);
  });

  it("keeps the form and reports the error when creating a staff account fails", async () => {
    vi.mocked(productionApi.createStaff).mockRejectedValue(
      new ApiError("Invalid staff payload", { status: 400, code: "http" })
    );

    renderAdmin();

    fireEvent.click(await screen.findByRole("button", { name: "Staff" }));

    const nameInput = (await screen.findByPlaceholderText("Full name")) as HTMLInputElement;
    const emailInput = (await screen.findByPlaceholderText("Email")) as HTMLInputElement;
    const passwordInput = (await screen.findByPlaceholderText("Temporary password")) as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "New Therapist" } });
    fireEvent.change(emailInput, { target: { value: "new@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "CorrectHorseBatteryStaple1" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Staff Account" }));

    await waitFor(() => expect(productionApi.createStaff).toHaveBeenCalled());
    await waitFor(() => expect(toastError).toHaveBeenCalled());

    expect(String(toastError.mock.calls[0][0])).toContain("Invalid staff payload");
    expect(emailInput.value).toBe("new@example.com");
  });

  it("keeps the form and reports the error when adding a child fails", async () => {
    vi.mocked(productionApi.createChild).mockRejectedValue(
      new ApiError("Invalid child payload", { status: 400, code: "http" })
    );

    renderAdmin();

    fireEvent.click(await screen.findByRole("button", { name: "Families" }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Add Child" }));

    const nameInput = (await screen.findByPlaceholderText("Child's name")) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Robin" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Child" }));

    await waitFor(() => expect(productionApi.createChild).toHaveBeenCalled());
    await waitFor(() => expect(toastError).toHaveBeenCalled());

    expect(String(toastError.mock.calls[0][0])).toContain("Invalid child payload");
    expect(nameInput.value).toBe("Robin");
  });

  it("clears the form and confirms when creating a staff account succeeds", async () => {
    vi.mocked(productionApi.createStaff).mockResolvedValue({
      user: { id: "user-9", name: "New Therapist", email: "new@example.com", role: "therapist" },
    } as never);

    renderAdmin();

    fireEvent.click(await screen.findByRole("button", { name: "Staff" }));

    const nameInput = (await screen.findByPlaceholderText("Full name")) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "New Therapist" } });
    fireEvent.change(await screen.findByPlaceholderText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(await screen.findByPlaceholderText("Temporary password"), { target: { value: "CorrectHorseBatteryStaple1" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Staff Account" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    await waitFor(() => expect(nameInput.value).toBe(""));
  });
});
