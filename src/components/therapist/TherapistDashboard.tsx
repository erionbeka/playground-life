import PasswordInput from "@/components/ui/PasswordInput";
import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { ApiError } from "@/lib/productionApi";
import CaseloadOverview from "./CaseloadOverview";
import ChildList from "./ChildList";
import AssignHomework from "./AssignHomework";
import HomeworkReview from "./HomeworkReview";
import ClinicSession from "./ClinicSession";
import GameAuthoring from "./GameAuthoring";

type Tab = "overview" | "children" | "assign" | "clinic" | "review" | "author";

const tabs: { key: Tab; label: string; emoji: string }[] = [
  { key: "overview", label: "Overview", emoji: "Caseload" },
  { key: "children", label: "Children", emoji: "Profiles" },
  { key: "assign", label: "Homework", emoji: "Assignments" },
  { key: "clinic", label: "Classwork", emoji: "Clinic" },
  { key: "review", label: "Outcomes", emoji: "Reports" },
  { key: "author", label: "Games", emoji: "🎨" },
];

export default function TherapistDashboard() {
  const {
    setRole,
    session,
    signInTherapist,
    signOut,
    sessionRestoreStatus,
    retrySessionRestore,
  } = useApp();

  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Do not show the sign-in form while an existing session is being restored.
  if (
    session?.role !== "therapist" &&
    sessionRestoreStatus === "restoring"
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
          <h1 className="mb-3 font-display text-2xl font-bold text-foreground">
            Restoring your session
          </h1>
          <p className="text-sm text-muted-foreground">
            Please wait while we reconnect you to your therapist dashboard.
          </p>
        </div>
      </div>
    );
  }

  // A temporary connection failure should not look like a signed-out session.
  if (
    session?.role !== "therapist" &&
    sessionRestoreStatus === "error"
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
          <h1 className="mb-3 font-display text-2xl font-bold text-foreground">
            Couldn't restore your session
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            We couldn't connect to the clinic server. Your session may still
            be valid. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={retrySessionRestore}
            className="touch-target w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:brightness-105"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => {
              setRole("none");
              navigate("/enter");
            }}
            className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-accent/15 hover:text-foreground"
          >
            Back to Entry
          </button>
        </div>
      </div>
    );
  }

  if (session?.role !== "therapist") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/35 bg-card/82 p-6 shadow-[0_24px_70px_rgba(21,31,56,0.16)] backdrop-blur-xl sm:p-8"
          >
            <button
              onClick={() => {
                setRole("none");
                navigate("/enter");
              }}
              className="touch-target -ml-2 mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:bg-accent/15 hover:text-foreground"
            >
              ← Back
            </button>

            <div className="mb-8 text-center">
              <h1 className="mb-2 font-display text-3xl font-extrabold text-foreground">
                Therapist Sign In
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Secure clinic access for assignments, approvals, reports, and
                audit history.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();

                try {
                  const authenticated = await signInTherapist(email, password);

                  if (!authenticated) {
                    setError(
                      "We couldn't sign you in. Check the clinic email and password."
                    );
                    return;
                  }

                  setError("");
                } catch (err) {
                  setError(
                    err instanceof ApiError && err.code === "network"
                      ? "Can't reach the clinic server. Check your connection and try again."
                      : "We couldn't sign you in right now. Please try again."
                  );
                }
              }}
            >
              <div className="space-y-2">
                <label
                  htmlFor="therapist-email"
                  className="block text-sm font-semibold text-foreground"
                >
                  Clinic email
                </label>
                <input
                  id="therapist-email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-border bg-background/85 px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="therapist-password"
                  className="block text-sm font-semibold text-foreground"
                >
                  Password
                </label>
                <PasswordInput
                  id="therapist-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-border bg-background/85 px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              <button
                type="submit"
                className="touch-target w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-[0_16px_40px_rgba(77,170,206,0.28)] transition hover:brightness-105"
              >
                Sign In
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="flex flex-col gap-3 border-b border-border bg-card/85 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-2xl">Clinic</span>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold text-foreground sm:text-xl">
              Therapist Dashboard
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Signed in as {session.displayName}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            signOut();
            navigate("/enter");
          }}
          className="touch-target self-start rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground sm:self-auto"
        >
          Sign Out
        </button>
      </header>

      <nav
        aria-label="Therapist dashboard sections"
        className="flex gap-1 overflow-x-auto px-3 pt-3 sm:px-6 sm:pt-4"
      >
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            aria-current={tab === entry.key ? "page" : undefined}
            className={`touch-target shrink-0 whitespace-nowrap rounded-t-xl px-3 py-3 font-display text-sm font-semibold transition-colors sm:px-5 ${
              tab === entry.key
                ? "border border-b-0 border-border bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {entry.emoji} {entry.label}
          </button>
        ))}
      </nav>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-3 mb-6 min-w-0 rounded-b-xl rounded-tr-xl border border-border bg-card/88 p-3 backdrop-blur-md sm:mx-6 sm:p-6"
      >
        {tab === "overview" && <CaseloadOverview />}
        {tab === "children" && <ChildList />}
        {tab === "assign" && <AssignHomework />}
        {tab === "clinic" && <ClinicSession />}
        {tab === "review" && <HomeworkReview />}
        {tab === "author" && <GameAuthoring />}
      </motion.div>
    </div>
  );
}
