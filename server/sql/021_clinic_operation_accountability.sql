-- Clinic-scoped accountability for backup and retention operations.
--
-- backup_runs and retention_runs previously had no clinic_id, so an admin
-- from any clinic could trigger or view operations affecting the entire
-- database, with no way to attribute the operation to a specific clinic.
-- Add clinic_id to both tables so operations are attributable and queryable
-- by clinic.

ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS backup_runs_clinic_idx ON backup_runs(clinic_id) WHERE clinic_id IS NOT NULL;

ALTER TABLE retention_runs ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS retention_runs_clinic_idx ON retention_runs(clinic_id) WHERE clinic_id IS NOT NULL;
