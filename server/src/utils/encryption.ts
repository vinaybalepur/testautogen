import crypto from 'crypto';

const ALGORITHM  = 'aes-256-cbc';
const IV_LENGTH  = 16;

const getKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set in environment');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
  return Buffer.from(key);
};

// ── Encrypt ────────────────────────────────────────────
export const encrypt = (text: string): string => {
  const iv      = crypto.randomBytes(IV_LENGTH);
  const cipher  = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

// ── Decrypt ────────────────────────────────────────────
export const decrypt = (text: string): string => {
  const [ivHex, encryptedHex] = text.split(':');
  const iv        = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher  = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString();
};