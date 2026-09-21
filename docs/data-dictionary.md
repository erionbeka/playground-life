# Playground Data Dictionary

Version: 1.0.0 (2026-09-13)

This document describes every field in the data structures used for research, analytics, and clinical operations. All schemas are versioned to support future migrations.

---

## 1. Research Events v1

### 1.1 `child_events` table

| Column | Type | Description | Constraints | Example |
|--------|------|-------------|-------------|---------|
| `id` | uuid | Primary key | PK, gen_random_uuid() | `a1b2-c3d4-...` |
| `clinic_id` | uuid | Owning clinic | FK → clinics.id, NOT NULL | `c1inic-1...` |
| `child_id` | uuid | Subject child | FK → children.id, NOT NULL | `child-1...` |
| `event_type` | text | Event category | NOT NULL, max 60 chars | `session_started` |
| `detail` | text | Optional detail | max 200 chars | `game=matching,engine=matching` |
| `recorded_at` | timestamptz | Server timestamp | NOT NULL, DEFAULT now() | `2026-09-13T10:00:00Z` |

### 1.2 Event Types (controlled vocabulary)

| Event Type | Description | Typical Detail |
|------------|-------------|----------------|
| `session_started` | Game session began | `gameId,engine,contentVersion` |
| `session_completed` | Game session ended successfully | `score,durationMs,accuracy` |
| `session_exited` | Session ended via exit/quit | `reason,interactions` |
| `breathing_break` | Child requested breathing break | `triggeredBy=child\|caregiver` |
| `celebration_closed` | Celebration overlay dismissed | `button=Continue` |
| `quit_mid_game` | Session quit after interaction | `gameId,reason` |
| `scenario_started` | Social/regulation/flexible scenario | `scenarioId,context` |
| `choice` | Option selected in scenario | `scenario|optionLabel` |
| `bodySignal` | Body check-in response | `signalLabel` |
| `strategy` | Regulation strategy chosen | `strategyLabel` |
| `request` | Communication request made | `requestType|label|strategy|modality` |
| `category_match` | Item sorted to category | `itemLabel|binLabel` |
| `adaptation_recorded` | Explainable adaptation logged | `parameter|prior→new|reason` |

### 1.3 Provenance Fields (embedded in `detail`)

| Field | Type | Description |
|-------|------|-------------|
| `gameId` | string | Catalog game identifier (e.g., `game-195`) |
| `engine` | string | Engine key (e.g., `matching`, `choice-request`) |
| `contentVersion` | string | Game content version (e.g., `v1.0.0`) |
| `schemaVersion` | string | Event schema version (e.g., `1.0.0`) |

---

## 2. Game Results Columns (`game_results` table)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | uuid | PK | gen_random_uuid() |
| `assignment_id` | uuid | FK → assignments.id | NOT NULL |
| `child_id` | uuid | FK → children.id | NOT NULL |
| `game_id` | text | Catalog game ID | NOT NULL |
| `completed_at` | timestamptz | Completion timestamp | DEFAULT now() |
| `duration_seconds` | integer | Session length | >= 0 |
| `score` | integer | 0–100 scaled score | CHECK 0–100 |
| `interactions` | integer | Count of user actions | >= 0 |
| `metrics` | jsonb | Engine-specific metrics | DEFAULT `{}` |
| `skill_scores` | jsonb | Domain scores | DEFAULT `{}` |

### 2.1 Common `metrics` fields (per engine)

| Field | Type | Description |
|-------|------|-------------|
| `engine` | string | Engine identifier |
| `contentVersion` | string | Content pack version |
| `completedSuccessfully` | boolean | Mastery threshold met |
| `accuracy` | integer | 0–100 |
| `trials` | integer | Total trials |
| `correctTrials` | integer | Correct trials |
| `errors` | integer | Error count |
| `promptsNeeded` | integer | Hint/prompt count |
| `masteryThreshold` | integer | Mastery % required |
| `attemptsBySkill` | object | `{domain: count}` |
| `observations` | string[] | Clinician-facing notes |

---

## 3. Children Profile JSON (`children.personalization_profile`, `children.skill_profile`, `children.progression_settings`)

### 3.1 `personalization_profile`

```json
{
  "preferredEngines": ["matching", "sorting"],
  "sensory": {
    "calmModeDefault": false,
    "soundDefault": true,
    "voiceDefault": true,
    "reducedMotion": false
  },
  "language": "en",
  "avatar": "🧸",
  "interests": ["animals", "vehicles"],
  "version": "1.0.0"
}
```

