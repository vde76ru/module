# Многоступенчатая сборка для оптимизации размера образа
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Стадия production
FROM node:18-alpine

WORKDIR /app

# Копируем node_modules из builder stage
COPY --from=builder /app/node_modules ./node_modules

# Копируем исходный код
COPY . .

# Создаем необходимые директории
RUN mkdir -p uploads/imports uploads/exports logs && \
    chmod 755 uploads/imports uploads/exports logs

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Устанавливаем права на директории
RUN chown -R nodejs:nodejs /app

# Переключаемся на непривилегированного пользователя
USER nodejs

# Указываем порт
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Запускаем приложение
CMD ["node", "src/server.js"]