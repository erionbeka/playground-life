-- Clinic-scoped integrity for family-child links and the email outbox.
--
-- A family-child link must reference a child that belongs to the same clinic,
-- so a link can never be used to reach a child through the wrong clinic even
-- if application code forgets to check both sides of the relationship.
-- The composite unique constraint makes the link unique within a clinic,
-- which is the correct scope now that links carry clinic_id.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'children_id_clinic_id_key' AND conrelid = 'children'::regclass
  ) THEN
    ALTER TABLE children ADD CONSTRAINT children_id_clinic_id_key UNIQUE (clinic_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_child_links_clinic_child_fkey' AND conrelid = 'family_child_links'::regclass
  ) THEN
    ALTER TABLE family_child_links
      ADD CONSTRAINT family_child_links_clinic_child_fkey
      FOREIGN KEY (clinic_id, child_id) REFERENCES children (clinic_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_child_links_clinic_scoped_unique' AND conrelid = 'family_child_links'::regclass
  ) THEN
    ALTER TABLE family_child_links
      ADD CONSTRAINT family_child_links_clinic_scoped_unique
      UNIQUE (clinic_id, child_id, user_id);
  END IF;
END $$;

-- Tag outbox rows with the clinic they belong to so retention and delivery
-- auditing can be clinic-scoped. Existing rows keep a null clinic_id.
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS email_outbox_clinic_idx ON email_outbox(clinic_id) WHERE clinic_id IS NOT NULL;
