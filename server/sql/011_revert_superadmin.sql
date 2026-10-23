-- Revert superadmin role to admin (superadmin removed)
UPDATE users SET role = 'admin' WHERE role = 'superadmin';