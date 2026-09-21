-- Child-level analytics persistence: moods, regulation events, sensory preferences.

CREATE TABLE IF NOT EXISTS child_moods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  mood text NOT NULL CHECK (mood IN ('great', 'okay', 'meh', 'worried', 'overwhelmed')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moods_child_idx ON child_moods(child_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS child_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_child_idx ON child_events(child_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS child_preferences (
  child_id uuid PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sound_on boolean NOT NULL DEFAULT true,
  voice_on boolean NOT NULL DEFAULT true,
  calm_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
