#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
ROUTE = ROOT / "server/routes/security.ts"
TEST = ROOT / "server/test/security-routes.test.ts"

OLD_ROUTE = '''    const rows = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       LIMIT 1 FOR UPDATE`,
      [sha256(parsed.data.token)]
    );
    const tokenRow = rows.rows[0];
    if (!tokenRow) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }

    const updated = await client.query(
      `UPDATE users SET password_hash = $1,
         session_version = session_version + 1, updated_at = now()
       WHERE id = $2`,
      [passwordHash, tokenRow.user_id]
    );
    if (updated.rowCount !== 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }
    await client.query(
      "UPDATE password_reset_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL",
      [tokenRow.id]
    );'''

NEW_ROUTE = '''    // Resolve the account first without locking the token. Locking the user
    // row before the token prevents two different reset links for the same
    // account from deadlocking while one transaction invalidates all links.
    const accountRows = await client.query<{ user_id: string }>(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       LIMIT 1`,
      [sha256(parsed.data.token)]
    );
    const userId = accountRows.rows[0]?.user_id;
    if (!userId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }

    const accountLock = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (accountLock.rowCount !== 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }

    // Revalidate after obtaining the account lock. A concurrent reset may
    // have consumed this token while this transaction was waiting.
    const rows = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND user_id = $2
         AND used_at IS NULL AND expires_at > now()
       LIMIT 1 FOR UPDATE`,
      [sha256(parsed.data.token), userId]
    );
    const tokenRow = rows.rows[0];
    if (!tokenRow) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }

    const updated = await client.query(
      `UPDATE users SET password_hash = $1,
         session_version = session_version + 1, updated_at = now()
       WHERE id = $2`,
      [passwordHash, tokenRow.user_id]
    );
    if (updated.rowCount !== 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }
    // A successful password reset invalidates every outstanding link for
    // this account, including links issued before this one.
    await client.query(
      "UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL",
      [tokenRow.user_id]
    );'''

OLD_TEST_SETUP = '''      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: "reset-1", user_id: "user-1" }] }) // locked token
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // update password
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // consume token
      .mockResolvedValueOnce({ rows: [] }) // audit
      .mockResolvedValueOnce({ rows: [] }); // COMMIT'''

NEW_TEST_SETUP = '''      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ user_id: "user-1" }] }) // find account for token
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "user-1" }] }) // lock account
      .mockResolvedValueOnce({ rows: [{ id: "reset-1", user_id: "user-1" }] }) // revalidated, locked token
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // update password
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // invalidate all outstanding tokens
      .mockResolvedValueOnce({ rows: [] }) // audit
      .mockResolvedValueOnce({ rows: [] }); // COMMIT'''

OLD_ASSERTIONS = '''    expect(transactionQueryMock).toHaveBeenCalledTimes(1);
    expect(transactionQueryMock.mock.calls[0][0]).toBe("BEGIN");
    expect(transactionQueryMock.mock.calls[1][0]).toContain("FOR UPDATE");
    expect(transactionQueryMock.mock.calls[1][1]).toEqual([tokenHash]);
    expect(transactionQueryMock.mock.calls[2][0]).toContain("session_version = session_version + 1");
    expect(transactionQueryMock.mock.calls[2][1]).toEqual(["hashed-NewPassword123", "user-1"]);
    expect(transactionQueryMock.mock.calls[3][0]).toContain("used_at IS NULL");
    expect(transactionQueryMock.mock.calls[5][0]).toBe("COMMIT");'''

NEW_ASSERTIONS = '''    expect(transactionQueryMock).toHaveBeenCalledTimes(1);
    expect(transactionQueryMock.mock.calls[0][0]).toBe("BEGIN");
    expect(transactionQueryMock.mock.calls[1][0]).toContain("FROM password_reset_tokens");
    expect(transactionQueryMock.mock.calls[1][1]).toEqual([tokenHash]);
    expect(transactionQueryMock.mock.calls[2][0]).toContain("FROM users");
    expect(transactionQueryMock.mock.calls[2][0]).toContain("FOR UPDATE");
    expect(transactionQueryMock.mock.calls[2][1]).toEqual(["user-1"]);
    expect(transactionQueryMock.mock.calls[3][0]).toContain("FOR UPDATE");
    expect(transactionQueryMock.mock.calls[3][1]).toEqual([tokenHash, "user-1"]);
    expect(transactionQueryMock.mock.calls[4][0]).toContain("session_version = session_version + 1");
    expect(transactionQueryMock.mock.calls[4][1]).toEqual(["hashed-NewPassword123", "user-1"]);
    expect(transactionQueryMock.mock.calls[5][0]).toContain("UPDATE password_reset_tokens");
    expect(transactionQueryMock.mock.calls[5][0]).toContain("user_id = $1");
    expect(transactionQueryMock.mock.calls[5][1]).toEqual(["user-1"]);
    expect(transactionQueryMock.mock.calls[7][0]).toBe("COMMIT");'''

def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

def git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        fail(f"git {' '.join(args)} failed:\\n{result.stderr.strip()}")
    return result.stdout.strip()

def main() -> None:
    if not (ROOT / ".git").exists():
        fail("Run this script from inside the Playground Life repository.")
    if not ROUTE.is_file() or not TEST.is_file():
        fail("Expected server/routes/security.ts and server/test/security-routes.test.ts.")

    route_text = ROUTE.read_text(encoding="utf-8")
    test_text = TEST.read_text(encoding="utf-8")

    if OLD_ROUTE not in route_text:
        if NEW_ROUTE in route_text:
            fail("The route patch appears to be already applied; no files changed.")
        fail("Expected reset-confirm route block not found. Source may differ; no files changed.")
    if OLD_TEST_SETUP not in test_text:
        fail("Expected reset test mock sequence not found; no files changed.")
    if OLD_ASSERTIONS not in test_text:
        fail("Expected reset test assertions not found; no files changed.")

    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = ROOT / ".security-patch-backups" / f"reset-token-hardening-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)

    original_route = route_text
    original_test = test_text
    (backup_dir / "security.ts").write_text(original_route, encoding="utf-8")
    (backup_dir / "security-routes.test.ts").write_text(original_test, encoding="utf-8")

    updated_route = route_text.replace(OLD_ROUTE, NEW_ROUTE, 1)
    updated_test = test_text.replace(OLD_TEST_SETUP, NEW_TEST_SETUP, 1)
    updated_test = updated_test.replace(OLD_ASSERTIONS, NEW_ASSERTIONS, 1)

    try:
        ROUTE.write_text(updated_route, encoding="utf-8")
        TEST.write_text(updated_test, encoding="utf-8")
        git("diff", "--check")
    except Exception as exc:
        ROUTE.write_text(original_route, encoding="utf-8")
        TEST.write_text(original_test, encoding="utf-8")
        fail(f"Patch failed validation; original files restored. Backup: {backup_dir}. {exc}")

    print("Reset-token hardening patch applied.")
    print(f"Backups: {backup_dir}")
    print("Changed files:")
    print("  - server/routes/security.ts")
    print("  - server/test/security-routes.test.ts")
    print()
    print("Next checks:")
    print("  npx vitest run server/test/security-routes.test.ts")
    print("  npm test")
    print("  npm run build")
    print("  git diff --check")
    print()
    print("No files were staged or committed. No deployment or service restart was performed.")

if __name__ == "__main__":
    main()
