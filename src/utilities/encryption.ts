import crypto from "crypto";

const algorithm = "aes-256-gcm";

const authTagLength = 16;
const authTagHexLength = authTagLength * 2;

const ivLength = 16;

/**
 * Generates a random initialization vector (IV) for encryption.
 * @returns {string} A randomly generated IV as a hexadecimal string.
 */
export function generateRandomIV(): string {
  return crypto.randomBytes(ivLength).toString("hex");
}

/**
 * Encrypts an email using AES-256-GCM with the provided encryption key.
 * @param email - The email address to be encrypted.
 * @returns {string} The encrypted email in the format "iv:authTag:encryptedData".
 * @throws Will throw an error if the encryption key is not defined or is invalid.
 */
export function encryptEmail(email: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error("Encryption key is not defined.");
  } else if (encryptionKey.length !== 64) {
    throw new Error(
      "Encryption key must be a 256-bit hexadecimal string (64 characters).",
    );
  }

  const iv = generateRandomIV();
  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(encryptionKey, "hex"),
    Buffer.from(iv, "hex"),
  );

  const encrypted = Buffer.concat([
    cipher.update(email, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypts an encrypted email string using AES-256-GCM.
 * @param encryptedData - The encrypted email string in the format "iv:authTag:encryptedData".
 * @returns {object} An object containing the decrypted email.
 * @throws Will throw an error if the encrypted data format is invalid or if decryption fails.
 */
export function decryptEmail(encryptedData: string): {
  decrypted: string;
} {
    const minLength = ivLength * 2 + authTagHexLength + 2;
    const maxLength = ivLength * 2 + authTagHexLength + 1000;
    if (encryptedData.length < minLength) {
      throw new Error("Invalid encrypted data: input is too short.");
    } else if (encryptedData.length > maxLength) {
      throw new Error("Invalid encrypted data: input is too long.");
    }
  const [iv, authTagHex, encryptedHex] = encryptedData.split(":");
  if (!isValidHex(iv)) {
    throw new Error("Invalid IV: not a hex string");
  }

  if (!isValidHex(authTagHex)) {
    throw new Error("Invalid auth tag: not a hex string");
  }

  if (!isValidHex(encryptedHex)) {
    throw new Error("Invalid encrypted data: not a hex string");
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error("Encryption key is not defined.");
  } else if (encryptionKey.length !== 64) {
    throw new Error(
      "Encryption key must be a 256-bit hexadecimal string (64 characters).",
    );
  }

  const authTag = Buffer.from(authTagHex, "hex");
  const encryptedBuffer = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(encryptionKey, "hex"),
    Buffer.from(iv, "hex"),
  );

  decipher.setAuthTag(authTag);

  let decrypted;
  try {
    decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Decryption failed: invalid data or authentication tag.");
  }
  return {decrypted};
}

/**
 * Checks if a given string is a valid hexadecimal string.
 * @param str - The string to be validated.
 * @returns {boolean} True if the string is valid hexadecimal, false otherwise.
 */
function isValidHex(str: string): boolean {
  return /^[0-9a-fA-F]+$/.test(str);
}
