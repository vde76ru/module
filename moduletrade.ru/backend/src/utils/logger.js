// backend/src/utils/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// ========================================
// DATABASE TRANSPORT ДЛЯ WINSTON
// ========================================

class DatabaseTransport extends winston.Transport {
  constructor(opts = {}) {
    super(opts);

    this.name = 'database';
    this.level = opts.level || 'info';

    // Создаем пул соединений для логов
    this.pool = new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'saas_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'SecurePostgresPass2025',
      max: 2, // Небольшой пул для логов
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Буферизация для избежания блокировок
    this.buffer = [];
    this.bufferSize = opts.bufferSize || 10;
    this.flushInterval = opts.flushInterval || 5000; // 5 секунд

    // Запускаем периодическую запись
    this.startFlushTimer();
  }

  /**
   * Основной метод записи лога
   */
  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Добавляем в буфер
    this.buffer.push({
      level: info.level,
      message: info.message,
      meta: this.prepareMeta(info),
      timestamp: new Date(),
      company_id: info.companyId || null,
      user_id: info.userId || null,
      request_id: info.requestId || null,
      module: info.module || null,
      ip_address: info.ipAddress || null,
      user_agent: info.userAgent || null
    });

    // Если буфер заполнен, сбрасываем немедленно
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }

    callback();
  }

  /**
   * Подготовка метаданных для сохранения
   */
  prepareMeta(info) {
    const meta = { ...info };

    // Удаляем стандартные поля winston
    delete meta.level;
    delete meta.message;
    delete meta.timestamp;
    delete meta.companyId;
    delete meta.userId;
    delete meta.requestId;
    delete meta.module;
    delete meta.ipAddress;
    delete meta.userAgent;

    // Ограничиваем размер мета-данных
    const metaString = JSON.stringify(meta);
    if (metaString.length > 5000) {
      return {
        ...meta,
        _truncated: true,
        _originalSize: metaString.length
      };
    }

    return meta;
  }

  /**
   * Запуск таймера для периодической записи
   */
  startFlushTimer() {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  /**
   * Запись буфера в базу данных
   */
  async flush() {
    if (this.buffer.length === 0) return;

    const logEntries = [...this.buffer];
    this.buffer = [];

    try {
      const client = await this.pool.connect();

      try {
        // Проверяем наличие таблицы system_logs один раз на процесс
        if (!this._checkedTable) {
          const check = await client.query("SELECT to_regclass('public.system_logs') AS t");
          this._checkedTable = true;
          this._tableExists = !!(check.rows && check.rows[0] && check.rows[0].t);
        }
        if (!this._tableExists) {
          // Таблица ещё не существует (до применения миграций) — тихо пропускаем запись
          return;
        }

        // Подготавливаем batch insert
        const values = [];
        const placeholders = [];
        let paramIndex = 1;

        logEntries.forEach((entry) => {
          const placeholder = `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`;
          placeholders.push(placeholder);

          const context = {
            ...(entry.meta || {}),
            request_id: entry.request_id || null,
            user_agent: entry.user_agent || null
          };

          values.push(
            entry.company_id,
            entry.level,
            entry.module || null, // category
            entry.message,
            JSON.stringify(context),
            null, // stack_trace
            entry.ip_address || null,
            entry.user_id || null,
            entry.timestamp
          );

          paramIndex += 9;
        });

        const query = `
          INSERT INTO system_logs (
            company_id, level, category, message, context, stack_trace, ip_address, user_id, created_at
          ) VALUES ${placeholders.join(', ')}
        `;

        await client.query(query, values);

      } finally {
        client.release();
      }

    } catch (error) {
      // В случае ошибки записи в БД, не блокируем приложение
      console.error('Database logging error:', error.message);

      // Можно добавить fallback логирование в файл
      if (process.env.LOG_DB_ERRORS === 'true') {
        const errorLog = path.join(process.cwd(), 'logs', 'db-transport-errors.log');
        try {
          const errorEntry = `${new Date().toISOString()} - DB Log Error: ${error.message}\n`;
          fs.appendFileSync(errorLog, errorEntry);
        } catch (fileError) {
          // Молча игнорируем ошибки записи файла
        }
      }
    }
  }

  /**
   * Корректное завершение работы транспорта
   */
  close() {
    if (this._closed) {
      return;
    }
    this._closed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Сбрасываем оставшиеся логи
    if (this.buffer.length > 0) {
      this.flush();
    }

    // Закрываем пул соединений
    if (this.pool) {
      try {
        this.pool.end();
      } catch (_) {
        // ignore double-end errors
      }
    }
  }
}

// ========================================
// WINSTON CONFIGURATION
// ========================================

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

// ✅ ДОБАВЛЯЕМ DATABASE TRANSPORT (согласно ТЗ)
// Включаем транспорт БД только если это разрешено конфигурацией
if (process.env.ENABLE_DB_LOGGING !== 'false' && process.env.NODE_ENV === 'production') {
  try {
    transports.push(
      new DatabaseTransport({
        level: process.env.DB_LOG_LEVEL || 'warn', // По умолчанию только warn и error
        bufferSize: parseInt(process.env.DB_LOG_BUFFER_SIZE) || 10,
        flushInterval: parseInt(process.env.DB_LOG_FLUSH_INTERVAL) || 5000
      })
    );
    console.log('✅ Database logging transport enabled');
  } catch (error) {
    console.warn('Database logging transport failed to initialize:', error.message);
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

// ========================================
// ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ
// ========================================

/**
 * Безопасное логирование с контекстом
 */
logger.safeLog = function(level, message, context = {}) {
  try {
    this[level](message, context);
  } catch (error) {
    console.log(`[${level.toUpperCase()}]`, message, context);
  }
};

/**
 * Логирование с контекстом пользователя/тенанта
 */
logger.logWithContext = function(level, message, context = {}) {
  try {
    this[level](message, {
      ...context,
      companyId: context.companyId,
      userId: context.userId,
      requestId: context.requestId,
      module: context.module,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  } catch (error) {
    console.log(`[${level.toUpperCase()}]`, message, context);
  }
};

/**
 * Удобные методы для логирования операций пользователей
 */
logger.userAction = function(action, userId, companyId, details = {}) {
  this.logWithContext('info', `User action: ${action}`, {
    userId,
    companyId,
    module: 'user_actions',
    action,
    ...details
  });
};

logger.systemEvent = function(event, details = {}) {
  this.logWithContext('info', `System event: ${event}`, {
    module: 'system',
    event,
    ...details
  });
};

logger.securityEvent = function(event, details = {}) {
  this.logWithContext('warn', `Security event: ${event}`, {
    module: 'security',
    event,
    ...details
  });
};

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

// Корректное завершение работы при остановке приложения
process.on('SIGINT', () => {
  logger.info('Shutting down logger...');
  logger.transports.forEach(transport => {
    if (transport.close) {
      transport.close();
    }
  });
});

process.on('SIGTERM', () => {
  logger.info('Shutting down logger...');
  logger.transports.forEach(transport => {
    if (transport.close) {
      transport.close();
    }
  });
});

module.exports = logger;