# ==============================================
# MODULETRADE FRONTEND DOCKERFILE
# Исправленная версия с решением конфликта ajv
# ==============================================

# ==============================================
# STAGE 1: Build
# ==============================================
FROM node:18-alpine AS builder

WORKDIR /app

# Устанавливаем системные зависимости
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    bash

# Копируем package.json
COPY package.json ./

# КРИТИЧЕСКИ ВАЖНО: Очищаем npm кэш и устанавливаем зависимости заново
RUN npm cache clean --force && \
    rm -rf node_modules package-lock.json && \
    npm install --no-package-lock --no-save --silent

# Копируем исходный код
COPY . .

# Аргументы сборки
ARG REACT_APP_API_URL=https://api.moduletrade.ru/api
ARG REACT_APP_STRIPE_PUBLIC_KEY

# Устанавливаем переменные окружения для сборки
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_STRIPE_PUBLIC_KEY=$REACT_APP_STRIPE_PUBLIC_KEY
ENV GENERATE_SOURCEMAP=false
ENV CI=false
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Собираем приложение
RUN npm run build

# ==============================================
# STAGE 2: Production with Nginx
# ==============================================
FROM nginx:alpine AS production

# Устанавливаем необходимые пакеты
RUN apk add --no-cache curl

# Копируем собранное приложение
COPY --from=builder /app/build /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Создаем пользователя nginx (если не существует)
RUN addgroup -g 1001 -S nginx-user 2>/dev/null || true && \
    adduser -S nginx-user -u 1001 -G nginx-user 2>/dev/null || true

# Устанавливаем права
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    chmod -R 755 /usr/share/nginx/html

# Создаем директории для nginx
RUN touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Запускаем nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]