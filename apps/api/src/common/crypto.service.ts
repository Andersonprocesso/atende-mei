import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

// Criptografia em repouso (LGPD/segredos) — AES-256-GCM.
// Formato armazenado (base64): iv(12) | authTag(16) | ciphertext.
// Chave: ENCRYPTION_KEY (32 bytes em hex). Gere com: openssl rand -hex 32.
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const hex = config.get<string>('ENCRYPTION_KEY') ?? '';
    this.key = Buffer.from(hex, 'hex');
    if (this.key.length !== 32) {
      // não derruba o boot; cifrar/decifrar falha explicitamente se usado
      this.key = Buffer.alloc(0);
    }
  }

  get disponivel(): boolean {
    return this.key.length === 32;
  }

  encrypt(plain: Buffer | string): string {
    if (!this.disponivel) throw new Error('ENCRYPTION_KEY inválida (precisa 32 bytes hex)');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.isBuffer(plain) ? plain : Buffer.from(plain, 'utf8');
    const enc = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payloadB64: string): Buffer {
    if (!this.disponivel) throw new Error('ENCRYPTION_KEY inválida (precisa 32 bytes hex)');
    const buf = Buffer.from(payloadB64, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }

  decryptToString(payloadB64: string): string {
    return this.decrypt(payloadB64).toString('utf8');
  }
}
