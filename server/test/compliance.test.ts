import { describe, expect, it, vi } from "vitest";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateTotpSecret,
  sha256,
  verifyTotp,
  verifyTotpStep,
} from "../lib/compliance.ts";

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

  it("verifyTotpStep returns matched counter or null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(59_000);
    const step = verifyTotpStep(RFC_SECRET, "287082");
    expect(step).toBe(1); // 59000 / 30000 = 1
    expect(verifyTotpStep(RFC_SECRET, "000000")).toBeNull();
    expect(verifyTotpStep(RFC_SECRET, "12")).toBeNull();
    vi.useRealTimers();
  });

  it("encryptMfaSecret + decryptMfaSecret round trip", () => {
    const secret = "my-mfa-secret-base32encoded";
    const encrypted = encryptMfaSecret(secret);
    expect(encrypted).toMatch(/^v1:/);
    expect(decryptMfaSecret(encrypted)).toBe(secret);
  });

  it("encryptMfaSecret produces different ciphertexts for identical input", () => {
    const secret = "same-secret-every-time";
    const a = encryptMfaSecret(secret);
    const b = encryptMfaSecret(secret);
    expect(a).not.toBe(b);
    // Both decrypt to the same plaintext
    expect(decryptMfaSecret(a)).toBe(secret);
    expect(decryptMfaSecret(b)).toBe(secret);
  });

  it("decryptMfaSecret returns plaintext unchanged for non-v1: values", () => {
    expect(decryptMfaSecret("plaintext-secret")).toBe("plaintext-secret");
    expect(decryptMfaSecret("")).toBe("");
  });

  it("decryptMfaSecret throws on tampered ciphertext", () => {
    const encrypted = encryptMfaSecret("tamper-me");
    const parts = encrypted.split(":");
    // Flip bits in the ciphertext bytes to break GCM authentication
    const ciphertextBuf = Buffer.from(parts[3], "base64url");
    ciphertextBuf[0] ^= 0xff;
    const tampered = `v1:${parts[1]}:${parts[2]}:${ciphertextBuf.toString("base64url")}`;
    expect(() => decryptMfaSecret(tampered)).toThrow();
  });

  it("decryptMfaSecret throws on invalid format", () => {
    expect(() => decryptMfaSecret("v1:only:three:parts:extra")).toThrow("Invalid MFA secret format");
    expect(() => decryptMfaSecret("v1:notenough")).toThrow("Invalid MFA secret format");
    // Non-v1: values are returned unchanged (legacy plaintext)
    expect(decryptMfaSecret("v2:invalid:version:here")).toBe("v2:invalid:version:here");
  });
});
