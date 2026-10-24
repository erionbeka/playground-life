import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The base URL is read at module-evaluation time, so the module has to be
 * re-imported with a controlled environment. The repo's `.env` sets
 * VITE_API_URL, and the test must not depend on the developer's local file.
 */
async function loadApiClient() {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "");
  return import("@/lib/productionApi");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("productionApi error contract", () => {
  it("defaults to a same-origin base URL", async () => {
    const { apiBaseUrl } = await loadApiClient();
    expect(apiBaseUrl).toBe("");
  });

  it("raises a network ApiError when fetch rejects", async () => {
    const { ApiError, productionApi } = await loadApiClient();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(productionApi.listChildren()).rejects.toBeInstanceOf(ApiError);
    await expect(productionApi.listChildren()).rejects.toMatchObject({
      name: "ApiError",
      code: "network",
      status: null,
    });
  });

  it("raises an http ApiError carrying the server message", async () => {
    const { productionApi } = await loadApiClient();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid child payload" }),
      })
    );

    await expect(productionApi.listChildren()).rejects.toMatchObject({
      name: "ApiError",
      code: "http",
      status: 400,
      message: "Invalid child payload",
    });
  });

  it("requests same-origin paths", async () => {
    const { productionApi } = await loadApiClient();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ children: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    await productionApi.listChildren();

    expect(fetchMock).toHaveBeenCalledWith("/api/children", expect.objectContaining({ credentials: "include" }));
  });
});
