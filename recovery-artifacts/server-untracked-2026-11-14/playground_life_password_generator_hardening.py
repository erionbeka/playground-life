#!/usr/bin/env python3
"""Safely replace Playground Life's temporary-password generator.

Run from the repository root:
    python3 playground_life_password_generator_hardening.py

Only src/components/admin/AdminDashboard.tsx is changed. A timestamped backup
is created before writing. No staging, commit, deployment, or service restart.
"""

from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

TARGET = Path("src/components/admin/AdminDashboard.tsx")

OLD = """function generateTemporaryPassword(): string {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = `${lower}${upper}${digits}`;
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  const characters = [
    lower[bytes[0] % lower.length],
    upper[bytes[1] % upper.length],
    digits[bytes[2] % digits.length],
  ];
  for (let index = 3; index < bytes.length; index += 1) {
    characters.push(all[bytes[index] % all.length]);
  }
  // Fisher-Yates shuffle; the password is generated locally and is never
  // returned by the API or transmitted by email.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = bytes[index] % (index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}"""

NEW = """function generateTemporaryPassword(): string {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = `${lower}${upper}${digits}`;

  // Rejection sampling avoids the modulo bias caused by value % alphabet.length.
  // Each call draws fresh cryptographic randomness from the Web Crypto API.
  const randomIndex = (maxExclusive: number): number => {
    const range = 0x1_0000_0000;
    const limit = range - (range % maxExclusive);
    const value = new Uint32Array(1);

    do {
      crypto.getRandomValues(value);
    } while (value[0] >= limit);

    return value[0] % maxExclusive;
  };

  const characters = [
    lower[randomIndex(lower.length)],
    upper[randomIndex(upper.length)],
    digits[randomIndex(digits.length)],
  ];

  while (characters.length < 16) {
    characters.push(all[randomIndex(all.length)]);
  }

  // Fisher-Yates shuffle with independent, unbiased cryptographic draws.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}"""

def main() -> int:
    if not TARGET.is_file():
        print(f"ERROR: {TARGET} not found. Run this script from the repository root.")
        return 1

    source = TARGET.read_text(encoding="utf-8")
    count = source.count(OLD)

    if count != 1:
        print(
            "ERROR: Expected exactly one matching original password generator; "
            f"found {count}. No files changed."
        )
        return 1

    # Confirm the replacement remains compatible with the server's minimum.
    if "return characters.join" not in NEW or "characters.length < 16" not in NEW:
        print("ERROR: Replacement validation failed. No files changed.")
        return 1

    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = Path(".security-patch-backups") / f"password-generator-{timestamp}"
    backup_path = backup_dir / TARGET.name

    try:
        backup_dir.mkdir(parents=True, exist_ok=False)
        backup_path.write_text(source, encoding="utf-8")
        updated = source.replace(OLD, NEW, 1)
        TARGET.write_text(updated, encoding="utf-8")
    except Exception as exc:
        # If the target was written but an error occurred, restore the exact backup.
        try:
            if backup_path.is_file():
                TARGET.write_text(backup_path.read_text(encoding="utf-8"), encoding="utf-8")
        except Exception as restore_exc:
            print(f"ERROR: {exc}; automatic restore also failed: {restore_exc}")
            print(f"Backup remains at {backup_path}")
            return 2
        print(f"ERROR: {exc}. Original file restored from {backup_path}.")
        return 1

    print("Temporary-password generator hardening applied.")
    print(f"Backup: {backup_path}")
    print(f"Changed: {TARGET}")
    print("Only the generator function was replaced.")
    print("No staging, commit, deployment, or service restart performed.")
    print("Next: inspect with git diff --check and review the file diff.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