### 3.2 `skill_profile`

```json
{
  "social": 65,
  "communication": 58,
  "attention": 62,
  "memory": 70,
  "executive_function": 55,
  "motor": 60,
  "academic": 63,
  "self_regulation": 59,
  "interoception": 52,
  "visual_discrimination": 68,
  "lastUpdated": "2026-09-13T10:00:00Z",
  "version": "1.0.0"
}
```

### 3.3 `progression_settings`

```json
{
  "autoAdvance": true,
  "approvalRequired": true,
  "recommendedDifficulty": "easy",
  "maxDifficulty": "medium",
  "version": "1.0.0"
}
```

---

## 4. Adaptation Decisions

### 4.1 `AdaptationDecision` interface

```typescript
interface AdaptationDecision {
  activityId: string;                    // Catalog game ID
  parameter: string;                     // "assignedDifficulty" | "supportLevel" | "readinessStage" | "cardsVisible" | "matchStyle" | "shuffleSeed" | ...
  priorValue: unknown;                   // Previous value
  newValue: unknown;                     // New value
  reason: string;                        // Human-readable rationale
  evidenceWindow: { sessionsBack: number }; // How many past sessions informed this
  source: "system" | "therapist" | "caregiver" | "child";
  approvedBy?: string;                   // User ID of approver (therapist/caregiver)
  at: string;                            // ISO timestamp
}
```

### 4.2 Source-specific conventions

| Source | Typical Parameters | Evidence Window |
|--------|-------------------|-----------------|
| `system` | `supportLevel`, `cardsVisible`, `shuffleSeed` | 3–5 sessions (auto-tuning) |
| `therapist` | `assignedDifficulty`, `supportLevel`, `readinessStage` | Monthly plan window (1–4 weeks) |
| `caregiver` | `calmMode`, `soundOn`, `voiceOn` | Session-level |
| `child` | `break_requested`, `stop_requested` | Immediate |

### 4.3 Example Decision Log

```json
[
  {
    "activityId": "game-195",
    "parameter": "supportLevel",
    "priorValue": "moderate",
    "newValue": "high",
    "reason": "Repeated help requests in last 3 sessions; monthly plan set to high support",
    "evidenceWindow": { "sessionsBack": 3 },
    "source": "therapist",
    "approvedBy": "therapist-1",
    "at": "2026-09-13T10:15:00.000Z"
  },
  {
    "activityId": "game-195",
    "parameter": "cardsVisible",
    "priorValue": 8,
    "newValue": 4,
    "reason": "Auto-tuned: high error rate with 8 visible cards",
    "evidenceWindow": { "sessionsBack": 2 },
    "source": "system",
    "at": "2026-09-13T11:00:00.000Z"
  }
]
```

---

## 5. Research Export Schema (v1.0.0)

### 5.1 Export Envelope

```json
{
  "exportId": "export_1694567890123",
  "clinicId": "clinic-uuid",
  "exportedAt": "2026-09-13T12:00:00.000Z",
  "protocolFlag": "pilot-2026",
  "includeFreeText": false,
  "dataDictionary": { ... },
  "children": [...],
  "gameResults": [...]
}
```

### 5.2 De-identification Rules

| Original Field | Export Field | Transformation |
|----------------|--------------|----------------|
| `children.id` | `participantId` | `participant_<HMAC-SHA256(clinicSalt + childId)[:12]>` |
| `game_results.child_id` | `participantId` | Same HMAC as above |
| `game_results.assignment_id` | `assignmentId` | `assignment_<HMAC(...>[:12]>` |
| `coordinates` | **omitted** | Stripped |
| `observations` (free text) | **omitted** unless `includeFreeText=true` | Conditional |
| `provenance` | **added** | `{engine, contentVersion, schemaVersion}` |

### 5.3 Clinic Boundary Enforcement

- Export queries include `WHERE clinic_id = $1`
- HMAC salt is per-clinic (`clinic-${clinicId}-research-salt-v1`)
- Cross-clinic exports return 403

---

## 6. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-09-13 | Initial release: research events v1, game_results, children profiles, adaptation decisions, research export v1 |

---

## 7. Migration Notes

- Migration `005_research.sql` adds: `research_consent`, `research_consent_version`, `research_consent_at`, `research_consent_by` to `children`; `schema_migrations` table; `research_exports` table.
- Migration runner (`server/migration.ts`) tracks applied versions in `schema_migrations(version)` and applies only pending `.sql` files in filename order.