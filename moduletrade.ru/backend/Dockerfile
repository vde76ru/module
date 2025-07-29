# Многоступенчатая сборка для оптимизации
FROM node:18-alpine AS builder

WORKDIR /app

# Устанавливаем системные зависимости для native модулей
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    bash

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --omit=dev && npm cache clean --force

# Production стадия
FROM node:18-alpine

WORKDIR /app

# Устанавливаем только runtime зависимости
RUN apk add --no-cache \
    bash \
    curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

# Копируем node_modules из builder стадии
COPY --from=builder /app/node_modules ./node_modules

# Копируем package.json для запуска скриптов
COPY package*.json ./

# Копируем исходный код
COPY . .

# Создаем необходимые директории с правильными правами
RUN mkdir -p uploads/imports uploads/exports logs temp \
    && chown -R nodejs:nodejs /app \
    && chmod 755 uploads/imports uploads/exports logs temp

# Переключаемся на непривилегированного пользователя
USER nodejs

# Указываем порт
EXPOSE 3000

# Health check для Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Запускаем приложение
CMD ["npm", "run", "start:prod"]