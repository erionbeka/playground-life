# Playground Life Product Requirements Document

**Document status:** Codebase-grounded working requirements  
**Product:** Playground Life  
**Audience:** Clinic administrators, therapists, families, product and engineering teams  
**Scope:** The current React application and its Express/PostgreSQL production foundation

## 1. Product decision

Playground Life is a clinic-supported home-and-clinic activity platform for autistic children. Its job is to make structured practice feel predictable, voluntary, and enjoyable for children while giving therapists and families a shared, understandable plan. It is not a diagnostic tool and must not make clinical-efficacy claims until a documented pilot supports them.

The product already contains role-specific dashboards, assignments, a 192-item activity catalogue, multiple play engines, caregiver-facing session completion, progress review, personalization, and a backend foundation. The near-term product goal is to make those parts reliably work together in a real clinic workflow without turning child play into surveillance or a compliance game.

## 2. Users and outcomes

| User | Primary job | Successful outcome |
|---|---|---|
| Child | Play an activity with an understandable beginning, choices, help, and a safe ending | Can participate, pause, ask for help, or stop without penalty |
| Family member | Understand and support an assigned home activity | Can find today's plan, co-play when asked, and see completion clearly |
| Therapist | Turn goals and observed needs into manageable practice | Can set goals, select activities, set support/difficulty, and review useful results |
| Clinic administrator | Operate a clinic safely | Can manage staff and family access and inspect audit activity |
| Research/pilot team | Learn whether the workflow is feasible | Uses only consented, minimized, de-identified data with a documented protocol |

## 3. Product principles

1. **Autonomy before completion.** Exit, break, AAC/gesture response, and opting out are valid outcomes.
2. **One plan, three understandable views.** A therapist's intent should appear as a child-ready activity and a family-ready instruction, not as clinical jargon.
3. **Adaptation must be explainable and reversible.** Every change in difficulty or support needs a human-readable reason and therapist oversight where configured.
4. **No normative social scoring.** Social activities must support multiple valid communication styles; they must never reward forced eye contact, masking, or compliance with a single social style.
5. **Evidence is separate from marketing.** Operational data supports care delivery. Research data requires active consent, versioning, minimization, and protocol governance.

## 4. Core requirements

### 4.1 Role access and clinic setup

- The landing screen must present therapist and family paths; the application must retain the admin route for clinic operations.
- Administrators must be able to create staff accounts, manage family onboarding/credentials, and review audit activity.
- Authentication and authorization must be clinic-scoped. A user may access only records belonging to their clinic and permitted role.
- Demo/local browser state may support UI demonstration only; real clinic data must use the API and PostgreSQL path.

### 4.2 Therapist planning

- Therapists must create and maintain child profiles, goals, support needs, interests, sensory preferences, and progression settings.
- Therapists must create homework or classwork assignments containing one or more catalog activity IDs, a difficulty, mode, due date, skill focus, and optional support level.
- The system may recommend difficulty, categories, or a monthly plan, but must display why and preserve therapist approval or adjustment.
- Therapists must review results at child, assignment, and activity levels, including completion, duration, score, interactions, and available engine-specific metrics.

### 4.3 Family session

- Families must be able to sign in, select an assigned session, view today's/to-do activities, and complete activities one at a time.
- Every activity introduction must state what the child will do, approximate length, support level, success markers, adult role, and how to pause or stop.
- Families must be able to leave a session without creating a forced-success result. A mid-play exit should be recorded only as the minimum event required for the agreed operational purpose.
- Completion must update the assignment and return an understandable result to therapist review.

### 4.4 Child play experience

- Activities must offer short, predictable rounds and child-friendly instructions.
- Supported response modes include tap, point, gesture, spoken word, and AAC; no individual mode may be required as the only valid response.
- Sensory controls must support sound, voice, calm/reduced-motion choices, and a breathing break. Reduced-motion mode must remove animated background behavior rather than merely reducing its speed.
- Activities must use child-selected interests and reinforcement only when helpful, with no loss or punishment for stopping.

### 4.5 Activity catalogue

- The catalogue must retain stable activity IDs, content versions, category, difficulty, age range, learning goal, adult prompt, autism supports, success criteria, and estimated minutes.
- New catalogue entries must declare an existing engine or add a tested engine; theme/configuration variants must not be described as new mechanics.
- Current domains include matching, sequencing, sorting, tapping, social practice, building, recognition, counting, memory, emotions, language, motor, and daily living.

### 4.6 Measurement, privacy, and research

- Operational results must support assignment and progress review without implying diagnosis or efficacy.
- Research export must require recorded research consent, clinic scoping, de-identification, a data dictionary, and schema/content provenance.
- Free text and unnecessary identifiers must be excluded by default. Coordinates must not be exported.
- Prior to a live pilot, the clinic must complete the consent, security, retention, incident response, access-review, and validation procedures already present in `docs/`.

## 5. Non-goals

- Diagnosing autism, predicting outcomes, or ranking children.
- Replacing professional clinical judgment.
- Requiring spoken language, eye contact, speed, or uninterrupted completion.
- Treating the existing catalogue count as proof of 192 distinct underlying mechanics.
- Releasing real PHI/PII workflows before the documented external security/privacy review and pilot approval are complete.

## 6. Success measures

| Area | Measure | Interpretation |
|---|---|---|
| Child usability | Child/caregiver-reported ability to pause, stop, or ask for help | Autonomy safeguard, not a performance score |
| Family workflow | Assigned sessions completed or intentionally skipped with reason | Shows plan clarity and fit |
| Therapist workflow | Time to assign and review; recommendation usefulness | Measures workflow value |
| Accessibility | Keyboard, switch/dwell, reduced-motion, AAC and sensory-control task success | Confirms input and sensory inclusivity |
| Pilot safety | Count and severity of unresolved privacy, safety, or accessibility issues | Must be acceptable before expansion |

## 7. Release acceptance criteria

- A therapist can create a child, goal, and approved assignment; a linked family can complete or intentionally exit a session; the therapist can review the resulting state.
- Every playable engine handles start, interaction, completion, exit, and break safely and without a crash.
- A child can use configured supported response/input modes and reduce sensory intensity without losing the activity.
- Authorization is enforced server-side for every production API route, including clinic isolation.
- Research export is unavailable without explicit recorded consent and returns de-identified, versioned records only.
- Product language uses feasibility/usability framing until an approved pilot supplies evidence.

## 8. Open product decisions

1. Define a standard, caregiver-friendly meaning of a deliberately skipped session and whether it should affect therapist review.
2. Confirm the operational definition of each catalog "activity" versus unique gameplay mechanic for future planning and reporting.
3. Specify which roles may override automatic adaptation and for how long an override persists.
4. Choose an approved pilot outcome set and consent version before collecting any research data.
