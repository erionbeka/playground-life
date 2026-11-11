import { describe, expect, it, vi } from "vitest";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateTotpSecret,
  sha256,
  verifyTotp,
  verifyTotpStep,
} from "../lib/compliance.ts";

const configMock = vi.hoisted(() => ({
  MFA_KEY: "dedicated-mfa-encryption-key-that-is-at-least-32-chars-long",
  RESEARCH_KEY: "research-deid-key-that-is-at-least-32-characters-long",
}));

vi.mock("../config.ts", () => ({
  config: configMock,
}));

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

  describe("MFA encryption key isolation", () => {
    it("uses the dedicated MFA key when MFA_ENCRYPTION_KEY is set", () => {
      configMock.MFA_KEY = "dedicated-mfa-encryption-key-that-is-at-least-32-chars-long";
      configMock.RESEARCH_KEY = "different-research-key-that-is-at-least-32-characters-long";

      const secret = "isolated-mfa-secret";
      const encrypted = encryptMfaSecret(secret);

      // Decrypts correctly with the dedicated key.
      expect(decryptMfaSecret(encrypted)).toBe(secret);
    });

    it("decrypts secrets encrypted under RESEARCH_KEY via fallback", async () => {
      // Simulate a secret that was encrypted before the dedicated key existed.
      configMock.MFA_KEY = "new-dedicated-key-that-is-at-least-32-characters-long";
      configMock.RESEARCH_KEY = "old-research-key-that-is-at-least-32-characters-long";

      // Manually encrypt with the old RESEARCH_KEY.
      const { createCipheriv, randomBytes } = await import("node:crypto");
      const oldKey = Buffer.from(configMock.RESEARCH_KEY, "utf8").slice(0, 32);
      const iv = randomBytes(16);
      const cipher = createCipheriv("aes-256-gcm", oldKey, iv);
      const ciphertext = Buffer.concat([cipher.update("legacy-secret", "utf8"), cipher.final()]);
      const legacy = `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;

      expect(decryptMfaSecret(legacy)).toBe("legacy-secret");
    });

    it("throws when neither the dedicated key nor RESEARCH_KEY can decrypt", () => {
      configMock.MFA_KEY = "dedicated-mfa-encryption-key-that-is-at-least-32-chars-long";
      configMock.RESEARCH_KEY = "research-deid-key-that-is-at-least-32-characters-long";

      const encrypted = encryptMfaSecret("my-secret");
      // Tamper with the ciphertext so neither key can authenticate it.
      const parts = encrypted.split(":");
      const ciphertextBuf = Buffer.from(parts[3], "base64url");
      ciphertextBuf[0] ^= 0xff;
      const tampered = `v1:${parts[1]}:${parts[2]}:${ciphertextBuf.toString("base64url")}`;
      expect(() => decryptMfaSecret(tampered)).toThrow("Failed to decrypt MFA secret");
    });
  });
});
