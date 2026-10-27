import PasswordInput from "@/components/ui/PasswordInput";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { ApiError } from "@/lib/productionApi";
import { getCatalogGameById, useCatalog } from "@/lib/customCatalog";
import GamePlayer from "../game/GamePlayer";
import { getPersonalizationSummary } from "@/lib/personalization";

export default function ParentDashboard() {
  const { setRole, children, assignments, selectedChildId, setSelectedChildId, currentAssignment, setCurrentAssignment, signInFamily, signOut, session, sessionRestoreStatus, retrySessionRestore } = useApp();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const [playingGameId, setPlayingGameId] = useState<string | null>(null);
  const [signedInFamilyMemberId, setSignedInFamilyMemberId] = useState<string | null>(null);
  const [familyView, setFamilyView] = useState<"today" | "all" | "completed">("today");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] = useState("");

  const child = useMemo(
    () => children.find((candidate) => candidate.id === selectedChildId),
    [children, selectedChildId]
  );

  const signedInFamilyMember = useMemo(
    () => child?.familyMembers.find((familyMember) => familyMember.id === (signedInFamilyMemberId || session?.familyMemberId)) || null,
    [child, session?.familyMemberId, signedInFamilyMemberId]
  );

  const childAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.childId === selectedChildId),
    [assignments, selectedChildId]
  );

  const pendingAssignments = useMemo(
    () => childAssignments.filter((assignment) => assignment.status !== "completed"),
    [childAssignments]
  );

  const completedAssignments = useMemo(
    () => childAssignments.filter((assignment) => assignment.status === "completed"),
    [childAssignments]
  );
  const nextAssignment = useMemo(
    () =>
      [...pendingAssignments].sort((left, right) => {
        const dateCompare = left.dueDate.localeCompare(right.dueDate);
        if (dateCompare !== 0) return dateCompare;
        return left.createdAt.localeCompare(right.createdAt);
      })[0] || null,
    [pendingAssignments]
  );

  const childPersonalization = useMemo(
    () => (child?.notes ? `${child.name} ${child.notes.toLowerCase()}` : null),
    [child]
  );
  const personalizationSummary = useMemo(
    () => (child ? getPersonalizationSummary(child, assignments) : null),
    [assignments, child]
  );
  const nextGameId = useMemo(
    () => nextAssignment?.gameIds.find((gameId) => !nextAssignment.completedGames.includes(gameId)) || null,
    [nextAssignment]
  );

  const resetFamilySession = () => {
    setSelectedChildId(null);
    setCurrentAssignment(null);
    setSignedInFamilyMemberId(null);
    setPhoneNumber("");
    setPassword("");
    setSignInError("");
  };

  if (sessionRestoreStatus === "restoring" && !selectedChildId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
          <h1 className="mb-3 font-display text-2xl font-bold text-foreground">
            Restoring your family session
          </h1>
          <p className="text-sm text-muted-foreground">
            Please wait while we reconnect you to your child's activities.
          </p>
        </div>
      </div>
    );
  }

  if (sessionRestoreStatus === "error" && !selectedChildId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
          <h1 className="mb-3 font-display text-2xl font-bold text-foreground">
            Couldn't restore your family session
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            We couldn't connect to the clinic server. Your session may still be valid.
            Check your connection and try again.
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

  if (!selectedChildId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/35 bg-card/82 p-6 shadow-[0_24px_70px_rgba(21,31,56,0.16)] backdrop-blur-xl sm:p-8"
          >
            <button
              onClick={() => { setRole("none"); navigate("/enter"); }}
              className="touch-target -ml-2 mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:bg-accent/15 hover:text-foreground"
            >
              ← Back
            </button>
            <div className="mb-8 text-center">
              <h1 className="mb-2 font-display text-3xl font-extrabold text-foreground">Family Sign In</h1>
              <p className="text-sm text-muted-foreground sm:text-base">Sign in with your phone number and password to open your child&apos;s activities.</p>
            </div>

            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();

                const normalizedPhoneNumber = phoneNumber.replace(/\D/g, "");
                try {
                  const match = await signInFamily(normalizedPhoneNumber, password);

                  if (!match) {
                    setSignInError("We couldn't sign you in. Check the phone number and password and try again.");
                    return;
                  }

                  setSignInError("");
                  setSignedInFamilyMemberId(match.familyMemberId);
                  setSelectedChildId(match.childId);
                } catch (err) {
                  setSignInError(
                    err instanceof ApiError && err.code === "network"
                      ? "Can't reach the clinic server. Check your connection and try again."
                      : "We couldn't sign you in right now. Please try again."
                  );
                }
              }}
            >
              <div className="space-y-2">
                <label htmlFor="phone-number" className="block text-sm font-semibold text-foreground">
                  Phone number
                </label>
                <input
                  id="phone-number"
                  value={phoneNumber}
                  onChange={(event) => {
                    setPhoneNumber(event.target.value);
                    if (signInError) setSignInError("");
                  }}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Your phone number"
                  className="h-12 w-full rounded-xl border border-border bg-background/85 px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="family-password" className="block text-sm font-semibold text-foreground">
                  Password
                </label>
                <PasswordInput
                  id="family-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (signInError) setSignInError("");
                  }}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  className="h-12 w-full rounded-xl border border-border bg-background/85 px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {signInError ? <p className="text-sm text-destructive">{signInError}</p> : null}

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

  if (playingGameId && currentAssignment) {
    return (
      <GamePlayer
        gameId={playingGameId}
        assignment={currentAssignment}
        onComplete={() => {
          setPlayingGameId(null);
          setCurrentAssignment(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-card/85 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <button onClick={resetFamilySession} className="touch-target text-sm text-muted-foreground hover:text-foreground">
            Back
          </button>
          <span className="text-2xl">{child?.avatar}</span>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">{child?.name}&apos;s Activities</h1>
            {signedInFamilyMember ? (
              <p className="text-xs text-muted-foreground">
                Signed in as {signedInFamilyMember.avatar} {signedInFamilyMember.name}
              </p>
            ) : child?.familyMembers && child.familyMembers.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Family: {child.familyMembers.map((familyMember) => `${familyMember.avatar} ${familyMember.name}`).join(" - ")}
              </p>
            ) : null}
          </div>
        </div>

        <button
          onClick={() => {
            signOut();
            resetFamilySession();
            navigate("/enter");
          }}
          className="touch-target px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          Exit
        </button>
      </header>

      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        {personalizationSummary ? (
          <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Personalized Journey</p>
            <p className="mt-1 font-display text-lg font-bold capitalize text-foreground">
              {personalizationSummary.progressionStage} stage - working toward {personalizationSummary.recommendedDifficulty}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent average {personalizationSummary.recentAvgScore || personalizationSummary.avgScore}% across {personalizationSummary.completedGamesCount} completed games.
            </p>
            {personalizationSummary.nextChallengeCategories.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Up next: {personalizationSummary.nextChallengeCategories.map((category) => category.replace("-", " ")).join(", ")}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-foreground">
              {personalizationSummary.familySummary}
            </p>
            {personalizationSummary.recommendationReasons.length > 0 ? (
              <div className="mt-3 rounded-xl bg-white/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">This plan was chosen because</p>
                <div className="mt-2 space-y-1 text-xs text-foreground">
                  {personalizationSummary.recommendationReasons.slice(0, 2).map((reason) => (
                    <p key={reason}>- {reason}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {pendingAssignments.length > 0 ? (
          <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Today&apos;s Session</p>
            {nextAssignment ? (
              <>
                <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-bold text-foreground">
                      {nextAssignment.type === "classwork" ? "Classwork session" : "Homework session"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {nextAssignment.gameIds.length} games, {nextAssignment.difficulty}, {nextAssignment.mode === "shared" ? "with family" : "solo"}
                    </p>
                    {nextAssignment.monthlyPlan ? (
                      <p className="mt-1 text-sm text-foreground">{nextAssignment.monthlyPlan.objective}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-foreground">
                    Due {nextAssignment.dueDate}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Start with</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {nextGameId ? getCatalogGameById(nextGameId)?.name || nextGameId : "This session is ready to review"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {nextAssignment.monthlyPlan?.familyGuidance?.[0] || "Keep the session calm and encouraging."}
                    </p>
                  </div>
                  {nextGameId ? (
                    <button
                      onClick={() => {
                        setCurrentAssignment(nextAssignment);
                        setPlayingGameId(nextGameId);
                      }}
                      className="touch-target rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                    >
                      Start today&apos;s session
                    </button>
                  ) : (
                    <div className="rounded-xl bg-secondary/15 px-5 py-3 text-sm font-semibold text-foreground">
                      Session complete
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap gap-2">
          {([
            ["today", "Today"],
            ["all", "All To Do"],
            ["completed", "Completed"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFamilyView(key)}
              className={`touch-target rounded-full px-4 py-2 text-sm font-semibold transition-colors ${familyView === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {familyView !== "completed" && pendingAssignments.length > 0 ? (
          <div className="mb-8">
            <h2 className="mb-4 font-display text-lg font-bold text-foreground">{familyView === "today" ? "Today" : "To Do"}</h2>
            <div className="space-y-4">
              {(familyView === "today" && nextAssignment ? [nextAssignment] : pendingAssignments).map((assignment) => {
                const progress = assignment.gameIds.length > 0 ? Math.round((assignment.completedGames.length / assignment.gameIds.length) * 100) : 0;
                const assignedFamilyMember = assignment.assignedFamilyMemberId
                  ? child?.familyMembers.find((familyMember) => familyMember.id === assignment.assignedFamilyMemberId)
                  : null;

                return (
                  <motion.div key={assignment.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Due {assignment.dueDate}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {assignment.gameIds.length} games - {assignment.difficulty} - {assignment.mode === "shared" ? "With Family" : "Solo"}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                          {assignment.type}
                        </p>
                        {assignment.supportLevel ? (
                          <p className="mt-1 text-xs text-muted-foreground">Support level: {assignment.supportLevel}</p>
                        ) : null}
                        {assignedFamilyMember ? (
                          <p className="mt-1 text-xs font-semibold text-primary">
                            Assigned to: {assignedFamilyMember.avatar} {assignedFamilyMember.name}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-accent/20 px-2 py-1 text-xs font-semibold text-foreground">{progress}% done</span>
                    </div>

                    <div className="mb-4 h-3 w-full rounded-full bg-muted">
                      <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>

                    {assignment.notes ? (
                      <div className="mb-4 rounded-xl bg-muted p-3">
                        <p className="text-xs text-muted-foreground">From therapist:</p>
                        <p className="text-sm text-foreground">{assignment.notes}</p>
                      </div>
                    ) : null}

                    {assignment.monthlyPlan ? (
                      <div className="mb-4 rounded-xl border border-primary/15 bg-primary/5 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Week {assignment.monthlyPlan.weekNumber} plan</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{assignment.monthlyPlan.objective}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{assignment.monthlyPlan.rationale}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <p>Support level: {assignment.monthlyPlan.supportLevel}</p>
                          <p>Adult support: {assignment.monthlyPlan.adultSupport}</p>
                          <p>Session target: {assignment.monthlyPlan.sessionLengthMinutes} min</p>
                          <p>Next step: {assignment.monthlyPlan.progressionDecision}</p>
                        </div>
                        <div className="mt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">How to help this week</p>
                          <div className="mt-1 space-y-1 text-xs text-foreground">
                            {assignment.monthlyPlan.familyGuidance.map((item) => (
                              <p key={`${assignment.id}-${item}`}>- {item}</p>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">What success looks like</p>
                          <div className="mt-1 space-y-1 text-xs text-foreground">
                            {assignment.monthlyPlan.successMarkers.map((item) => (
                              <p key={`${assignment.id}-success-${item}`}>- {item}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {assignment.gameIds.map((gameId) => {
                        const game = getCatalogGameById(gameId);
                        const done = assignment.completedGames.includes(gameId);

                        return (
                          <button
                            key={gameId}
                            disabled={done}
                            onClick={() => {
                              setCurrentAssignment(assignment);
                              setPlayingGameId(gameId);
                            }}
                            className={`touch-target flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                              done ? "bg-secondary/10 border-secondary/30 opacity-60" : "border-border bg-card hover:border-primary hover:shadow-md"
                            }`}
                          >
                            <span className="text-3xl">{game?.emoji || "?"}</span>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-bold text-foreground">{game?.name || gameId}</p>
                              <p className="text-xs text-muted-foreground">{game?.estimatedMinutes || 5} min</p>
                              {done && childPersonalization ? <p className="mt-1 text-xs italic text-muted-foreground">{childPersonalization}</p> : null}
                            </div>
                            {done ? <span className="text-sm font-bold text-secondary">Done</span> : <span className="text-sm font-bold text-primary">Play</span>}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mb-4 text-6xl animate-bounce-gentle">Done</div>
            <h2 className="mb-2 font-display text-2xl font-bold text-foreground">All Done!</h2>
            <p className="text-muted-foreground">No homework pending. Great job!</p>
          </div>
        )}

        {familyView === "completed" && completedAssignments.length > 0 ? (
          <div>
            <h2 className="mb-4 font-display text-lg font-bold text-foreground">Completed</h2>
            <div className="space-y-3">
              {completedAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-xl border border-secondary/20 bg-secondary/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {assignment.gameIds.map((gameId) => {
                        const game = getCatalogGameById(gameId);
                        return (
                          <span key={gameId} className="rounded-full bg-secondary/20 px-2 py-1 text-xs text-foreground">
                            {game?.emoji} {game?.name}
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-xs text-muted-foreground">Completed</span>
                  </div>
                  {childPersonalization ? <p className="mt-3 text-sm italic text-muted-foreground">{childPersonalization}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
