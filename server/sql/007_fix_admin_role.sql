-- Ensure the seeded admin account actually has the admin role. Older seeds
-- inserted the row with a different role and the ON CONFLICT DO NOTHING clause
-- left it stale, which made admin-only endpoints return 403.
UPDATE users
SET role = 'admin', updated_at = now()
WHERE lower(email) = 'admin@playgroundlife.app'
  AND role <> 'admin';
