-- Add superadmin role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';

-- Promote the seeded clinic admin to superadmin so they can manage other admins.
UPDATE users SET role = 'superadmin' WHERE lower(email) = 'admin@playgroundlife.app' AND role = 'admin';