-- Promote the seeded clinic admin to superadmin so they can manage other admins.
UPDATE users SET role = 'superadmin' WHERE lower(email) = 'admin@playgroundlife.app' AND role = 'admin';