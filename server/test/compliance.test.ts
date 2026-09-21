import { describe, expect, it, vi } from "vitest";
import { generateTotpSecret, sha256, verifyTotp } from "../lib/compliance.ts";

// RFC 6238 reference vector: secret is base32("12345678901234567890")
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("compliance primitives", () => {
  it("hashes deterministically and changes with input", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abd"));
  });

  it("generates valid base32 secrets", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepts the RFC 6238 sample code at T=59s and rejects drift beyond window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(59_000);
    expect(verifyTotp(RFC_SECRET, "287082")).toBe(true);
    vi.setSystemTime(59_000 + 30_000 * 5);
    expect(verifyTotp(RFC_SECRET, "287082")).toBe(false);
    vi.useRealTimers();
  });

  it("rejects malformed codes", () => {
    expect(verifyTotp(RFC_SECRET, "12")).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef")).toBe(false);
  });
});
