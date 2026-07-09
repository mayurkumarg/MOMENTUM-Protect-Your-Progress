const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

// Falls back to a key derived from JWT_SECRET so local dev keeps working without
// extra setup — set a dedicated GITHUB_TOKEN_ENCRYPTION_KEY in production.
const getKey = () => {
  const secret = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  return crypto.createHash('sha256').update(String(secret)).digest();
};

const encrypt = (plainText) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((buf) => buf.toString('base64')).join('.');
};

const decrypt = (payload) => {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
};

module.exports = { encrypt, decrypt };
