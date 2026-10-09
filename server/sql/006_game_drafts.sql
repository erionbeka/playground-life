-- Migration 006: Therapist game drafts

CREATE TABLE IF NOT EXISTS game_drafts (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'changes_requested')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  emoji text NOT NULL DEFAULT '🎲',
  difficulty text NOT NULL DEFAULT 'easy'
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
  learning_goal text NOT NULL DEFAULT '',
  success_criteria text[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  supports_shared boolean NOT NULL DEFAULT true,
  engine text NOT NULL
    CHECK (engine IN ('matching', 'sorting', 'recognition', 'memory', 'choice-request', 'odd-one-out')),
  config jsonb NOT NULL DEFAULT '{}',
  origin_confirmed boolean NOT NULL DEFAULT false,
  originality_snapshot jsonb NOT NULL DEFAULT '{}',
  submitted_at timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_drafts_clinic_status_idx ON game_drafts (clinic_id, status);
CREATE INDEX IF NOT EXISTS game_drafts_author_idx ON game_drafts (author_id);
