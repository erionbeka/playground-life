import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.ts";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function generateTotpSecret(): string {
  const raw = randomBytes(20);
  let output = "";
  let bits = 0;
  let value = 0;
  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return output;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function totpAt(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter % 2 ** 32, 4);
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, token: string, window = 1): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const counter = Math.floor(Date.now() / 30_000);
  for (let drift = -window; drift <= window; drift += 1) {
    if (safeEqual(totpAt(secret, counter + drift), token)) return true;
  }
  return false;
}

export function otpauthUri(secret: string, email: string, issuer = "Playground Life"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Encrypt an MFA secret at rest. Returns a `v1:`-prefixed ciphertext so the
 * plaintext secret never persists in the database. Uses AES-256-GCM with a
 * fresh random IV per encryption, so identical secrets produce different
 * ciphertexts.
 */
export function encryptMfaSecret(secret: string): string {
  const key = Buffer.from(config.RESEARCH_KEY, "utf8").slice(0, 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

/**
 * Decrypt an MFA secret. Plaintext values (legacy, pre-encryption) are
 * returned unchanged. `v1:` ciphertexts are decrypted and authenticated;
 * tampered ciphertexts throw.
 */
export function decryptMfaSecret(encrypted: string): string {
  if (!encrypted.startsWith("v1:")) return encrypted;
  const parts = encrypted.split(":");
  if (parts.length !== 4) throw new Error("Invalid MFA secret format");
  const key = Buffer.from(config.RESEARCH_KEY, "utf8").slice(0, 32);
  const iv = Buffer.from(parts[1], "base64url");
  const authTag = Buffer.from(parts[2], "base64url");
  const ciphertext = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Verify a TOTP code and return the matched time-step counter, or null if no
 * code in the allowed window matches. The counter lets callers record
 * `mfa_last_used_step` so the same code cannot be replayed at sign-in.
 */
export function verifyTotpStep(secret: string, token: string, window = 1): number | null {
  if (!/^\d{6}$/.test(token)) return null;
  const counter = Math.floor(Date.now() / 30_000);
  for (let drift = -window; drift <= window; drift += 1) {
    if (safeEqual(totpAt(secret, counter + drift), token)) return counter + drift;
  }
  return null;
}
