import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { apiBaseUrl } from "@/lib/productionApi";

type ApiState = "unknown" | "ok" | "down";

const POLL_INTERVAL_MS = 30_000;

/**
 * Warns the user when the clinic API (or its database) is unreachable. Without
 * this, a write that never reached the server looks exactly like a write that
 * succeeded.
 */
export default function ApiStatusBanner() {
  const [state, setState] = useState<ApiState>("unknown");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/health`, { credentials: "include" });
        if (cancelled) return;
        setState(response.ok ? "ok" : "down");
      } catch {
        if (!cancelled) setState("down");
      }
    };

    void probe();
    const timer = window.setInterval(probe, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (state !== "down" || dismissed) return null;

  return (
    <div
      data-testid="api-status-banner"
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Can't reach the clinic server. Changes will not be saved until it is back.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss warning"
        className="rounded-full p-1 hover:bg-white/20"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
