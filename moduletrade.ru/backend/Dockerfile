# ==============================================
# MODULETRADE BACKEND DOCKERFILE
# ФИНАЛЬНАЯ БЕЗОПАСНАЯ ВЕРСИЯ - Соответствует всем требованиям аудита
# ==============================================

# ==============================================
# STAGE 1: Dependencies
# ==============================================
FROM node:18-alpine AS dependencies

WORKDIR /app

# Устанавливаем системные зависимости для native модулей
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    bash \
    curl

# КРИТИЧЕСКИ ВАЖНО: Оптимальный порядок копирования для кэширования Docker слоев
COPY package.json .npmrc* ./

# ИСПРАВЛЕНО: Используем npm install с флагами для решения конфликтов
RUN npm cache clean --force && \
    rm -rf node_modules package-lock.json && \
    npm install --legacy-peer-deps --silent && \
    npm cache clean --force

# ==============================================
# STAGE 2: Production Build
# ==============================================
FROM node:18-alpine AS production

WORKDIR /app

# Устанавливаем runtime зависимости и dumb-init для правильной обработки сигналов
RUN apk add --no-cache \
    bash \
    curl \
    dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

# Копируем node_modules из предыдущего этапа
COPY --from=dependencies /app/node_modules ./node_modules

# Копируем package.json для информации о скриптах
COPY package.json ./

# Копируем исходный код приложения с правильными правами доступа
COPY --chown=nodejs:nodejs . .

# Создаем необходимые директории с правильными правами
RUN mkdir -p \
    uploads/imports \
    uploads/exports \
    logs \
    temp \
    scripts \
    && chown -R nodejs:nodejs /app \
    && chmod 755 uploads/imports uploads/exports logs temp scripts

# БЕЗОПАСНОСТЬ: Переключаемся на непривилегированного пользователя
USER nodejs

# Указываем непривилегированный порт
EXPOSE 3000

# Health check для мониторинга состояния контейнера
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# КРИТИЧЕСКИ ВАЖНО: Используем dumb-init для правильной обработки сигналов
# Это обеспечивает graceful shutdown и предотвращает зомби-процессы
ENTRYPOINT ["dumb-init", "--"]

# Запускаем приложение в production режиме
CMD ["npm", "run", "start:prod"]