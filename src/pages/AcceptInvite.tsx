import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("working");
    try {
      const response = await fetch(`${API}/api/security/invitations/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Invitation could not be accepted");
      setStatus("done");
      setMessage(`Welcome, ${data.user?.name || name}! Your account is ready.`);
      window.setTimeout(() => navigate("/therapist"), 1800);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-3xl border border-border bg-card/85 p-6 shadow-xl backdrop-blur-xl sm:p-8">
        <h1 className="mb-2 font-display text-2xl font-extrabold text-foreground">Join your clinic</h1>
        <p className="mb-6 text-sm text-muted-foreground">Set up your therapist account to finish the invitation.</p>

        {status === "done" ? (
          <div className="rounded-2xl bg-secondary/20 p-4 text-sm font-semibold text-foreground">{message}</div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-foreground">Your name</span>
              <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-foreground">Password (12+ characters)</span>
              <input type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
            </label>
            {status === "error" ? <p className="text-sm text-destructive">{message}</p> : null}
            <button type="submit" disabled={status === "working"} className="touch-target w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow-lg transition hover:brightness-105 disabled:opacity-50">
              {status === "working" ? "Creating account…" : "Create my account"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
