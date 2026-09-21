import { z } from "zod";

export const RESEARCH_EVENT_SCHEMA_VERSION = "1.0.0";

export const EVENT_SOURCES = ["child", "caregiver", "therapist", "system"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

export const EVENT_CATEGORIES = [
  "trial",
  "feedback",
  "help-request",
  "pause",
  "break",
  "quit",
  "restart",
  "adaptation",
  "technical-error",
  "caregiver-assist",
  "completion",
  "consent",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface ResearchEventProvenance {
  engine: string;
  contentVersion: string;
  activityId: string;
}

export interface ResearchEvent {
  schemaVersion: string;
  at: number;
  sessionId: string;
  source: EventSource;
  category: EventCategory;
  type: string;
  detail?: string;
  provenance: ResearchEventProvenance;
  coords?: { x: number; y: number };
}

const provenanceSchema = z.object({
  engine: z.string().min(1),
  contentVersion: z.string().regex(/^v\d+\.\d+\.\d+$/),
  activityId: z.string().min(1),
});

export const researchEventSchema = z.object({
  schemaVersion: z.string().min(1),
  at: z.number(),
  sessionId: z.string().min(1),
  source: z.enum(EVENT_SOURCES),
  category: z.enum(EVENT_CATEGORIES),
  type: z.string().min(1),
  detail: z.string().optional(),
  provenance: provenanceSchema,
  coords: z.object({ x: z.number(), y: z.number() }).optional(),
});

export type ResearchEventInput = z.input<typeof researchEventSchema>;

export function validateResearchEvent(event: ResearchEventInput): { ok: true } | { ok: false; issues: string[] } {
  const parsed = researchEventSchema.safeParse(event);
  if (parsed.success) return { ok: true };
  return { ok: false, issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
}

const CAREGIVER_MARKS = ["caregiver", "adult helped", "therapist"];

export function classifyEventSource(event: { type: string; detail?: string; category?: string }): EventSource {
  const haystack = `${String(event.detail || "")} ${event.type}`.toLowerCase();
  if (event.category === "caregiver-assist" || CAREGIVER_MARKS.some((mark) => haystack.includes(mark))) return "caregiver";
  if (event.category === "technical-error" || /error|technical|network|storage|failed to (load|save)/.test(haystack)) return "system";
  if (haystack.includes("therapist") || haystack.includes("assigned by")) return "therapist";
  return "child";
}