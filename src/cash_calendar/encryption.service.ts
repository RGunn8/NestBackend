import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

@Injectable()
export class EncryptionService implements OnModuleInit {
  private key: Buffer;

  onModuleInit(): void {
    this.key = this.resolveKey();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, ciphertextB64] = payload.split(':');
    if (!ivB64 || !authTagB64 || !ciphertextB64) {
      throw new Error('Invalid encrypted payload format');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  private resolveKey(): Buffer {
    const envKey = process.env.SIMPLEFIN_ENCRYPTION_KEY;
    if (envKey) {
      if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
        return Buffer.from(envKey, 'hex');
      }
      const decoded = Buffer.from(envKey, 'base64');
      if (decoded.length === 32) {
        return decoded;
      }
    }

    const fallbackSecret =
      process.env.SIMPLEFIN_ENCRYPTION_SECRET ?? 'dev-only-change-me';
    return scryptSync(fallbackSecret, 'simplefin-salt', 32);
  }
}
