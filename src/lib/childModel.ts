import { getGameSkillDomains } from "@/lib/skills";
import type { SkillDomain } from "@/context/AppContext";

/**
 * Child ability model v2.
 *
 * Per skill domain we track:
 *  - ability: EWMA of session independence (0-100)
 *  - medianLatency + consistency: fluency & stability signals
 *  - samples + updatedAt: confidence and decay
 *
 * Decay-on-read: unused domains drift toward baseline so stale ability never
 * drives decisions. Confidence weights every recommendation.
 */

export type StartTier = "easy" | "medium" | "hard";

export interface DomainAbility {
  ability: number;
  samples: number;
  updatedAt: string;
  medianLatencyMs?: number;
  consistency?: number;
  /** Last N session independence values, oldest first — powers trajectory sparklines. */
  history?: number[];
}

type ModelStore = Record<string, Record<string, DomainAbility>>;

const STORAGE_KEY = "pp-ability-model-v2";
const INIT_ABILITY = 55;
const ALPHA = 0.35;
const DECAY_PER_DAY = 0.35; // points/day after 7 idle days
const DECAY_FREE_DAYS = 7;
const BASELINE_FLOOR = INIT_ABILITY - 20;

function loadModel(): ModelStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ModelStore) : {};
  } catch {
    return {};
  }
}

function saveModel(model: ModelStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    /* storage unavailable */
  }
}

export function domainForSkill(skill: string): SkillDomain {
  const key = skill.toLowerCase();
  if (/memory|closure|recall/.test(key)) return "attention";
  if (/visual|recognition|discrimination|symmetry|vocabulary|listening/.test(key)) return "communication";
  if (/pattern|sequenc|prediction|order/.test(key)) return "sequencing";
  if (/motor|trace|precision|response/.test(key)) return "motor";
  if (/emotional|feeling|regulation|perspective/.test(key)) return "emotional-regulation";
  if (/daily|routine|independence/.test(key)) return "daily-living";
  if (/social|sharing|turn|cooperat/.test(key)) return "social";
  if (/numeracy|count|number/.test(key)) return "academic";
  if (/categoriz|reasoning|rule/.test(key)) return "attention";
  return "attention";
}

/** Effective ability after idle decay — never mutates stored data. */
export function effectiveAbility(entry: DomainAbility): number {
  const idleDays = Math.max(
    0,
    (Date.now() - new Date(entry.updatedAt).getTime()) / 86_400_000 - DECAY_FREE_DAYS
  );
  const decayed = entry.ability - idleDays * DECAY_PER_DAY;
  return Math.max(BASELINE_FLOOR, Math.round(decayed * 100) / 100);
}

export function confidence(entry: DomainAbility | undefined): number {
  if (!entry) return 0;
  return Math.min(1, entry.samples / 5);
}

export function updateFromSession(
  childId: string,
  attemptsBySkill: Record<string, number> | undefined,
  independenceRate: number,
  extras?: { medianLatencyMs?: number; consistency?: number }
): void {
  if (!childId) return;
  const model = loadModel();
  const profile = (model[childId] ||= {});
  const domains = new Set<SkillDomain>();
  for (const skill of Object.keys(attemptsBySkill || {})) domains.add(domainForSkill(skill));
  if (!domains.size) domains.add("attention");

  const nowIso = new Date().toISOString();
  for (const domain of domains) {
    const prev = profile[domain];
    const base = prev ? effectiveAbility(prev) : INIT_ABILITY;
    const newAbility = Math.round((base * (1 - ALPHA) + independenceRate * ALPHA) * 100) / 100;
    profile[domain] = {
      ability: newAbility,
      samples: (prev?.samples || 0) + 1,
      updatedAt: nowIso,
      medianLatencyMs: extras?.medianLatencyMs ?? prev?.medianLatencyMs,
      consistency: extras?.consistency ?? prev?.consistency,
      history: [...(prev?.history || []), independenceRate].slice(-12),
    };
  }
  saveModel(model);
}

export function getAbilityProfile(childId: string): Partial<Record<SkillDomain, DomainAbility>> {
  return loadModel()[childId] || {};
}

export interface DomainSummary {
  domain: SkillDomain;
  ability: number;
  confidence: number;
  samples: number;
}

/** All tracked domains for a child, strongest first, decay-adjusted. */
export function domainSummary(childId: string): DomainSummary[] {
  const profile = getAbilityProfile(childId);
  return Object.entries(profile)
    .map(([domain, entry]) => ({
      domain: domain as SkillDomain,
      ability: effectiveAbility(entry),
      confidence: confidence(entry),
      samples: entry.samples,
    }))
    .sort((a, b) => b.ability - a.ability);
}

export function startTierForDomains(childId: string, domains: SkillDomain[]): StartTier {
  const profile = getAbilityProfile(childId);
  const scored = domains
    .map((domain) => ({ entry: profile[domain], conf: confidence(profile[domain]) }))
    .filter((s) => s.entry);

  const totalConfidence = scored.reduce((sum, s) => sum + s.conf, 0);
  if (!scored.length || totalConfidence < 0.8) return "medium"; // not enough evidence yet

  const weighted = scored.reduce((sum, s) => sum + effectiveAbility(s.entry!) * s.conf, 0) / totalConfidence;
  if (weighted >= 72) return "hard";
  if (weighted <= 45) return "easy";
  return "medium";
}

export function startTierForGame(childId: string, gameId: string): StartTier {
  let domains: SkillDomain[] = [];
  try {
    domains = getGameSkillDomains(gameId) as SkillDomain[];
  } catch {
    domains = [];
  }
  if (!domains.length) domains = ["attention"];
  return startTierForDomains(childId, domains);
}

export function weakestDomains(childId: string, count = 2): SkillDomain[] {
  return domainSummary(childId)
    .filter((d) => d.samples >= 2)
    .slice(-count)
    .reverse()
    .map((d) => d.domain);
}

/** Independence history for one domain, oldest first — feeds trajectory charts. */
export function domainTrajectory(childId: string, domain: SkillDomain): number[] {
  return getAbilityProfile(childId)[domain]?.history || [];
}

export function strongestDomain(childId: string): { domain: SkillDomain; ability: number } | null {
  const all = domainSummary(childId).filter((d) => d.samples >= 2);
  return all.length ? { domain: all[0].domain, ability: all[0].ability } : null;
}
