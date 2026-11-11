-- Auditable operator grant/revoke log.
--
-- Operator status (users.is_operator) gates whole-database backups. Changes
-- to is_operator must be recorded here so there is an immutable record of
-- who authorized the change, which account was affected, and when.
--
-- Only superadmins may grant or revoke operator status. Clinic admins cannot
-- self-escalate to operator; this enforcement happens at the API layer.

CREATE TABLE IF NOT EXISTS operator_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role user_role NOT NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('grant_operator', 'revoke_operator')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_audit_actor_idx ON operator_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS operator_audit_target_idx ON operator_audit_log(target_user_id, created_at DESC);
