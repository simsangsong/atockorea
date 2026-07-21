/**
 * J3 — encrypted offline vault
 * (docs/join-tour-ticketless-rich-itinerary-master-plan-2026-07-22.md §B-3).
 *
 * The offline safety net used to snapshot PLAINTEXT JSON into localStorage —
 * trivially copyable content. This vault stores AES-GCM ciphertext in
 * IndexedDB instead; the key derives from the guest's room session via HKDF
 * (per-booking info) and is NEVER persisted, so a copied cache file or a
 * device without the session yields ciphertext only.
 *
 * Honest limit (recorded in the SoT): client-side encryption is not DRM — a
 * running, authenticated app must decrypt to render. The defended attack is
 * bulk extraction of the raw content files from disk/cache by a competitor.
 *
 * Crypto helpers are separable from the IndexedDB layer so tests can pin the
 * roundtrip without a browser store.
 */

const VAULT_SALT = 'tr-offline-vault-v1';
const DB_NAME = 'tr_offline_vault';
const STORE = 'vault';

export interface VaultCipher {
  iv: Uint8Array;
  data: Uint8Array;
}

function subtle(): SubtleCrypto | null {
  try {
    return globalThis.crypto?.subtle ?? null;
  } catch {
    return null;
  }
}

async function deriveKey(session: string, bookingId: string): Promise<CryptoKey | null> {
  const s = subtle();
  if (!s || !session) return null;
  try {
    const enc = new TextEncoder();
    const material = await s.importKey('raw', enc.encode(session), 'HKDF', false, ['deriveKey']);
    return await s.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(VAULT_SALT), info: enc.encode(bookingId) },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } catch {
    return null;
  }
}

/** Encrypt any JSON-serializable value. Null when crypto is unavailable. */
export async function encryptJson(
  session: string,
  bookingId: string,
  value: unknown,
): Promise<VaultCipher | null> {
  const s = subtle();
  const key = await deriveKey(session, bookingId);
  if (!s || !key) return null;
  try {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const data = new Uint8Array(await s.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
    return { iv, data };
  } catch {
    return null;
  }
}

/** Decrypt back to the value. Null on wrong session, tamper, or any failure. */
export async function decryptJson<T = unknown>(
  session: string,
  bookingId: string,
  cipher: VaultCipher | null | undefined,
): Promise<T | null> {
  const s = subtle();
  const key = await deriveKey(session, bookingId);
  if (!s || !key || !cipher?.iv || !cipher?.data) return null;
  try {
    const plaintext = await s.decrypt(
      { name: 'AES-GCM', iv: cipher.iv as Uint8Array<ArrayBuffer> },
      key,
      cipher.data as Uint8Array<ArrayBuffer>,
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// IndexedDB layer (browser only; every failure degrades to null/no-op).
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Encrypt + persist the booking's offline payload (fire-and-forget safe). */
export async function saveVault(session: string, bookingId: string, value: unknown): Promise<boolean> {
  const cipher = await encryptJson(session, bookingId, value);
  const db = await openDb();
  if (!cipher || !db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ iv: cipher.iv, data: cipher.data, savedAt: Date.now() }, bookingId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Load + decrypt the booking's offline payload; null when absent/undecryptable. */
export async function loadVault<T = unknown>(session: string, bookingId: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  const record = await new Promise<VaultCipher | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(bookingId);
      req.onsuccess = () => resolve((req.result as VaultCipher | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return decryptJson<T>(session, bookingId, record);
}
