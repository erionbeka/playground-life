-- Preserve child records and their clinical history when a profile is archived.
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS children_active_clinic_idx
  ON children (clinic_id, created_at DESC)
  WHERE archived_at IS NULL;
