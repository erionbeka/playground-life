CREATE TABLE IF NOT EXISTS therapist_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE SET NULL,
  session_type text NOT NULL DEFAULT 'therapy',
  title text NOT NULL,
  notes text,
  homework text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS therapist_sessions_clinic_idx ON therapist_sessions (clinic_id);
CREATE INDEX IF NOT EXISTS therapist_sessions_therapist_idx ON therapist_sessions (therapist_id);
CREATE INDEX IF NOT EXISTS therapist_sessions_child_idx ON therapist_sessions (child_id);