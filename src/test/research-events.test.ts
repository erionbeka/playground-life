import { describe, expect, it } from "vitest";
import {
  classifyEventSource,
  RESEARCH_EVENT_SCHEMA_VERSION,
  researchEventSchema,
  validateResearchEvent,
} from "@/lib/researchEvents";
import { createSessionRecorder } from "@/lib/gameAnalytics";
import { allGames } from "@/data/games";

const matchingGame = allGames.find((game) => game.engine === "matching");
const baseEvent = {
  schemaVersion: RESEARCH_EVENT_SCHEMA_VERSION,
  at: 1234,
  sessionId: "session-1",
  source: "child",
  category: "trial",
  type: "trial_completed",
  detail: "matched pair",
  provenance: { engine: "matching", contentVersion: "v1.0.0", activityId: matchingGame?.id ?? "game-001" },
};

describe("research event schema v1", () => {
  it("accepts every source and category union value", () => {
    const sources = ["child", "caregiver", "therapist", "system"] as const;
    const categories = [
      "trial", "feedback", "help-request", "pause", "break", "quit",
      "restart", "adaptation", "technical-error", "caregiver-assist", "completion", "consent",
    ] as const;
    for (const source of sources) {
      for (const category of categories) {
        const result = researchEventSchema.safeParse({ ...baseEvent, source, category });
        expect(result.success).toBe(true);
      }
    }
  });

  it("rejects events missing schemaVersion or provenance contentVersion", () => {
    expect(validateResearchEvent({ ...baseEvent, schemaVersion: undefined } as never).ok).toBe(false);
    expect(
      validateResearchEvent({ ...baseEvent, provenance: { engine: "matching", activityId: "game-001" } } as never).ok
    ).toBe(false);
    expect(validateResearchEvent(baseEvent).ok).toBe(true);
  });

  it("classifies event sources from type and detail", () => {
    expect(classifyEventSource({ ...baseEvent, type: "pause_requested", detail: "child tapped break" })).toBe("child");
    expect(classifyEventSource({ ...baseEvent, category: "break", type: "breathing_break" })).toBe("child");
    expect(classifyEventSource({ ...baseEvent, category: "quit", type: "quit_mid_game" })).toBe("child");
    expect(classifyEventSource({ ...baseEvent, category: "caregiver-assist", type: "caregiver_assist", detail: "adult helped tap" })).toBe("caregiver");
    expect(classifyEventSource({ ...baseEvent, category: "technical-error", type: "network_error" })).toBe("system");
  });

  it("records provenance and schema version in captured session traces", () => {
    const game = allGames.find((entry) => entry.engine === "matching");
    if (!game) throw new Error("no matching game in catalog");
    const rec = createSessionRecorder(game.id);
    rec.event("pause_requested", "break");
    rec.trial({ stimulus: "a+b", correct: true });
    const trace = rec.trace();
    expect(trace.schemaVersion).toBe(RESEARCH_EVENT_SCHEMA_VERSION);
    expect(trace.provenance).toMatchObject({ engine: "matching", activityId: game.id });
  });
});