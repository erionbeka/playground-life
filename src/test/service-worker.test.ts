import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The service worker is plain JavaScript that runs in a worker scope, so it is
// evaluated here against a fake scope. Vitest runs test files as ESM, where
// `__dirname` is not defined; the process working directory is the repo root.
const repoRoot = process.cwd();

type Listener = (event: unknown) => void;

interface FetchEvent {
  request: { method: string; mode: string; url: string };
  respondWith: (response: unknown) => void;
}

interface WorkerHarness {
  handlers: Map<string, Listener>;
  cached: Map<string, Array<{ url: string }>>;
  responded: boolean;
  response: unknown;
}

const workerSource = readFileSync(resolve(repoRoot, "public/sw.js"), "utf-8");

function loadWorker(): WorkerHarness {
  const handlers = new Map<string, Listener>();
  const cached = new Map<string, Array<{ url: string }>>();
  const harness: WorkerHarness = { handlers, cached, responded: false, response: undefined };

  const cacheStore = (name: string) => ({
    add: async () => undefined,
    put: async (request: { url: string }) => {
      const list = cached.get(name) ?? [];
      list.push({ url: request.url });
      cached.set(name, list);
    },
    match: async () => undefined,
  });

  const cachesFake = {
    open: async (name: string) => cacheStore(name),
    match: async () => undefined,
    keys: async () => [],
    delete: async () => true,
  };

  const selfFake = {
    addEventListener: (type: string, listener: Listener) => handlers.set(type, listener),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    location: { origin: "https://app.test" },
    registration: { scope: "https://app.test/" },
  };

  const fetchFake = vi.fn(async (request: { url: string }) => ({
    status: 200,
    type: "basic",
    clone: () => ({ status: 200, type: "basic" }),
    url: request.url,
  }));

  const run = new Function("self", "caches", "fetch", workerSource);
  run(selfFake, cachesFake, fetchFake);

  return harness;
}

async function dispatch(
  harness: WorkerHarness,
  request: { method?: string; mode?: string; url: string },
): Promise<FetchEvent> {
  const event: FetchEvent = {
    request: { method: request.method ?? "GET", mode: request.mode ?? "cors", url: request.url },
    respondWith: (response: unknown) => {
      harness.responded = true;
      harness.response = response;
    },
  };
  harness.responded = false;
  harness.response = undefined;
  await harness.handlers.get("fetch")?.(event);
  // The worker answers with a promise. Waiting for it lets the cache writes
  // inside the chain happen before the assertions run.
  if (harness.response && typeof (harness.response as PromiseLike<unknown>).then === "function") {
    await harness.response;
  }
  return event;
}

describe("service worker caching rules", () => {
  it("never handles the API, so clinic data cannot be cached or replayed", async () => {
    const harness = loadWorker();

    await dispatch(harness, { url: "https://app.test/api/children" });
    expect(harness.responded).toBe(false);

    await dispatch(harness, { url: "https://app.test/api/children/abc/moods" });
    expect(harness.responded).toBe(false);

    await dispatch(harness, { url: "https://app.test/api" });
    expect(harness.responded).toBe(false);

    // Nothing was written to any cache.
    for (const entries of harness.cached.values()) expect(entries).toHaveLength(0);
  });

  it("does not cache a navigation that carries an invitation or reset token", async () => {
    const harness = loadWorker();

    await dispatch(harness, {
      mode: "navigate",
      url: "https://app.test/accept-invite?token=super-secret",
    });

    // The worker still answers the navigation, but the token-bearing URL must
    // not end up in Cache Storage.
    for (const entries of harness.cached.values()) {
      expect(entries.map((entry) => entry.url)).not.toContain(
        "https://app.test/accept-invite?token=super-secret",
      );
    }
  });

  it("caches the plain app shell so the app still opens offline", async () => {
    const harness = loadWorker();

    await dispatch(harness, { mode: "navigate", url: "https://app.test/" });

    const written = [...harness.cached.values()].flat().map((entry) => entry.url);
    expect(written).toContain("https://app.test/");
  });

  it("caches hashed build assets", async () => {
    const harness = loadWorker();

    await dispatch(harness, { url: "https://app.test/assets/index-CtyGRi5C.js" });

    expect(harness.responded).toBe(true);
    const written = [...harness.cached.values()].flat().map((entry) => entry.url);
    expect(written).toContain("https://app.test/assets/index-CtyGRi5C.js");
  });

  it("bumped the cache name so the old cache is purged on activation", () => {
    expect(workerSource).toContain('const CACHE = "playground-v3";');
    expect(workerSource).not.toContain('const CACHE = "playground-v2"');
  });
});
