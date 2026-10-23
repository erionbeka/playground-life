-- Promote seeded admin to superadmin (isolated transaction)
UPDATE users SET role = 'superadmin' WHERE lower(email) = 'admin@playgroundlife.app' AND role = 'admin';