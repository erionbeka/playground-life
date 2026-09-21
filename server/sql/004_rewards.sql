-- Reward economy persistence per child.

CREATE TABLE IF NOT EXISTS child_rewards (
  child_id uuid PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  stars integer NOT NULL DEFAULT 0 CHECK (stars >= 0),
  stickers text[] NOT NULL DEFAULT '{}',
  plays integer NOT NULL DEFAULT 0 CHECK (plays >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
