-- Migration 005: Research consent columns and research export tables

-- Add research consent columns to children table
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS research_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS research_consent_version text,
  ADD COLUMN IF NOT EXISTS research_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS research_consent_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- Create schema_migrations table for versioned migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Create research_export table for logging exports
CREATE TABLE IF NOT EXISTS research_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  consent_filter_version text,
  include_free_text boolean NOT NULL DEFAULT false,
  record_count integer,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  completed_at timestamptz,
  error text
);

-- Index for research exports
CREATE INDEX IF NOT EXISTS research_exports_clinic_idx ON research_exports(clinic_id);
CREATE INDEX IF NOT EXISTS research_exports_status_idx ON research_exports(status);

-- Add foreign key for children.research_consent_by if not exists
DO $$ BEGIN
  ALTER TABLE children
    ADD CONSTRAINT children_research_consent_by_fkey
    FOREIGN KEY (research_consent_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;