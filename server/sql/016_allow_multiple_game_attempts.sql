-- Allow multiple independent attempts for the same game in one assignment.
-- Retry idempotency is enforced by game_results.submission_id (migration 015).

ALTER TABLE game_results
  DROP CONSTRAINT IF EXISTS game_results_assignment_id_game_id_key;
