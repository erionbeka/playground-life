-- Add superadmin role (isolated transaction)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';