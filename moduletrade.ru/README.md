# 🚀 ModuleTrade SaaS Platform

Мультитенантная SaaS-платформа для управления товарами и интеграции с маркетплейсами.

## 📋 Возможности

- 🏪 **Управление маркетплейсами**: Ozon, Wildberries, Yandex Market
- 📦 **Управление товарами**: PIM система с нормализацией данных
- 🏭 **Интеграция с поставщиками**: ETM, RS24, собственные API
- 📊 **Аналитика и отчеты**: Продажи, остатки, прибыльность
- 💰 **Система биллинга**: Подписки и тарифные планы
- 🔒 **Мультитенантность**: Изолированные данные для каждого клиента

## 🛠️ Технологический стек

### Backend
- **Node.js** + Express.js
- **PostgreSQL** - основная база данных
- **Redis** - кеширование и сессии
- **RabbitMQ** - очереди задач
- **Docker** - контейнеризация

### Frontend
- **React** + Redux Toolkit
- **Ant Design** - UI компоненты
- **Nginx** - веб-сервер

### DevOps
- **Docker Compose** - локальная разработка
- **Nginx** - reverse proxy
- **Let's Encrypt** - SSL сертификаты

## 🚀 Быстрый старт

### Предварительные требования

- **Docker Desktop** (Windows/Mac) или **Docker + Docker Compose** (Linux)
- **Node.js 18+** (для локальной разработки)
- **Git**

### Установка

1. **Клонируйте репозиторий:**
\\\ash
git clone git@github.com:Way7Creation/moduletrade.ru.git
cd moduletrade.ru
\\\

2. **Создайте файл окружения:**
\\\ash
cp .env.example .env
# Отредактируйте .env с вашими настройками
\\\

3. **Запустите через Docker:**
\\\ash
docker compose up -d
\\\

4. **Выполните миграции базы данных:**
\\\ash
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
\\\

### Доступ к приложению

- **Frontend**: https://moduletrade.ru
- **Backend API**: https://api.moduletrade.ru
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **RabbitMQ Management**: http://localhost:15672



## 💻 Разработка

### Локальный запуск

**Backend:**
\\\ash
cd backend
npm install
npm run start:dev
\\\

**Frontend:**
\\\ash
cd frontend
npm install
npm start
\\\

### Полезные команды

\\\ash
# Просмотр логов
docker compose logs -f

# Остановка всех сервисов
docker compose down

# Пересборка образов
docker compose up -d --build

# Подключение к базе данных
docker compose exec postgres psql -U postgres -d saas_platform

# Выполнение миграций
docker compose exec backend npm run migrate

# Заполнение тестовыми данными
docker compose exec backend npm run seed
\\\

## 📁 Структура проекта

\\\
moduletrade.ru/
├── backend/                 # Node.js API сервер
│   ├── src/                # Исходный код
│   │   ├── adapters/       # Адаптеры для внешних API
│   │   ├── config/         # Конфигурация
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API роуты
│   │   └── services/       # Бизнес-логика
│   ├── migrations/         # SQL миграции
│   ├── uploads/           # Загруженные файлы
│   ├── Dockerfile         # Docker образ backend
│   └── package.json       # Зависимости Node.js
├── frontend/               # React приложение
│   ├── src/               # Исходный код React
│   ├── nginx.conf         # Конфигурация Nginx
│   ├── Dockerfile         # Docker образ frontend
│   └── package.json       # Зависимости React
├── nginx/                  # Reverse proxy
│   ├── nginx.conf         # Основная конфигурация
│   └── certs/             # SSL сертификаты
├── docker-compose.yml      # Docker Compose конфигурация
├── .env                   # Переменные окружения (не в Git)
├── .env.example           # Пример переменных окружения
└── README.md              # Этот файл
\\\

## 🔧 Конфигурация

### Переменные окружения

Скопируйте \.env.example\ в \.env\ и настройте под ваши нужды:

- **База данных**: настройки PostgreSQL
- **Кеш**: настройки Redis
- **Очереди**: настройки RabbitMQ
- **JWT**: секретные ключи для токенов
- **Платежи**: ключи Stripe
- **Email**: настройки SMTP
- **API ключи**: интеграции с маркетплейсами и поставщиками

### SSL сертификаты

Для production используйте Let's Encrypt:

\\\ash
# Получение SSL сертификатов
sudo certbot certonly --standalone -d yourdomain.com
\\\

## 🐛 Решение проблем

### Docker не запускается

1. Убедитесь что Docker Desktop запущен
2. Проверьте что WSL 2 включен (Windows)
3. Освободите порты 3000, 3001, 5432, 6379

### База данных не подключается

1. Проверьте что PostgreSQL контейнер запущен: \docker compose ps\
2. Проверьте логи: \docker compose logs postgres\
3. Убедитесь что порт 5432 свободен

### Frontend не билдится

1. Проверьте что файл \rontend/nginx.conf\ существует
2. Убедитесь что \package-lock.json\ создан: \
pm install\
3. Очистите кеш: \
pm cache clean --force\

## 📚 API Документация

API документация доступна по адресу: https://api.moduletrade.ru/api-docs

### Основные эндпоинты

- \POST /api/auth/login\ - Авторизация
- \GET /api/products\ - Список товаров
- \POST /api/sync/import\ - Импорт товаров
- \GET /api/marketplaces\ - Маркетплейсы
- \GET /api/suppliers\ - Поставщики

## 🚀 Развертывание

### Production

1. **Настройте домен и DNS записи**
2. **Получите SSL сертификаты**
3. **Настройте переменные окружения**
4. **Запустите на сервере:**

\\\ash
git clone git@github.com:Way7Creation/moduletrade.ru.git
cd moduletrade.ru
cp .env.example .env
# Настройте .env для production
docker compose up -d --build
\\\

### Мониторинг

- **Логи**: \docker compose logs -f\
- **Метрики**: \docker stats\
- **Бэкапы**: Настройте автоматические бэкапы PostgreSQL

## 🤝 Участие в разработке

1. Форкните репозиторий
2. Создайте ветку для фичи: \git checkout -b feature/amazing-feature\
3. Сделайте коммит: \git commit -m 'Add amazing feature'\
4. Запушьте ветку: \git push origin feature/amazing-feature\
5. Создайте Pull Request

## 📝 Лицензия

Этот проект является проприетарным программным обеспечением Way7Creation.

## 📞 Поддержка

- **Email**: support@moduletrade.ru
- **Документация**: https://docs.moduletrade.ru
- **Issues**: https://github.com/Way7Creation/moduletrade.ru/issues

---

**© 2024 Way7Creation. Все права защищены.**
