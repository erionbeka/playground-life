-- Compliance layer: MFA, reset tokens, invitations, outbox, caseload, tuning, backups, retention.

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE children ADD COLUMN IF NOT EXISTS assigned_therapist_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS tuning jsonb;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reset_tokens_user_idx ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('invite','reset','notice')),
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_status_idx ON email_outbox(status, created_at DESC);

CREATE TABLE IF NOT EXISTS backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  location text,
  size_bytes bigint,
  checksum text,
  error text
);

CREATE TABLE IF NOT EXISTS retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  audit_deleted integer NOT NULL DEFAULT 0,
  traces_scrubbed integer NOT NULL DEFAULT 0,
  outbox_deleted integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS results_metrics_traces_idx ON game_results ((metrics->'trace')) WHERE metrics ? 'trace';
