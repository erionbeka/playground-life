-- Phase 1: result identity, submitter provenance, and review history.
-- Existing results remain explicitly unreviewed.

ALTER TABLE game_results
  ADD COLUMN IF NOT EXISTS submission_id uuid;

UPDATE game_results
SET submission_id = gen_random_uuid()
WHERE submission_id IS NULL;

ALTER TABLE game_results
  ALTER COLUMN submission_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN submission_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS game_results_submission_id_uidx
  ON game_results(submission_id);

ALTER TABLE game_results
  ADD COLUMN IF NOT EXISTS review_status text;

UPDATE game_results
SET review_status = 'legacy_unreviewed'
WHERE review_status IS NULL;

ALTER TABLE game_results
  ALTER COLUMN review_status SET DEFAULT 'pending',
  ALTER COLUMN review_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'game_results_review_status_check'
      AND conrelid = 'game_results'::regclass
  ) THEN
    ALTER TABLE game_results
      ADD CONSTRAINT game_results_review_status_check
      CHECK (review_status IN (
        'legacy_unreviewed',
        'pending',
        'accepted',
        'rejected',
        'correction_requested'
      ));
  END IF;
END $$;

ALTER TABLE game_results
  ADD COLUMN IF NOT EXISTS submitted_by uuid
    REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_by_role text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'game_results_submitted_by_role_check'
      AND conrelid = 'game_results'::regclass
  ) THEN
    ALTER TABLE game_results
      ADD CONSTRAINT game_results_submitted_by_role_check
      CHECK (
        submitted_by_role IS NULL
        OR submitted_by_role IN ('admin', 'therapist', 'parent', 'superadmin')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS game_results_child_review_status_idx
  ON game_results(child_id, review_status, completed_at DESC);

-- Deliberately retain result_id without a cascading foreign key:
-- review history must survive deletion of its source result.
CREATE TABLE IF NOT EXISTS game_result_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL,
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewer_role text NOT NULL
    CHECK (reviewer_role IN ('admin', 'therapist', 'superadmin')),
  decision text NOT NULL
    CHECK (decision IN ('accepted', 'rejected', 'correction_requested')),
  rationale text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_result_reviews_rationale_check
    CHECK (decision = 'accepted' OR length(trim(rationale)) > 0)
);

CREATE INDEX IF NOT EXISTS game_result_reviews_result_created_idx
  ON game_result_reviews(result_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_game_result_review_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'game_result_reviews is append-only'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS game_result_reviews_append_only
  ON game_result_reviews;

CREATE TRIGGER game_result_reviews_append_only
  BEFORE UPDATE OR DELETE ON game_result_reviews
  FOR EACH ROW
  EXECUTE FUNCTION prevent_game_result_review_mutation();
