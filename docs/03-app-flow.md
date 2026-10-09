# Playground Life App Flow

**Purpose:** A role-based interaction map for the current application, including safe child-session exits and the production data boundary.

## 1. Primary workflow

```mermaid
flowchart TD
  A[Open Playground Life] --> B{Choose role or route}
  B --> T[Therapist sign in]
  B --> F[Family sign in]
  B --> D[Admin sign in]

  T --> T1[Select or create child profile]
  T1 --> T2[Set goals, supports, preferences]
  T2 --> T3[Choose activities and set assignment]
  T3 --> T4[Approve or adjust recommendation]
  T4 --> T5[Assign homework or classwork]

  F --> F1[Choose linked child]
  F1 --> F2[Today or To Do]
  F2 --> F3[Open activity introduction]
  F3 --> Q{Child chooses}
  Q -->|Start| G[Play activity]
  Q -->|Opt out or back| F2
  G -->|Break| BR[Breathing or regulation break]
  BR --> G
  G -->|Exit| EX[Confirm safe exit]
  EX --> F2
  G -->|Complete| R[Save result and mark progress]
  R --> F4[Show supportive completion]
  F4 --> F2

  D --> D1[Manage staff and family access]
  D1 --> D2[Review audit activity and operational watchlist]

  R --> T6[Therapist reviews results and plans next step]
```

## 2. Activity session detail

```mermaid
sequenceDiagram
  participant Family as Family member
  participant Child
  participant UI as GamePlayer
  participant Engine as Activity engine
  participant Data as App state/API

  Family->>UI: Open assigned activity
  UI->>Child: Show purpose, duration, supports, exit option
  Child->>UI: Start, opt out, or request support
  alt Child opts out
    UI-->>Family: Return to activity list
  else Child starts
    UI->>Engine: Supply activity config, difficulty, support level
    loop Play at child's pace
      Child->>Engine: Tap, point, gesture, AAC, speech, switch/dwell
      Engine-->>UI: Interaction and optional progress
      Child->>UI: Request break or exit when needed
    end
    alt Break
      UI-->>Child: Regulation support
      UI-->>Data: Minimal break event
    else Exit
      UI-->>Data: Minimal exit event when play began
      UI-->>Family: Return without a forced completion
    else Completion
      Engine-->>UI: Result metrics
      UI->>Data: Persist game result
      UI-->>Child: Chosen, sensory-safe completion feedback
    end
  end
```

## 3. Planning and review flow

| Step | Therapist action | System responsibility | Family/child-facing result |
|---|---|---|---|
| 1 | Select child | Load clinic-scoped profile, goals, preferences, prior results | None |
| 2 | Choose focus | Suggest categories/difficulty with explanation | Plan reflects support needs and interests |
| 3 | Compose assignment | Validate activity IDs, due date, mode, and support | Clear list of manageable activities |
| 4 | Approve/adjust | Record approval and override rationale | Family sees approved plan, not an opaque model decision |
| 5 | Review | Compare results and observed engagement | Next plan may hold, advance, step back, or request review |

## 4. Operational versus research data flow

```mermaid
flowchart LR
  P[Play and assignment events] --> O[Operational results and clinic review]
  O --> C{Recorded research consent and approved protocol?}
  C -->|No| K[Remain in operational care workflow]
  C -->|Yes| M[Minimize and de-identify]
  M --> V[Attach engine, content and schema versions]
  V --> E[Audited research export]
  E --> S[Approved feasibility/usability analysis]
```

Only the right-hand research path may produce pilot/research exports. It must never be a hidden consequence of ordinary child play.

## 5. Flow rules and exceptions

- **No active assignment:** family view explains that there is nothing scheduled and provides a calm return path; it does not fabricate a task.
- **Game not found/config invalid:** show a recoverable error, do not mark completion, and surface a therapist/admin-visible issue.
- **Network/API failure:** avoid claiming a saved result until the write succeeds; offer a safe retry or explicit local-demo state.
- **Access changes during a session:** stop data mutation, protect the child from abrupt error language, and return the adult to sign-in.
- **Overwhelm or disengagement:** exit/break must be immediately available, with no loss of rewards or negative progress indicator.

## 6. Navigation inventory

| Route | Current owner | Main destination |
|---|---|---|
| `/` | Role selector | Therapist or family route |
| `/therapist` | Therapist | Sign in, child list, planning, review |
| `/family` | Family | Sign in, child activity list, activity session |
| `/admin` | Clinic admin | Sign in, staff/family management, audit review |

The role selector currently highlights therapist and family; preserve a clear, authorized path to clinic administration when refining entry navigation.
