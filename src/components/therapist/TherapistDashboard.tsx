import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import CaseloadOverview from "./CaseloadOverview";
import ChildList from "./ChildList";
import AssignHomework from "./AssignHomework";
import HomeworkReview from "./HomeworkReview";
import ClinicSession from "./ClinicSession";

type Tab = "overview" | "children" | "assign" | "clinic" | "review";

const tabs: { key: Tab; label: string; emoji: string }[] = [
  { key: "overview", label: "Overview", emoji: "Caseload" },
  { key: "children", label: "Children", emoji: "Profiles" },
  { key: "assign", label: "Homework", emoji: "Assignments" },
  { key: "clinic", label: "Classwork", emoji: "Clinic" },
  { key: "review", label: "Outcomes", emoji: "Reports" },
];

export default function TherapistDashboard() {
  const { setRole, session, therapistUsers, signInTherapist, signOut } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [email, setEmail] = useState(therapistUsers[0]?.email || "therapist@playgroundlife.app");
  const [password, setPassword] = useState("therapist123");
  const [error, setError] = useState("");

  if (session?.role !== "therapist") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <button onClick={() => { setRole("none"); navigate("/enter"); }} className="absolute left-4 top-4 text-sm text-muted-foreground hover:text-foreground touch-target">
            Back
          </button>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/35 bg-card/82 p-6 shadow-[0_24px_70px_rgba(21,31,56,0.16)] backdrop-blur-xl sm:p-8"
          >
            <div className="mb-8 text-center">
              <h1 className="mb-2 font-display text-3xl font-extrabold text-foreground">Therapist Sign In</h1>
              <p className="text-sm text-muted-foreground sm:text-base">Secure clinic access for assignments, approvals, reports, and audit history.</p>
            </div>

            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const authenticated = await signInTherapist(email, password);
                if (!authenticated) {
                  setError("We couldn't sign you in. Check the clinic email and password.");
                  return;
                }
                setError("");
              }}
            >
              <div className="space-y-2">
                <label htmlFor="therapist-email" className="block text-sm font-semibold text-foreground">
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
                <label htmlFor="therapist-password" className="block text-sm font-semibold text-foreground">
                  Password
                </label>
                <input
                  id="therapist-password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-border bg-background/85 px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <button
                type="submit"
                className="touch-target w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-[0_16px_40px_rgba(77,170,206,0.28)] transition hover:brightness-105"
              >
                Sign In
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-border/70 bg-background/45 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Demo clinic access</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>therapist@playgroundlife.app</p>
                <p>therapist123</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card/85 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">Clinic</span>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Therapist Dashboard</h1>
            <p className="text-xs text-muted-foreground">Signed in as {session.displayName}</p>
          </div>
        </div>
        <button onClick={() => { signOut(); navigate("/enter"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors touch-target px-3">
          Sign Out
        </button>
      </header>

      <nav className="flex gap-1 overflow-x-auto px-4 pt-4 sm:px-6">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={`touch-target whitespace-nowrap rounded-t-xl px-5 py-3 font-display text-sm font-semibold transition-colors ${
              tab === entry.key ? "border border-b-0 border-border bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
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
        className="mx-4 mb-6 rounded-b-xl rounded-tr-xl border border-border bg-card/88 p-4 backdrop-blur-md sm:mx-6 sm:p-6"
      >
        {tab === "overview" && <CaseloadOverview />}
        {tab === "children" && <ChildList />}
        {tab === "assign" && <AssignHomework />}
        {tab === "clinic" && <ClinicSession />}
        {tab === "review" && <HomeworkReview />}
      </motion.div>
    </div>
  );
}
