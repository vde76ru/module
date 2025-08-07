const crypto = require('crypto');

class CryptoUtils {
  constructor() {
    // Используем переменную окружения или fallback ключ для разработки
    this.secretKey = process.env.ENCRYPTION_KEY || 'defaultkey123456789012345678901234567890'; // 32 символа
    this.algorithm = 'aes-256-cbc';
  }

  /**
   * Шифрование данных
   * @param {string|object} data - данные для шифрования
   * @returns {string} - зашифрованная строка в формате iv:encrypted
   */
  encrypt(data) {
    try {
      const text = typeof data === 'string' ? data : JSON.stringify(data);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.secretKey);
      cipher.setAutoPadding(true);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Дешифрование данных
   * @param {string} encryptedData - зашифрованные данные в формате iv:encrypted
   * @returns {object|string} - расшифрованные данные
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data format');
      }

      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
      decipher.setAutoPadding(true);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Пытаемся распарсить как JSON, если не получается - возвращаем как строку
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Проверка, зашифрованы ли данные
   * @param {string} data - данные для проверки
   * @returns {boolean} - true если данные зашифрованы
   */
  isEncrypted(data) {
    if (!data || typeof data !== 'string') {
      return false;
    }
    
    const parts = data.split(':');
    return parts.length === 2 && /^[0-9a-f]+$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1]);
  }
}

module.exports = new CryptoUtils();