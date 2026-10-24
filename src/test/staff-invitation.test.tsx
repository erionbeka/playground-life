import { describe, expect, it, vi } from "vitest";
import { productionApi } from "@/lib/productionApi";

describe("staff invitation client", () => {
  it("posts an invitation to the security route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ ok: true, delivery: "queued" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await productionApi.issueStaffInvitation({
      email: "new.therapist@example.com",
      role: "therapist",
    });

    expect(result).toEqual({ ok: true, delivery: "queued" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/security/invitations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "new.therapist@example.com", role: "therapist" }),
      })
    );

    vi.unstubAllGlobals();
  });
});
