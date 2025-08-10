const crypto = require('crypto');

/**
 * Безопасные утилиты шифрования.
 *
 * Новая схема: AES-256-GCM, формат: ivHex:tagHex:cipherHex
 * Backward-compat: поддержка legacy AES-256-CBC формата ivHex:cipherHex
 */
class CryptoUtils {
  constructor() {
    this.algorithm = 'aes-256-gcm';

    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) {
      // В production ключ обязателен
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_KEY is required in production');
      }
      // В dev — используем предупреждение и временный ключ из DEV seed
      // ВНИМАНИЕ: немедленно задайте ENCRYPTION_KEY в окружении
      // Используем стабильный derivation, чтобы не ломать перезапуски
      this.key = crypto.scryptSync('dev-insecure-key', 'moduletrade.salt', 32);
    } else {
      // Приводим любой ввод к 32 байтам с помощью scrypt
      this.key = crypto.scryptSync(String(rawKey), 'moduletrade.salt', 32);
    }
  }

  /**
   * Шифрование (AES-256-GCM)
   * @param {string|object} data
   * @returns {string} формат ivHex:tagHex:cipherHex
   */
  encrypt(data) {
    try {
      const plainText = typeof data === 'string' ? data : JSON.stringify(data);
      const iv = crypto.randomBytes(12); // 96-bit IV для GCM
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      const encrypted = Buffer.concat([
        cipher.update(plainText, 'utf8'),
        cipher.final()
      ]);
      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Дешифрование. Поддерживает:
   *  - Новую схему AES-256-GCM: iv:tag:cipher
   *  - Legacy AES-256-CBC: iv:cipher
   * @param {string} payload
   * @returns {object|string}
   */
  decrypt(payload) {
    try {
      if (!payload || typeof payload !== 'string') {
        throw new Error('Invalid encrypted data format');
      }

      const parts = payload.split(':');

      if (parts.length === 3) {
        // Новая схема: iv:tag:cipher
        const [ivHex, tagHex, cipherHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(tagHex, 'hex');
        const ciphertext = Buffer.from(cipherHex, 'hex');

        const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]).toString('utf8');
        return this.#tryParseJson(decrypted);
      }

      if (parts.length === 2) {
        // Legacy CBC: iv:cipher (для обратной совместимости)
        const [ivHex, cipherHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const ciphertext = Buffer.from(cipherHex, 'hex');

        const legacyKey = this.key; // используем тот же derive
        const decipher = crypto.createDecipheriv('aes-256-cbc', legacyKey, iv);
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]).toString('utf8');
        return this.#tryParseJson(decrypted);
      }

      throw new Error('Invalid encrypted data format');
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Проверка, похоже ли значение на шифртекст, который мы поддерживаем
   */
  isEncrypted(value) {
    if (!value || typeof value !== 'string') return false;
    const parts = value.split(':');
    // Новая схема: 3 части hex
    if (parts.length === 3) {
      return parts.every(p => /^[0-9a-f]+$/i.test(p));
    }
    // Legacy схема: 2 части hex
    if (parts.length === 2) {
      return parts.every(p => /^[0-9a-f]+$/i.test(p));
    }
    return false;
  }

  #tryParseJson(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  }
}

module.exports = new CryptoUtils();