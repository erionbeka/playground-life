import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ApiStatusBanner from "@/components/ApiStatusBanner";

describe("API status banner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stays hidden while the API is healthy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, database: "ok" }) })
    );

    render(<ApiStatusBanner />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByTestId("api-status-banner")).toBeNull();
  });

  it("warns when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<ApiStatusBanner />);

    await waitFor(() => expect(screen.getByTestId("api-status-banner")).toBeInTheDocument());
    expect(screen.getByTestId("api-status-banner").textContent).toContain("clinic server");
  });

  it("warns when the database is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ ok: false, database: "error" }) })
    );

    render(<ApiStatusBanner />);

    await waitFor(() => expect(screen.getByTestId("api-status-banner")).toBeInTheDocument());
  });
});
