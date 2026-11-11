-- Explicit operator authorization for infrastructure-level operations.
--
-- A whole-database backup touches every clinic's data. Requiring only the
-- `admin` role is insufficient: a clinic admin should not be able to trigger
-- or even view backups of another clinic's data. Add an `is_operator` flag
-- so backup and other infrastructure operations can be gated behind an
-- explicit, auditable authorization decision rather than a role that happens
-- to be admin.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_operator boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_operator_idx ON users(is_operator) WHERE is_operator;
