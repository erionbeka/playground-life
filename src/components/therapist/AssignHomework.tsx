import { useEffect, useMemo, useState } from "react";
import { SkillDomain, useApp } from "@/context/AppContext";
import { categoryMeta, GameCategory, Difficulty } from "@/data/games";
import { useCatalog } from "@/lib/customCatalog";
import { motion, AnimatePresence } from "framer-motion";
import { buildMonthlyPlan, getPersonalizationSummary } from "@/lib/personalization";
import { getGameSkillDomains } from "@/lib/skills";

const categories = Object.entries(categoryMeta) as [GameCategory, typeof categoryMeta[GameCategory]][];
type CatalogPathway = "recommended" | "goal-based" | "recent-success" | "needs-generalization" | "all";

const relationshipLabels: Record<string, string> = {
  parent: "Parent",
  sibling: "Sibling",
  grandparent: "Grandparent",
  "aunt-uncle": "Aunt/Uncle",
  other: "Other",
};

export default function AssignHomework() {
  const { children, assignments, createAssignment, approveAssignment } = useApp();
  const catalog = useCatalog();
  const [childId, setChildId] = useState(children[0]?.id || "");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [mode, setMode] = useState<"single" | "shared">("shared");
  const [planType, setPlanType] = useState<"single" | "monthly">("single");
  const [supportLevel, setSupportLevel] = useState<"high" | "moderate" | "light">("moderate");
  const [notes, setNotes] = useState("");
  const [assignedFamilyMemberId, setAssignedFamilyMemberId] = useState<string>("");
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toISOString().slice(0, 10);
  });
  const [filterCategory, setFilterCategory] = useState<GameCategory | "all">("all");
  const [catalogPathway, setCatalogPathway] = useState<CatalogPathway>("recommended");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedChild = children.find((child) => child.id === childId);
  const activeGoalDomains = useMemo<SkillDomain[]>(
    () => Array.from(new Set((selectedChild?.therapyGoals || []).filter((goal) => goal.status === "active").map((goal) => goal.domain))),
    [selectedChild]
  );
  const availableGames = useMemo(
    () => catalog.filter((game) => (mode === "shared" ? game.supportsShared : true)),
    [catalog, mode]
  );
  const personalization = useMemo(
    () => (selectedChild ? getPersonalizationSummary(selectedChild, assignments, availableGames) : null),
    [assignments, availableGames, selectedChild]
  );

  const personalizedOrder = useMemo(
    () => personalization?.recommendedGames.map((game) => game.id) || availableGames.map((game) => game.id),
    [availableGames, personalization]
  );

  const pathwayGames = useMemo(() => {
    const recommendedIds = new Set(personalization?.recommendedGames.slice(0, 18).map((game) => game.id) || []);
    const masteredIds = new Set(personalization?.masteredGameIds || []);
    const activeGoalDomainsSet = new Set(activeGoalDomains);
    const challengeCategories = new Set(personalization?.nextChallengeCategories || []);

    switch (catalogPathway) {
      case "recommended":
        return availableGames.filter((game) => recommendedIds.has(game.id));
      case "goal-based":
        return availableGames.filter((game) => getGameSkillDomains(game.id).some((domain) => activeGoalDomainsSet.has(domain)));
      case "recent-success":
        return availableGames.filter((game) => masteredIds.has(game.id));
      case "needs-generalization":
        return availableGames.filter((game) => challengeCategories.has(game.category) || !masteredIds.has(game.id));
      default:
        return availableGames;
    }
  }, [activeGoalDomains, availableGames, catalogPathway, personalization]);

  const filteredGames = useMemo(() => {
    const source = filterCategory === "all"
      ? pathwayGames
      : pathwayGames.filter((game) => game.category === filterCategory);

    const fallback = source.length > 0 ? source : availableGames;
    return [...fallback].sort(
      (left, right) => personalizedOrder.indexOf(left.id) - personalizedOrder.indexOf(right.id)
    );
  }, [availableGames, filterCategory, pathwayGames, personalizedOrder]);

  const categoryCounts = useMemo(
    () =>
      categories.reduce<Record<string, number>>((counts, [key]) => {
        counts[key] = availableGames.filter((game) => game.category === key).length;
        return counts;
      }, {}),
    [availableGames]
  );

  useEffect(() => {
    setSelectedGames((current) => current.filter((gameId) => availableGames.some((game) => game.id === gameId)));
  }, [availableGames]);

  useEffect(() => {
    if (personalization) {
      setDifficulty(personalization.recommendedDifficulty);
    }
  }, [personalization]);

  const selectedSkillFocus = useMemo<SkillDomain[]>(() => {
    const fromGames = Array.from(new Set(selectedGames.flatMap((gameId) => getGameSkillDomains(gameId))));
    if (fromGames.length > 0) return fromGames;
    if (activeGoalDomains.length > 0) return activeGoalDomains;
    return ["attention"];
  }, [activeGoalDomains, selectedGames]);

  const pendingApprovals = useMemo(
    () => assignments.filter((assignment) => assignment.childId === childId && assignment.type === "homework" && assignment.therapistApproval === "pending"),
    [assignments, childId]
  );
  const monthlyPlanPreview = useMemo(
    () => (
      selectedChild && personalization
        ? buildMonthlyPlan(selectedChild, assignments, selectedGames, personalization.recommendedGames, selectedSkillFocus, difficulty, mode)
        : []
    ),
    [assignments, difficulty, mode, personalization, selectedChild, selectedGames, selectedSkillFocus]
  );

  const toggleGame = (gameId: string) => {
    setSelectedGames((current) => (
      current.includes(gameId)
        ? current.filter((entry) => entry !== gameId)
        : [...current, gameId]
    ));
  };

  const applyPersonalizedPlan = () => {
    if (!personalization) return;

    const rotatedCategories = new Set(personalization.rotationCategories);
    const suggestedGames = personalization.recommendedGames
      .filter((game) =>
        game.difficulty === personalization.recommendedDifficulty ||
        rotatedCategories.has(game.category) ||
        personalization.preferredCategories.includes(game.category)
      )
      .slice(0, 5)
      .map((game) => game.id);

    setSelectedGames(suggestedGames);
    setDifficulty(personalization.recommendedDifficulty);
    setFilterCategory("all");
    setCatalogPathway("recommended");
    if (!notes.trim()) {
      setNotes(`Progressive plan focused on ${personalization.progressionStage} stage goals.`);
    }
  };

  const handleAssign = () => {
    if (!childId || selectedGames.length === 0 || !personalization) return;

    const createHomework = (
      assignmentDueDate: string,
      weekNumber?: number,
      weekDifficulty: Difficulty = difficulty,
      weekGames: string[] = selectedGames,
      monthlyPlanWeek?: NonNullable<ReturnType<typeof buildMonthlyPlan>[number]>
    ) => {
      const stageLabel = weekNumber ? `Week ${weekNumber} - ${weekDifficulty}` : `Stage - ${weekDifficulty}`;
      const assignmentNotes = monthlyPlanWeek
        ? [
            `${stageLabel}`,
            monthlyPlanWeek.objective,
            `Support level: ${monthlyPlanWeek.supportLevel}`,
            `Decision: ${monthlyPlanWeek.progressionDecision}`,
            notes,
          ].filter(Boolean).join(" - ")
        : [stageLabel, notes].filter(Boolean).join(" - ");

      createAssignment({
        childId,
        type: "homework",
        gameIds: weekGames,
        difficulty: weekDifficulty,
        mode,
        notes: assignmentNotes,
        dueDate: assignmentDueDate,
        assignedFamilyMemberId: assignedFamilyMemberId || undefined,
        skillFocus: Array.from(new Set([...selectedSkillFocus, ...weekGames.flatMap((gameId) => getGameSkillDomains(gameId))])),
        supportLevel,
        systemSuggestedDifficulty: personalization.recommendedDifficulty,
        monthlyPlan: monthlyPlanWeek ? {
          weekNumber: monthlyPlanWeek.weekNumber,
          objective: monthlyPlanWeek.objective,
          rationale: monthlyPlanWeek.rationale,
          progressionDecision: monthlyPlanWeek.progressionDecision,
          supportLevel: monthlyPlanWeek.supportLevel,
          sessionLengthMinutes: monthlyPlanWeek.sessionLengthMinutes,
          adultSupport: monthlyPlanWeek.adultSupport,
          familyGuidance: monthlyPlanWeek.familyGuidance,
          successMarkers: monthlyPlanWeek.successMarkers,
        } : undefined,
      });
    };

    if (planType === "monthly") {
      const baseDate = new Date(`${dueDate}T00:00:00`);
      monthlyPlanPreview.forEach((weekPlan, index) => {
        const nextDate = new Date(baseDate);
        nextDate.setDate(baseDate.getDate() + index * 7);
        createHomework(nextDate.toISOString().slice(0, 10), index + 1, weekPlan.difficulty, weekPlan.gameIds, weekPlan);
      });
    } else {
      createHomework(dueDate, undefined, difficulty, selectedGames);
    }

    setSelectedGames([]);
    setNotes("");
    setSuccess(true);
    window.setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div>
      <h2 className="mb-6 font-display text-lg font-bold text-foreground">Assign Homework</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-foreground">Child</label>
            <select value={childId} onChange={(event) => { setChildId(event.target.value); setAssignedFamilyMemberId(""); }} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.avatar} {child.name}
                </option>
              ))}
            </select>
          </div>

          {personalization ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Personalized Path</p>
              <p className="mt-1 font-display text-base font-bold text-foreground capitalize">
                {personalization.progressionStage} stage - target {personalization.recommendedDifficulty}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Avg score {personalization.avgScore}% with {personalization.completedGamesCount} completed games.
              </p>
              <p className="mt-2 text-xs font-semibold text-foreground">
                Readiness: {personalization.readiness.stage} - support {personalization.readiness.supportNeed}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {personalization.therapistSummary}
              </p>
              {personalization.preferredCategories.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Strengths: {personalization.preferredCategories.map((category) => categoryMeta[category].label).join(", ")}
                </p>
              ) : null}
              {personalization.nextChallengeCategories.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Next challenge: {personalization.nextChallengeCategories.map((category) => categoryMeta[category].label).join(", ")}
                </p>
              ) : null}
              {personalization.rotationCategories.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Rotate into: {personalization.rotationCategories.map((category) => categoryMeta[category].label).join(", ")}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Skill focus: {selectedSkillFocus.map((domain) => domain.replace("-", " ")).join(", ")}
              </p>
              {personalization.recommendationReasons.length > 0 ? (
                <div className="mt-3 rounded-lg bg-white/65 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Why this was recommended</p>
                  <div className="mt-2 space-y-1 text-xs text-foreground">
                    {personalization.recommendationReasons.slice(0, 3).map((reason) => (
                      <p key={reason}>- {reason}</p>
                    ))}
                  </div>
                </div>
              ) : null}
              <button onClick={applyPersonalizedPlan} className="mt-3 touch-target rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                Use Personalized Plan
              </button>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Assign View</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{showAdvanced ? "Advanced planning" : "Quick assign"}</p>
              </div>
              <button
                onClick={() => setShowAdvanced((current) => !current)}
                className="touch-target rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                {showAdvanced ? "Hide extras" : "Show more"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Quick assign keeps the therapist flow focused on child, pathway, categories, and selected games. Open extras only when you need manual adjustments.
            </p>
          </div>

          {pendingApprovals.length > 0 ? (
            <div className="rounded-xl border border-amber-300/50 bg-amber-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Pending Approval Queue</p>
              <div className="mt-3 space-y-2">
                {pendingApprovals.slice(0, 3).map((assignment) => (
                  <div key={assignment.id} className="rounded-lg bg-white/80 p-3 text-xs text-foreground">
                    <p className="font-semibold">{assignment.gameIds.length} games · {assignment.difficulty} · due {assignment.dueDate}</p>
                    <p className="mt-1 text-muted-foreground">
                      Focus: {assignment.skillFocus.map((domain) => domain.replace("-", " ")).join(", ")}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => approveAssignment(assignment.id, "approved")} className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground">
                        Approve
                      </button>
                      <button onClick={() => approveAssignment(assignment.id, "adjusted", difficulty)} className="rounded-lg bg-muted px-3 py-1.5 font-semibold text-foreground">
                        Approve + {difficulty}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-semibold text-foreground">Plan Length</label>
            <div className="flex gap-2">
              <button onClick={() => setPlanType("single")} className={`touch-target rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${planType === "single" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                One Time
              </button>
              <button onClick={() => setPlanType("monthly")} className={`touch-target rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${planType === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                Monthly Plan
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-foreground">{planType === "monthly" ? "Start Date" : "Due Date"}</label>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground" />
            {planType === "monthly" ? (
              <p className="mt-2 text-xs text-muted-foreground">Creates 4 weekly assignments with objectives, support guidance, and therapist review points.</p>
            ) : null}
          </div>

          {showAdvanced ? (
            <>
              {selectedChild && selectedChild.familyMembers.length > 0 ? (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-foreground">Assign to Family Member</label>
                  <select value={assignedFamilyMemberId} onChange={(event) => setAssignedFamilyMemberId(event.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground">
                    <option value="">Anyone in family</option>
                    {selectedChild.familyMembers.map((familyMember) => (
                      <option key={familyMember.id} value={familyMember.id}>
                        {familyMember.avatar} {familyMember.name} ({relationshipLabels[familyMember.relationship] || familyMember.relationship})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground">Difficulty</label>
                <div className="flex gap-2">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((entry) => (
                    <button key={entry} onClick={() => setDifficulty(entry)} className={`touch-target rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${difficulty === entry ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {entry}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground">Mode</label>
                <div className="flex gap-2">
                  <button onClick={() => setMode("single")} className={`touch-target rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === "single" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    Solo
                  </button>
                  <button onClick={() => setMode("shared")} className={`touch-target rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === "shared" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    With Family
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground">Therapist Support Level</label>
                <div className="flex gap-2">
                  {(["high", "moderate", "light"] as const).map((entry) => (
                    <button key={entry} onClick={() => setSupportLevel(entry)} className={`touch-target rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${supportLevel === entry ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {entry}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  High keeps more cues visible. Light removes more prompts for model-copying, shape builds, and tap challenges.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground">Notes for Family</label>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-foreground" placeholder="Tips, focus areas..." />
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-muted p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick assign settings</p>
              <p className="mt-2 text-sm text-foreground">
                {difficulty} difficulty, {mode === "shared" ? "with family" : "solo"}, {supportLevel} support
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open advanced planning if you want to manually change support, family member assignment, or therapist notes.
              </p>
            </div>
          )}

          <div className="rounded-xl bg-muted p-4">
            <p className="mb-1 text-sm font-semibold text-foreground">Selected: {selectedGames.length} games</p>
            <div className="flex flex-wrap gap-1">
              {selectedGames.map((gameId) => {
                const game = availableGames.find((entry) => entry.id === gameId) || catalog.find((entry) => entry.id === gameId);
                return game ? (
                  <span key={gameId} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-foreground">
                    {game.emoji} {game.name}
                  </span>
                ) : null;
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Catalog Pathway</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ["recommended", "Recommended"],
                ["goal-based", "Goal-Based"],
                ["recent-success", "Recent Success"],
                ["needs-generalization", "Needs Generalization"],
                ["all", "All Games"],
              ] as Array<[CatalogPathway, string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCatalogPathway(key)}
                  className={`touch-target rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${catalogPathway === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Start from the pathway first, then narrow by category only if needed.
              </p>
            </div>

          {planType === "monthly" && monthlyPlanPreview.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Monthly Program Preview</p>
              <div className="mt-3 space-y-3">
                {monthlyPlanPreview.map((week) => (
                  <div key={`week-${week.weekNumber}`} className="rounded-xl bg-muted p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Week {week.weekNumber}: {week.objective}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{week.rationale}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-foreground">{week.difficulty}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <p>Support: {week.supportLevel}</p>
                      <p>Assigned support: {supportLevel}</p>
                      <p>Adult role: {week.adultSupport}</p>
                      <p>Session: {week.sessionLengthMinutes} min</p>
                      <p>Decision: {week.progressionDecision}</p>
                    </div>
                    <p className="mt-2 text-[11px] text-foreground">Family guidance: {week.familyGuidance[0]}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Success marker: {week.successMarkers[0]}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <button onClick={handleAssign} disabled={selectedGames.length === 0 || !childId} className="touch-target w-full rounded-xl bg-primary py-3 text-base font-bold text-primary-foreground disabled:opacity-50">
            {planType === "monthly" ? `Create Progressive Monthly Plan (${selectedGames.length} games)` : `Assign Homework (${selectedGames.length} games)`}
          </button>

          <AnimatePresence>
            {success ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-secondary/20 py-2 text-center text-sm font-semibold text-foreground">
                {planType === "monthly" ? "Progressive monthly homework plan created!" : "Homework assigned!"}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setFilterCategory("all")} className={`touch-target rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filterCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {mode === "shared" ? "Shared Games" : "All"}
            </button>
            {categories.map(([key, meta]) => (
              <button key={key} onClick={() => setFilterCategory(key)} className={`touch-target rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filterCategory === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {meta.emoji} {meta.label} ({categoryCounts[key] || 0})
              </button>
            ))}
          </div>

          {filteredGames.length > 0 ? (
            <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-y-auto pr-2 sm:grid-cols-3 md:grid-cols-4">
              {filteredGames.map((game) => {
                const isRecommended = personalization?.recommendedGames.slice(0, 6).some((entry) => entry.id === game.id);
                const isMastered = personalization?.masteredGameIds.includes(game.id) || false;

                return (
                  <button
                    key={game.id}
                    onClick={() => toggleGame(game.id)}
                    className={`touch-target rounded-xl border-2 p-3 text-left transition-all ${
                      selectedGames.includes(game.id)
                        ? "border-primary bg-primary/10 shadow-md"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span className="text-2xl">{game.emoji}</span>
                      {isRecommended ? <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Recommended</span> : null}
                    </div>
                    <p className="text-xs font-bold leading-tight text-foreground">{game.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{game.estimatedMinutes} min - {game.difficulty}</p>
                    {isMastered ? <p className="mt-1 text-[10px] text-muted-foreground">Previously completed</p> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
              <p className="mb-2 font-display text-lg font-bold text-foreground">No games available in this view</p>
              <p className="mb-4 text-sm text-muted-foreground">
                {mode === "shared" ? "Try Solo mode to see more independent learning activities." : "Switch categories to browse more activities."}
              </p>
              {mode === "shared" ? (
                <button onClick={() => setMode("single")} className="touch-target rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Switch to Solo
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
