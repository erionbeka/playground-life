/**
 * Encrypted at-rest storage for clinic data, replacing plaintext localStorage.
 *
 * - A non-extractable AES-GCM CryptoKey is generated once and kept inside
 *   IndexedDB; JavaScript can read ciphertext but never the raw key material.
 * - The decrypted snapshot lives in memory only for the running tab.
 * - Legacy plaintext localStorage snapshots are migrated on first load and
 *   then removed.
 */

const DB_NAME = "playground-life-secure";
const STORE = "keys";
const KEY_ID = "snapshot-key";
const LEGACY_KEY = "playground-life.backend.v2";
const CIPHER_BLOB = "playground-life.snapshot.v1";

let cachedKey: CryptoKey | null = null;
let snapshot: unknown = null;

function hasCrypto(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function getOrCreateKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const existing = await withStore<CryptoKey | undefined>("readonly", (store) => store.get(KEY_ID));
  if (existing) {
    cachedKey = existing;
    return existing;
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await withStore("readwrite", (store) => store.put(key, KEY_ID));
  cachedKey = key;
  return key;
}

async function encryptJson(value: unknown): Promise<ArrayBuffer> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const payload = new Uint8Array(iv.length + cipher.byteLength);
  payload.set(iv);
  payload.set(new Uint8Array(cipher), iv.length);
  return payload.buffer as ArrayBuffer;
}

async function decryptJson(buffer: ArrayBuffer): Promise<unknown> {
  const key = await getOrCreateKey();
  const data = new Uint8Array(buffer);
  const iv = data.slice(0, 12);
  const cipher = data.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

export interface VaultInitResult {
  supported: boolean;
  migratedLegacy: boolean;
}

/** Call once before the app renders. Falls back to legacy storage when WebCrypto/IDB are unavailable. */
export async function initVault(): Promise<VaultInitResult> {
  if (!hasCrypto()) return { supported: false, migratedLegacy: false };

  try {
    let migratedLegacy = false;
    if (typeof localStorage !== "undefined") {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        try {
          snapshot = JSON.parse(legacy);
          migratedLegacy = true;
        } catch {
          /* corrupt legacy payload ignored */
        }
        localStorage.removeItem(LEGACY_KEY);
      }

      const priorCipher = localStorage.getItem(CIPHER_BLOB);
      if (!migratedLegacy && priorCipher) {
        try {
          const raw = Uint8Array.from(atob(priorCipher), (char) => char.charCodeAt(0));
          snapshot = await decryptJson(raw.buffer as ArrayBuffer);
        } catch {
          snapshot = null;
        }
      }
    }

    if (snapshot !== null) {
      const cipherBuffer = await encryptJson(snapshot);
      storeCipher(cipherBuffer);
    }
    return { supported: true, migratedLegacy };
  } catch {
    return { supported: false, migratedLegacy: false };
  }
}

function storeCipher(buffer: ArrayBuffer) {
  if (typeof localStorage === "undefined") return;
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  try {
    localStorage.setItem(CIPHER_BLOB, btoa(binary));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* quota exceeded — keep memory copy */
  }
}

/** Synchronous access to the in-memory decrypted snapshot (after initVault). Invalidates when underlying storage is wiped. */
export function readSnapshot<T>(): T | null {
  if (typeof window !== "undefined") {
    const storagePresent =
      !!window.localStorage.getItem(CIPHER_BLOB) || !!window.localStorage.getItem(LEGACY_KEY);
    if (!storagePresent) {
      snapshot = null;
      return null;
    }
  }
  return (snapshot as T) ?? null;
}

/** Encrypts and persists the snapshot asynchronously; memory view updates immediately. */
export async function writeSnapshot<T>(value: T): Promise<void> {
  snapshot = value;
  if (!hasCrypto()) {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(LEGACY_KEY, JSON.stringify(value));
      } catch {
        /* quota */
      }
    }
    return;
  }
  try {
    const buffer = await encryptJson(value);
    storeCipher(buffer);
  } catch {
    /* keep memory copy on failure */
  }
}

export function vaultStatus(): { encrypted: boolean; legacyPresent: boolean } {
  const encrypted = hasCrypto() && typeof localStorage !== "undefined" && !!localStorage.getItem(CIPHER_BLOB);
  const legacyPresent = typeof localStorage !== "undefined" && !!localStorage.getItem(LEGACY_KEY);
  return { encrypted, legacyPresent };
}
