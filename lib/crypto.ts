import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM encryption for OAuth refresh tokens at rest.
 *
 * Storage layout: each secret produces three base64 strings (ciphertext, iv, tag).
 * We store them in separate text columns rather than a packed blob so the schema
 * stays readable and supabase-js (JSON transport) handles them cleanly.
 *
 * Key: APP_ENCRYPTION_KEY must decode to exactly 32 bytes. Generate with `npm run keygen`.
 */

const IV_LENGTH = 12; // 96-bit nonce — recommended for GCM
const KEY_LENGTH = 32; // AES-256

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. Generate one with `npm run keygen`.",
    );
  }
  // Accept base64 (default) or hex.
  const key =
    raw.length === KEY_LENGTH * 2 && /^[0-9a-fA-F]+$/.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}). Use \`npm run keygen\`.`,
    );
  }
  return key;
}

export interface EncryptedSecret {
  enc: string; // base64 ciphertext
  iv: string; // base64 nonce
  tag: string; // base64 GCM auth tag
}

export function encrypt(plaintext: string): EncryptedSecret {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    enc: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decrypt(secret: EncryptedSecret): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(secret.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(secret.enc, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
