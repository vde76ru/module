# ==============================================
# MODULETRADE BACKEND DOCKERFILE
# Многоступенчатая сборка для оптимизации
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

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости (включая commander)
RUN npm install --production=false --silent && \
    npm cache clean --force

# ==============================================
# STAGE 2: Production Build
# ==============================================
FROM node:18-alpine AS production

WORKDIR /app

# Устанавливаем runtime зависимости
RUN apk add --no-cache \
    bash \
    curl \
    dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

# Копируем node_modules из предыдущего этапа
COPY --from=dependencies /app/node_modules ./node_modules

# Копируем package.json для информации о скриптах
COPY package*.json ./

# Копируем исходный код приложения
COPY . .

# Создаем необходимые директории с правильными правами
RUN mkdir -p \
    uploads/imports \
    uploads/exports \
    logs \
    temp \
    scripts \
    && chown -R nodejs:nodejs /app \
    && chmod 755 uploads/imports uploads/exports logs temp scripts


# Переключаемся на непривилегированного пользователя
USER nodejs

# Указываем порт
EXPOSE 3000

# Health check для Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Используем dumb-init для правильной обработки сигналов
ENTRYPOINT ["dumb-init", "--"]

# Запускаем приложение
CMD ["npm", "run", "start:prod"]