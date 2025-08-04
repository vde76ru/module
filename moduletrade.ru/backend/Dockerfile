# =================================================
# DOCKERFILE ДЛЯ БЭКЕНДА (Оптимизированный)
# =================================================

# -----------------
# ЭТАП 1: Установка зависимостей
# На этом этапе мы устанавливаем все зависимости, включая devDependencies для сборки.
# -----------------
FROM node:18-alpine AS dependencies

WORKDIR /app

# Устанавливаем системные пакеты, которые могут понадобиться для сборки нативных модулей
RUN apk add --no-cache python3 make g++

# Копируем только package.json и package-lock.json (если есть)
# Это позволяет Docker кэшировать установленные модули и не переустанавливать их при каждом изменении кода
COPY package*.json ./

# Устанавливаем все зависимости.
# Использование --production=false важно, если для сборки нужны devDependencies
RUN npm install --production=false --silent && npm cache clean --force


# -----------------
# ЭТАП 2: Production-образ
# Создаем чистый и легковесный образ для запуска приложения.
# -----------------
FROM node:18-alpine

WORKDIR /app

# Устанавливаем только те системные пакеты, что нужны для работы приложения
# dumb-init - для корректной обработки сигналов (PID 1)
RUN apk add --no-cache dumb-init

# Создаем группу и пользователя с ограниченными правами для безопасности
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

# Копируем node_modules с предыдущего этапа
COPY --from=dependencies /app/node_modules ./node_modules

# Копируем остальные файлы приложения
COPY . .

# Создаем необходимые директории и передаем права нашему пользователю
# Это нужно делать до смены пользователя
RUN mkdir -p uploads/imports uploads/exports logs temp scripts && \
    chown -R nodejs:nodejs /app

# Переключаемся на непривилегированного пользователя
USER nodejs

# Открываем порт
EXPOSE 3000

# Healthcheck для мониторинга состояния контейнера
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD [ "node", "-e", "require('http').get('http://localhost:3000/health', (res) => res.statusCode === 200 ? process.exit(0) : process.exit(1))" ]

# Используем dumb-init для запуска приложения
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Команда для запуска приложения в production-режиме
CMD ["npm", "run", "start:prod"]