import crypto from 'crypto';

// AES-256-CBC requires a 32-byte key
const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 32 bytes = 256 bits
const IV_LENGTH = 16; // 16 bytes for AES

// Get encryption key from environment variable
// Should be a 64-character hex string (32 bytes)
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Convert hex string to buffer
  const keyBuffer = Buffer.from(key, 'hex');

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters). Generate with: openssl rand -hex 32`);
  }

  return keyBuffer;
};

/**
 * Encrypts a plaintext API key
 * @param {string} plaintext - The API key to encrypt
 * @returns {Object} - Object containing encrypted data and IV
 */
export const encryptApiKey = (plaintext) => {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty value');
  }

  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);

    // Get the encryption key
    const key = getEncryptionKey();

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt API key');
  }
};

/**
 * Decrypts an encrypted API key
 * @param {string} encrypted - The encrypted data (hex string)
 * @param {string} ivHex - The initialization vector (hex string)
 * @returns {string} - The decrypted plaintext
 */
export const decryptApiKey = (encrypted, ivHex) => {
  if (!encrypted || !ivHex) {
    throw new Error('Cannot decrypt: missing encrypted data or IV');
  }

  try {
    // Convert IV from hex to buffer
    const iv = Buffer.from(ivHex, 'hex');

    // Get the encryption key
    const key = getEncryptionKey();

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt API key');
  }
};

/**
 * Validates that the encryption key is properly configured
 * @returns {boolean} - True if encryption key is valid
 */
export const validateEncryptionKey = () => {
  try {
    getEncryptionKey();
    return true;
  } catch (error) {
    console.error('Encryption key validation failed:', error.message);
    return false;
  }
};
