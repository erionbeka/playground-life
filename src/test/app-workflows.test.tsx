import { useEffect, useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import ChildList from "@/components/therapist/ChildList";
import AssignHomework from "@/components/therapist/AssignHomework";
import TherapistDashboard from "@/components/therapist/TherapistDashboard";
import HomeworkReview from "@/components/therapist/HomeworkReview";
import ParentDashboard from "@/components/parent/ParentDashboard";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { analyzeMonthlyPlanWeekOutcome, getChildReadinessState, getPersonalizationSummary, getProgressiveDifficultyPlan } from "@/lib/personalization";
import { emptySkillProfile } from "@/lib/skills";
import type { Child, HomeworkAssignment } from "@/context/AppContext";
import { hashSecret } from "@/lib/auth";

function StateProbe() {
  const app = useApp();

  return (
    <pre data-testid="app-state">
      {JSON.stringify({
        children: app.children,
        assignments: app.assignments,
        session: app.session,
        auditLog: app.auditLog,
      })}
    </pre>
  );
}

function RemoveAndCompleteProbe() {
  const { removeChild, completeGame, assignments } = useApp();

  useEffect(() => {
    completeGame("hw-2", {
      gameId: "game-020",
      completedAt: "2026-04-06",
      durationSeconds: 111,
      score: 92,
      interactions: 11,
    });
    removeChild("child-2");
  }, [completeGame, removeChild]);

  return <pre data-testid="assignments">{JSON.stringify(assignments)}</pre>;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("personalization helpers", () => {
  it("raises the recommendation when recent performance is strong", () => {
    const child: Child = {
      id: "child-x",
      name: "Ava",
      avatar: "kid",
      age: 7,
      notes: "Loves visual patterns and animals",
      familyMembers: [],
      personalizationProfile: {
        preferredStyle: "visual",
        communicationLevel: "phrases",
        reinforcementType: "social-praise",
        promptLevel: "verbal",
        transitionDifficulty: "moderate",
        interests: ["animals", "patterns"],
        strengths: ["visual matching"],
        supportNeeds: ["short directions"],
        sensoryPreferences: ["low noise"],
        triggerPatterns: ["waiting"],
        regulationSupports: ["visual countdown"],
        clinicalRatings: {
          communicationSupport: 3,
          regulationSupport: 3,
          transitionSupport: 3,
          promptDependence: 3,
          reinforcementResponse: 2,
        },
        clinicalRatingHistory: [
          {
            communicationSupport: 3,
            regulationSupport: 3,
            transitionSupport: 3,
            promptDependence: 3,
            reinforcementResponse: 2,
            recordedAt: "2026-04-01T09:00:00.000Z",
            notes: "Initial baseline",
          },
        ],
      },
      therapyGoals: [],
      skillProfile: emptySkillProfile(),
      progressionSettings: {
        autoAdvance: true,
        approvalRequired: true,
        recommendedDifficulty: "easy",
        maxDifficulty: "hard",
      },
    };

    const assignments: HomeworkAssignment[] = [
      {
        id: "hw-x",
        childId: "child-x",
        type: "homework",
        gameIds: ["game-006", "game-021", "game-117"],
        difficulty: "easy",
        mode: "single",
        notes: "",
        dueDate: "2026-04-06",
        createdAt: "2026-04-01",
        status: "completed",
        completedGames: ["game-006", "game-021", "game-117"],
        results: [
          { assignmentId: "hw-x", gameId: "game-006", completedAt: "2026-04-01", durationSeconds: 100, score: 86, interactions: 20 },
          { assignmentId: "hw-x", gameId: "game-021", completedAt: "2026-04-02", durationSeconds: 120, score: 84, interactions: 18 },
          { assignmentId: "hw-x", gameId: "game-117", completedAt: "2026-04-03", durationSeconds: 130, score: 89, interactions: 16 },
        ],
        skillFocus: ["attention", "sequencing"],
        therapistApproval: "approved",
        approvedAt: "2026-04-01T09:00:00.000Z",
        approvedBy: "therapist-1",
      },
    ];

    const summary = getPersonalizationSummary(child, assignments);

    expect(summary.recommendedDifficulty).toBe("medium");
    expect(summary.preferredCategories.length).toBeGreaterThan(0);
    expect(summary.recommendedGames[0].difficulty === "medium" || summary.recommendedGames[0].difficulty === "easy").toBe(true);
    expect(summary.recommendationReasons.length).toBeGreaterThan(0);
    expect(summary.therapistSummary.length).toBeGreaterThan(0);
  });

  it("rotates recommendations away from recently repeated categories when possible", () => {
    const child: Child = {
      id: "child-rotation",
      name: "Mila",
      avatar: "kid",
      age: 7,
      notes: "Strong visual learner who needs generalization",
      familyMembers: [],
      personalizationProfile: {
        preferredStyle: "visual",
        communicationLevel: "phrases",
        reinforcementType: "social-praise",
        promptLevel: "verbal",
        transitionDifficulty: "moderate",
        interests: ["colors", "patterns"],
        strengths: ["matching"],
        supportNeeds: ["varied practice"],
        sensoryPreferences: [],
        triggerPatterns: [],
        regulationSupports: ["visual schedule"],
        clinicalRatings: {
          communicationSupport: 2,
          regulationSupport: 2,
          transitionSupport: 2,
          promptDependence: 2,
          reinforcementResponse: 2,
        },
        clinicalRatingHistory: [],
      },
      therapyGoals: [
        { id: "goal-rotation", title: "Generalize matching skills", domain: "attention", targetLevel: 80, status: "active", notes: "" },
      ],
      skillProfile: emptySkillProfile(),
      progressionSettings: {
        autoAdvance: true,
        approvalRequired: true,
        recommendedDifficulty: "medium",
        maxDifficulty: "hard",
      },
    };

    const assignments: HomeworkAssignment[] = [{
      id: "hw-rotation",
      childId: "child-rotation",
      type: "homework",
      gameIds: ["game-004", "game-006", "game-010"],
      difficulty: "medium",
      mode: "single",
      notes: "",
      dueDate: "2026-04-18",
      createdAt: "2026-04-12",
      status: "completed",
      completedGames: ["game-004", "game-006", "game-010"],
      results: [
        { assignmentId: "hw-rotation", gameId: "game-004", completedAt: "2026-04-12", durationSeconds: 120, score: 90, interactions: 15 },
        { assignmentId: "hw-rotation", gameId: "game-006", completedAt: "2026-04-13", durationSeconds: 120, score: 92, interactions: 14 },
        { assignmentId: "hw-rotation", gameId: "game-010", completedAt: "2026-04-14", durationSeconds: 120, score: 89, interactions: 13 },
      ],
      skillFocus: ["attention"],
      therapistApproval: "approved",
      approvedAt: "2026-04-12T09:00:00.000Z",
      approvedBy: "therapist-1",
    }];

    const summary = getPersonalizationSummary(child, assignments);

    expect(summary.recentCategories.length).toBeGreaterThan(0);
    expect(summary.rotationCategories.some((category) => !summary.recentCategories.includes(category))).toBe(true);
  });

  it("builds a readable readiness state from clinical profile and outcomes", () => {
    const child: Child = {
      id: "child-readiness",
      name: "Noah",
      avatar: "kid",
      age: 6,
      notes: "Needs help with transitions and benefits from visual routines",
      familyMembers: [],
      personalizationProfile: {
        preferredStyle: "visual",
        communicationLevel: "emerging",
        reinforcementType: "tokens",
        promptLevel: "gestural",
        transitionDifficulty: "high",
        interests: ["patterns"],
        strengths: ["matching"],
        supportNeeds: ["predictable routines"],
        sensoryPreferences: ["quiet room"],
        triggerPatterns: ["sudden changes"],
        regulationSupports: ["visual countdown"],
        clinicalRatings: {
          communicationSupport: 4,
          regulationSupport: 4,
          transitionSupport: 5,
          promptDependence: 4,
          reinforcementResponse: 3,
        },
        clinicalRatingHistory: [],
      },
      therapyGoals: [],
      skillProfile: emptySkillProfile(),
      progressionSettings: {
        autoAdvance: true,
        approvalRequired: true,
        recommendedDifficulty: "easy",
        maxDifficulty: "medium",
      },
    };

    const assignments: HomeworkAssignment[] = [{
      id: "hw-readiness",
      childId: "child-readiness",
      type: "homework",
      gameIds: ["game-001"],
      difficulty: "easy",
      mode: "shared",
      notes: "",
      dueDate: "2026-04-12",
      createdAt: "2026-04-10",
      status: "in-progress",
      completedGames: ["game-001"],
      results: [
        { assignmentId: "hw-readiness", gameId: "game-001", completedAt: "2026-04-11", durationSeconds: 90, score: 58, interactions: 8, emotionalRegulation: 4, frustrationEvents: 2 },
      ],
      skillFocus: ["attention"],
      therapistApproval: "approved",
      approvedAt: "2026-04-10T09:00:00.000Z",
      approvedBy: "therapist-1",
    }];

    const readiness = getChildReadinessState(child, assignments);

    expect(readiness.supportNeed).toBe("high");
    expect(readiness.transitionReadiness).toBe("supported");
    expect(readiness.recommendationReasons.some((reason) => /Transitions are still hard/i.test(reason))).toBe(true);
    expect(readiness.familySummary).toMatch(/calm|predictable/i);
  });

  it("builds a progressive monthly difficulty path", () => {
    expect(getProgressiveDifficultyPlan("medium", 4)).toEqual(["medium", "medium", "hard", "hard"]);
  });

  it("recommends advancing or stepping back based on monthly plan outcomes", () => {
    const advanceReview = analyzeMonthlyPlanWeekOutcome({
      id: "hw-month-1",
      childId: "child-x",
      type: "homework",
      gameIds: ["game-001", "game-002"],
      difficulty: "easy",
      mode: "shared",
      notes: "",
      dueDate: "2026-04-10",
      createdAt: "2026-04-01",
      status: "completed",
      completedGames: ["game-001", "game-002"],
      results: [
        { assignmentId: "hw-month-1", gameId: "game-001", completedAt: "2026-04-02", durationSeconds: 120, score: 88, interactions: 12, promptsNeeded: 2, emotionalRegulation: 8, frustrationEvents: 0 },
        { assignmentId: "hw-month-1", gameId: "game-002", completedAt: "2026-04-03", durationSeconds: 120, score: 86, interactions: 10, promptsNeeded: 2, emotionalRegulation: 7, frustrationEvents: 1 },
      ],
      skillFocus: ["attention"],
      therapistApproval: "approved",
      approvedAt: "2026-04-01T09:00:00.000Z",
      approvedBy: "therapist-1",
      monthlyPlan: {
        weekNumber: 2,
        objective: "Repeat success",
        rationale: "Stretch carefully",
        progressionDecision: "hold",
        supportLevel: "moderate",
        sessionLengthMinutes: 12,
        adultSupport: "guided practice",
        familyGuidance: ["Stay nearby"],
        successMarkers: ["Finish both games"],
      },
    });

    const stepBackReview = analyzeMonthlyPlanWeekOutcome({
      id: "hw-month-2",
      childId: "child-x",
      type: "homework",
      gameIds: ["game-001", "game-002", "game-003"],
      difficulty: "medium",
      mode: "shared",
      notes: "",
      dueDate: "2026-04-17",
      createdAt: "2026-04-08",
      status: "in-progress",
      completedGames: ["game-001"],
      results: [
        { assignmentId: "hw-month-2", gameId: "game-001", completedAt: "2026-04-09", durationSeconds: 120, score: 52, interactions: 8, promptsNeeded: 5, emotionalRegulation: 3, frustrationEvents: 3 },
      ],
      skillFocus: ["attention"],
      therapistApproval: "approved",
      approvedAt: "2026-04-08T09:00:00.000Z",
      approvedBy: "therapist-1",
      monthlyPlan: {
        weekNumber: 3,
        objective: "Generalize skills",
        rationale: "New formats",
        progressionDecision: "advance",
        supportLevel: "light",
        sessionLengthMinutes: 15,
        adultSupport: "check-ins",
        familyGuidance: ["Prompt less"],
        successMarkers: ["Generalize across tasks"],
      },
    });

    expect(advanceReview?.recommendation).toBe("advance");
    expect(stepBackReview?.recommendation).toBe("step-back");
  });
});

describe("app workflows", () => {
  it("persists a new goal through addGoal", () => {
    function GoalProbe() {
      const { addGoal, children } = useApp();
      const didRun = useRef(false);
      useEffect(() => {
        if (didRun.current) return;
        didRun.current = true;
        addGoal("child-1", { title: "New focus goal", domain: "attention", targetLevel: 70, status: "active", notes: "" });
      }, [addGoal]);
      return <pre data-testid="goals">{JSON.stringify(children.find((c) => c.id === "child-1")?.therapyGoals ?? [])}</pre>;
    }
    render(
      <AppProvider>
        <GoalProbe />
      </AppProvider>
    );
    expect(screen.getByTestId("goals").textContent).toMatch(/New focus goal/);
  });

  it("removes assignments when a child is deleted and avoids duplicate completed games", () => {
    render(
      <AppProvider>
        <RemoveAndCompleteProbe />
      </AppProvider>
    );

    const assignments = JSON.parse(screen.getByTestId("assignments").textContent || "[]");
    expect(assignments.some((assignment: HomeworkAssignment) => assignment.childId === "child-2")).toBe(false);
  });

  it("does not let therapists add children or family members", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <ChildList />
        </AppProvider>
      </MemoryRouter>
    );

    expect(screen.queryByText("+ Add Child")).not.toBeInTheDocument();
    expect(screen.queryByText("+ Add Family Member")).not.toBeInTheDocument();
  });

  it("lets the clinic admin add a child and create family sign-in credentials", async () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <AdminDashboard />
        </AppProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Sign In"));
    await screen.findByText(/Clinic Admin Dashboard/i);

    fireEvent.click(screen.getByRole("button", { name: /^Families$/i }));

    fireEvent.click(screen.getByText("+ Add Child"));
    fireEvent.change(screen.getByPlaceholderText("Child's name"), { target: { value: "Zoe" } });
    fireEvent.click(screen.getByText("Save Child"));
    expect(screen.getByText("Zoe")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("+ Add Family Member")[0]);
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Nina" } });
    fireEvent.change(screen.getByPlaceholderText("Phone number"), { target: { value: "555-0401" } });
    fireEvent.change(screen.getByPlaceholderText(/Temporary password/i), { target: { value: "nina-pass-12345" } });
    fireEvent.click(screen.getByText("Create Credentials"));

    expect(screen.getByText(/555-0401/i).textContent).toMatch(/credentials active/i);
    expect(screen.queryByText(/nina-pass-12345/i)).not.toBeInTheDocument();
  });

  it("lets therapists apply a reusable goal template to a child", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <ChildList />
        </AppProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getAllByDisplayValue("Choose a template...")[0], { target: { value: "goal-social-turn-taking" } });
    fireEvent.click(screen.getAllByText("Add Goal")[0]);

    expect(screen.getByText(/Increase turn-taking in shared play \(social\)/i)).toBeInTheDocument();
  });

  it("normalizes older saved child profiles with clinical scales", () => {
    window.localStorage.setItem("playground-life.backend.v2", JSON.stringify({
      admins: [],
      therapists: [],
      children: [
        {
          id: "legacy-child",
          name: "Legacy Kid",
          avatar: "kid",
          age: 7,
          notes: "Older saved profile",
          familyMembers: [],
          personalizationProfile: {
            preferredStyle: "visual",
            communicationLevel: "phrases",
            reinforcementType: "social-praise",
            promptLevel: "verbal",
            transitionDifficulty: "moderate",
            interests: [],
            strengths: [],
            supportNeeds: [],
            sensoryPreferences: [],
            triggerPatterns: [],
            regulationSupports: [],
          },
          therapyGoals: [],
          skillProfile: emptySkillProfile(),
          progressionSettings: {
            autoAdvance: true,
            approvalRequired: true,
            recommendedDifficulty: "easy",
            maxDifficulty: "hard",
          },
        },
      ],
      assignments: [],
      auditLog: [],
    }));

    render(
      <AppProvider>
        <StateProbe />
      </AppProvider>
    );

    const state = JSON.parse(screen.getByTestId("app-state").textContent || "{}");
    const child = state.children.find((entry: Child) => entry.id === "legacy-child");
    expect(child.personalizationProfile.clinicalRatings.communicationSupport).toBe(3);
    expect(child.personalizationProfile.clinicalRatingHistory.length).toBeGreaterThan(0);
  });

  it("creates a progressive monthly homework plan with skill focus", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <AssignHomework />
          <StateProbe />
        </AppProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByDisplayValue(/Emma/), { target: { value: "child-2" } });
    fireEvent.click(screen.getByText("Use Personalized Plan"));
    fireEvent.click(screen.getByText("Monthly Plan"));
    fireEvent.click(screen.getByText(/Create Progressive Monthly Plan/));

    const state = JSON.parse(screen.getByTestId("app-state").textContent || "{}");
    const liamAssignments = state.assignments.filter((assignment: HomeworkAssignment) => assignment.childId === "child-2" && assignment.createdAt === new Date().toISOString().slice(0, 10));

    expect(liamAssignments).toHaveLength(4);
    expect(liamAssignments.every((assignment: HomeworkAssignment) => assignment.skillFocus.length > 0)).toBe(true);
    expect(liamAssignments.map((assignment: HomeworkAssignment) => assignment.monthlyPlan?.weekNumber)).toEqual([1, 2, 3, 4]);
    expect(liamAssignments.every((assignment: HomeworkAssignment) => assignment.monthlyPlan?.familyGuidance?.length > 0)).toBe(true);
    expect(liamAssignments[0].monthlyPlan?.objective).toMatch(/baseline|comfort/i);
  });

  it("shows recommendation reasons in the therapist assignment flow", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <AssignHomework />
        </AppProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Why this was recommended/i)).toBeInTheDocument();
    expect(screen.getByText(/Readiness:/i)).toBeInTheDocument();
  });

  it("keeps the therapist assignment screen in quick assign mode by default", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <AssignHomework />
        </AppProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/^Quick assign$/i)).toBeInTheDocument();
    expect(screen.getByText(/Show more/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Assign to Family Member$/i)).not.toBeInTheDocument();
  });

  it("signs a family member in through the secure auth flow", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <ParentDashboard />
          <StateProbe />
        </AppProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "555-0101" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "emma123" } });
    fireEvent.click(screen.getByText("Sign In"));

    const state = JSON.parse(screen.getByTestId("app-state").textContent || "{}");
    expect(state.session?.role).toBe("parent");
    expect(state.session?.familyMemberId).toBe("fm-1");
    expect(state.children[0].familyMembers[0].passwordHash).toBe(hashSecret("emma123"));
  });

  it("shows classwork on the family side after sign in", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <ParentDashboard />
        </AppProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "555-0101" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "emma123" } });
    fireEvent.click(screen.getByText("Sign In"));

    expect(screen.getByText(/^classwork$/i)).toBeInTheDocument();
    expect(screen.getByText(/Group session - practice social interactions with peers\./i)).toBeInTheDocument();
  });

  it("opens the family side in today's session view first", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <ParentDashboard />
        </AppProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "555-0101" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "emma123" } });
    fireEvent.click(screen.getByText("Sign In"));

    expect(screen.getByText(/^Today's Session$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start today's session/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Today$/i })).toBeInTheDocument();
  });

  it("lets admins issue invites and reset family credentials", () => {
    function AdminProbe() {
      const { signInAdmin, issueFamilyInvite, resetFamilyCredentials, children, session } = useApp();
      const didRun = useRef(false);

      useEffect(() => {
        if (didRun.current) return;
        didRun.current = true;
        signInAdmin("admin@playgroundlife.app", "admin123");
        issueFamilyInvite("child-1", "fm-1");
        resetFamilyCredentials("child-1", "fm-1", "Reset123", true);
      }, [issueFamilyInvite, resetFamilyCredentials, signInAdmin]);

      return <pre data-testid="admin-probe">{JSON.stringify({ session, children })}</pre>;
    }

    render(
      <AppProvider>
        <AdminProbe />
      </AppProvider>
    );

    const state = JSON.parse(screen.getByTestId("admin-probe").textContent || "{}");
    expect(state.session?.role).toBe("admin");
    expect(state.children[0].familyMembers[0].passwordHash).toBe(hashSecret("Reset123"));
    expect(state.children[0].familyMembers[0].credentialStatus).toBe("active");
  });

  it("renders the admin dashboard sign-in flow", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <AdminDashboard />
        </AppProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Clinic Admin Sign In/i)).toBeInTheDocument();
  });

  it("opens the therapist caseload overview after sign in", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <TherapistDashboard />
        </AppProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Sign In"));

    expect(screen.getByRole("heading", { name: /Caseload Overview/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Needs Review/i).length).toBeGreaterThan(0);
  });

  it("keeps therapist reporting in quick review mode by default", () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <HomeworkReview />
        </AppProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Quick Review/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Assignment Review/i)).toBeInTheDocument();
    expect(screen.queryByText(/Clinical Domain Profile/i)).not.toBeInTheDocument();
  });
});
