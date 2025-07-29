// backend/src/utils/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Определяем уровни логирования
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Цвета для разных уровней
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Создаем директорию для логов, если она не существует
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (error) {
    console.warn('Could not create logs directory:', error.message);
  }
}

// Формат для логов в development
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}` +
    (info.error ? `\n${JSON.stringify(info.error, null, 2)}` : '') +
    (info.stack ? `\n${info.stack}` : '')
  )
);

// Формат для логов в production
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Транспорты в зависимости от окружения
const transports = [];

if (process.env.NODE_ENV !== 'production') {
  // Development - только в консоль
  transports.push(
    new winston.transports.Console({
      format: devFormat
    })
  );
} else {
  // Production - в консоль + файлы (если возможно)
  transports.push(
    new winston.transports.Console({
      format: prodFormat
    })
  );

  // Пытаемся добавить файловые транспорты только если директория доступна для записи
  try {
    // Проверяем возможность записи в директорию логов
    const testFile = path.join(logsDir, 'test_write.log');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    // Если запись возможна, добавляем файловые транспорты
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: prodFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: prodFormat,
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 3
      })
    );
  } catch (error) {
    console.warn('File logging disabled - cannot write to logs directory:', error.message);
  }
}

// Создаем logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports,
  // Не завершаем процесс при ошибках логирования
  exitOnError: false,
  // Обработка необработанных исключений
  handleExceptions: true,
  handleRejections: true
});

// Добавляем fallback на случай проблем с winston
const originalLog = logger.info;
const originalError = logger.error;
const originalWarn = logger.warn;
const originalDebug = logger.debug;

logger.info = function(...args) {
  try {
    return originalLog.apply(this, args);
  } catch (error) {
    console.log('[INFO]', ...args);
  }
};

logger.error = function(...args) {
  try {
    return originalError.apply(this, args);
  } catch (error) {
    console.error('[ERROR]', ...args);
  }
};

logger.warn = function(...args) {
  try {
    return originalWarn.apply(this, args);
  } catch (error) {
    console.warn('[WARN]', ...args);
  }
};

logger.debug = function(...args) {
  try {
    return originalDebug.apply(this, args);
  } catch (error) {
    console.log('[DEBUG]', ...args);
  }
};

// Экспортируем logger с дополнительным fallback методом
logger.safeLog = function(level, message, ...args) {
  try {
    this[level](message, ...args);
  } catch (error) {
    console.log(`[${level.toUpperCase()}]`, message, ...args);
  }
};

module.exports = logger;