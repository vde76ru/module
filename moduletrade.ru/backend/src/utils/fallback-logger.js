// backend/src/utils/fallback-logger.js
// Простой fallback logger на случай проблем с winston

const fs = require('fs');
const path = require('path');

class FallbackLogger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      debug: 4,
    };

    // Пытаемся создать директорию для логов
    this.logsDir = path.join(process.cwd(), 'logs');
    this.canWriteFiles = this.checkWritePermissions();
  }

  checkWritePermissions() {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }

      // Тестируем запись
      const testFile = path.join(this.logsDir, 'test.log');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return true;
    } catch (error) {
      return false;
    }
  }

  shouldLog(level) {
    const levelNum = this.levels[level] || 0;
    const currentLevelNum = this.levels[this.logLevel] || 2;
    return levelNum <= currentLevelNum;
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')}` : '';

    return `${timestamp} [${level.toUpperCase()}]: ${message}${formattedArgs}`;
  }

  writeToFile(level, formattedMessage) {
    if (!this.canWriteFiles) return;

    try {
      const filename = level === 'error' ? 'error.log' : 'combined.log';
      const filepath = path.join(this.logsDir, filename);
      fs.appendFileSync(filepath, formattedMessage + '\n');
    } catch (error) {
      // Молча игнорируем ошибки записи в файл
    }
  }

  log(level, message, ...args) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, ...args);

    // Всегда выводим в консоль
    const consoleMethod = level === 'error' ? console.error :
                         level === 'warn' ? console.warn :
                         console.log;
    consoleMethod(formattedMessage);

    // Пытаемся записать в файл в production
    if (process.env.NODE_ENV === 'production') {
      this.writeToFile(level, formattedMessage);
    }
  }

  error(message, ...args) {
    this.log('error', message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  info(message, ...args) {
    this.log('info', message, ...args);
  }

  http(message, ...args) {
    this.log('http', message, ...args);
  }

  debug(message, ...args) {
    this.log('debug', message, ...args);
  }

  // Дополнительный безопасный метод
  safeLog(level, message, ...args) {
    try {
      this[level](message, ...args);
    } catch (error) {
      console.log(`[${level.toUpperCase()}]`, message, ...args);
    }
  }
}

module.exports = new FallbackLogger();