#!/usr/bin/env python3
from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
import subprocess
import sys

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
    );
'''

NEW_ROUTE = '''    // First identify the account without locking a token row. Then lock the
    // account row so concurrent reset attempts for this user serialize.
    const candidate = await client.query<{ user_id: string }>(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       LIMIT 1`,
      [sha256(parsed.data.token)]
    );
    const candidateUserId = candidate.rows[0]?.user_id;
    if (!candidateUserId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }

    const account = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [candidateUserId]
    );
    if (account.rowCount !== 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }

    // Revalidate and lock the token only after acquiring the account lock.
    // Another reset for this account may have consumed it while we waited.
    const rows = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND user_id = $2
         AND used_at IS NULL AND expires_at > now()
       LIMIT 1 FOR UPDATE`,
      [sha256(parsed.data.token), candidateUserId]
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

    // A successful reset invalidates every outstanding reset link for the account.
    await client.query(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL`,
      [tokenRow.user_id]
    );
'''

OLD_TEST_MOCK = '''    transactionQueryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: "reset-1", user_id: "user-1" }] }) // locked token
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // update password
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // consume token
      .mockResolvedValueOnce({ rows: [] }) // audit
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
'''

NEW_TEST_MOCK = '''    transactionQueryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ user_id: "user-1" }] }) // find candidate account
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "user-1" }] }) // lock account
      .mockResolvedValueOnce({ rows: [{ id: "reset-1", user_id: "user-1" }] }) // revalidate and lock token
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // update password
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // invalidate all outstanding tokens
      .mockResolvedValueOnce({ rows: [] }) // audit
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
'''

OLD_TEST_ASSERTIONS = '''    expect(poolConnectMock).toHaveBeenCalledTimes(1);
    expect(transactionQueryMock.mock.calls[0][0]).toBe("BEGIN");
    expect(transactionQueryMock.mock.calls[1][0]).toContain("FOR UPDATE");
    expect(transactionQueryMock.mock.calls[1][1]).toEqual([tokenHash]);
    expect(transactionQueryMock.mock.calls[2][0]).toContain("session_version = session_version + 1");
    expect(transactionQueryMock.mock.calls[2][1]).toEqual(["hashed-NewPassword123", "user-1"]);
    expect(transactionQueryMock.mock.calls[3][0]).toContain("used_at IS NULL");
    expect(transactionQueryMock.mock.calls[5][0]).toBe("COMMIT");
'''

NEW_TEST_ASSERTIONS = '''    expect(poolConnectMock).toHaveBeenCalledTimes(1);
    expect(transactionQueryMock).toHaveBeenCalledTimes(8);
    expect(transactionQueryMock.mock.calls[0][0]).toBe("BEGIN");
    expect(transactionQueryMock.mock.calls[1][0]).toContain("SELECT user_id FROM password_reset_tokens");
    expect(transactionQueryMock.mock.calls[1][0]).not.toContain("FOR UPDATE");
    expect(transactionQueryMock.mock.calls[1][1]).toEqual([tokenHash]);
    expect(transactionQueryMock.mock.calls[2][0]).toContain("SELECT id FROM users");
    expect(transactionQueryMock.mock.calls[2][0]).toContain("FOR UPDATE");
    expect(transactionQueryMock.mock.calls[2][1]).toEqual(["user-1"]);
    expect(transactionQueryMock.mock.calls[3][0]).toContain("user_id = $2");
    expect(transactionQueryMock.mock.calls[3][0]).toContain("FOR UPDATE");
    expect(transactionQueryMock.mock.calls[3][1]).toEqual([tokenHash, "user-1"]);
    expect(transactionQueryMock.mock.calls[4][0]).toContain("session_version = session_version + 1");
    expect(transactionQueryMock.mock.calls[4][1]).toEqual(["hashed-NewPassword123", "user-1"]);
    expect(transactionQueryMock.mock.calls[5][0]).toContain("user_id = $1 AND used_at IS NULL");
    expect(transactionQueryMock.mock.calls[5][1]).toEqual(["user-1"]);
    expect(transactionQueryMock.mock.calls[7][0]).toBe("COMMIT");
'''

def fail(message: str) -> None:
    print(f"ERROR: {message}; no files changed.", file=sys.stderr)
    raise SystemExit(1)

def git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=False)

def main() -> None:
    if not (ROOT / ".git").exists():
        fail("Run from the Playground Life Git repository root")
    if not ROUTE.is_file() or not TEST.is_file():
        fail("Required route or test file is missing")

    route_text = ROUTE.read_text()
    test_text = TEST.read_text()

    if NEW_ROUTE in route_text and NEW_TEST_MOCK in test_text and NEW_TEST_ASSERTIONS in test_text:
        print("Reset-token hardening is already applied; no changes needed.")
        return

    required = [
        ("reset route block", route_text.count(OLD_ROUTE) == 1),
        ("reset test mock block", test_text.count(OLD_TEST_MOCK) == 1),
        ("reset test assertion block", test_text.count(OLD_TEST_ASSERTIONS) == 1),
    ]
    missing = [name for name, found in required if not found]
    if missing:
        fail("Expected exact source block not found: " + ", ".join(missing))

    backup_dir = ROOT / ".security-patch-backups" / (
        "reset-token-hardening-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    try:
        backup_dir.mkdir(parents=True, exist_ok=False)
    except FileExistsError:
        fail(f"Backup directory already exists: {backup_dir}")

    try:
        (backup_dir / "security.ts").write_text(route_text)
        (backup_dir / "security-routes.test.ts").write_text(test_text)
        ROUTE.write_text(route_text.replace(OLD_ROUTE, NEW_ROUTE, 1))
        updated_test = test_text.replace(OLD_TEST_MOCK, NEW_TEST_MOCK, 1)
        updated_test = updated_test.replace(OLD_TEST_ASSERTIONS, NEW_TEST_ASSERTIONS, 1)
        TEST.write_text(updated_test)

        check = git("diff", "--check")
        if check.returncode:
            raise RuntimeError("git diff --check failed:\n" + check.stdout + check.stderr)
    except Exception as exc:
        ROUTE.write_text(route_text)
        TEST.write_text(test_text)
        print(f"ERROR: {exc}", file=sys.stderr)
        print("Original files restored.", file=sys.stderr)
        raise SystemExit(1)

    print("Password-reset token concurrency hardening applied.")
    print(f"Backups: {backup_dir}")
    print("Changed files: server/routes/security.ts, server/test/security-routes.test.ts")
    print("No staging, commit, deployment, or service restart performed.")
    print("Next command: npx vitest run server/test/security-routes.test.ts")

if __name__ == "__main__":
    main()
