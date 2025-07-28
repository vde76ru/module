// frontend/src/utils/constants.js

// =====================================
// API Endpoints
// =====================================
export const API_ENDPOINTS = {
  // Авторизация
  LOGIN: '/auth/login',
  REGISTER: '/auth/register', // ДОБАВЛЕНО!
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',
  CHANGE_PASSWORD: '/auth/change-password',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',

  // Товары
  PRODUCTS: '/products',
  PRODUCTS_IMPORT: '/products/import',
  PRODUCTS_EXPORT: '/products/export',
  PRODUCTS_SEARCH: '/products/search',
  PRODUCTS_BULK_UPDATE: '/products/bulk-update',
  PRODUCTS_BULK_DELETE: '/products/bulk-delete',

  // Склады
  WAREHOUSES: '/warehouses',
  WAREHOUSE_TRANSFER: '/warehouses/transfer',
  WAREHOUSE_STOCK: '/warehouses/:id/stock',
  WAREHOUSE_MOVEMENTS: '/warehouses/:id/movements',

  // Синхронизация
  SYNC_STOCK: '/sync/stock',
  SYNC_ORDERS: '/sync/orders',
  SYNC_LOGS: '/sync/logs',
  SYNC_STATUS: '/sync/status',

  // Поставщики
  SUPPLIERS: '/suppliers',
  SUPPLIER_PRODUCTS: '/suppliers/:id/products',
  SUPPLIER_SYNC: '/suppliers/:id/sync',

  // Маркетплейсы
  MARKETPLACES: '/marketplaces',
  MARKETPLACE_ORDERS: '/marketplaces/:id/orders',
  MARKETPLACE_CONNECT: '/marketplaces/connect',
  MARKETPLACE_TEST: '/marketplaces/:id/test',

  // Заказы
  ORDERS: '/orders',
  ORDER_DETAILS: '/orders/:id',
  ORDER_STATUS: '/orders/:id/status',
  ORDERS_BULK_UPDATE: '/orders/bulk-update',
  ORDERS_EXPORT: '/orders/export',

  // Аналитика
  ANALYTICS_DASHBOARD: '/analytics/dashboard',
  ANALYTICS_SALES: '/analytics/sales',
  ANALYTICS_PROFIT: '/analytics/profit',
  ANALYTICS_INVENTORY: '/analytics/inventory',
  ANALYTICS_EXPORT: '/analytics/export',

  // Биллинг
  BILLING_TARIFFS: '/billing/tariffs',
  BILLING_USAGE: '/billing/usage',
  BILLING_TRANSACTIONS: '/billing/transactions',
  BILLING_CHANGE_TARIFF: '/billing/change-tariff',
  BILLING_PAYMENT_METHODS: '/billing/payment-methods',

  // Настройки
  SETTINGS_PROFILE: '/settings/profile',
  SETTINGS_INTEGRATIONS: '/settings/integrations',
  SETTINGS_NOTIFICATIONS: '/settings/notifications',
  SETTINGS_API_KEYS: '/settings/api-keys',
};

// =====================================
// Storage Keys для localStorage
// =====================================
export const STORAGE_KEYS = {
  TOKEN: 'token',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  LANGUAGE: 'language',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebarCollapsed',
  TABLE_SETTINGS: 'tableSettings',
};

// =====================================
// Статусы товаров
// =====================================
export const PRODUCT_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
  OUT_OF_STOCK: 'out_of_stock',
};

export const PRODUCT_STATUS_LABELS = {
  [PRODUCT_STATUSES.DRAFT]: 'Черновик',
  [PRODUCT_STATUSES.ACTIVE]: 'Активен',
  [PRODUCT_STATUSES.INACTIVE]: 'Неактивен',
  [PRODUCT_STATUSES.ARCHIVED]: 'Архивирован',
  [PRODUCT_STATUSES.OUT_OF_STOCK]: 'Нет в наличии',
};

export const PRODUCT_STATUS_COLORS = {
  [PRODUCT_STATUSES.DRAFT]: 'default',
  [PRODUCT_STATUSES.ACTIVE]: 'success',
  [PRODUCT_STATUSES.INACTIVE]: 'warning',
  [PRODUCT_STATUSES.ARCHIVED]: 'default',
  [PRODUCT_STATUSES.OUT_OF_STOCK]: 'error',
};

// =====================================
// Типы источников товаров
// =====================================
export const PRODUCT_SOURCE_TYPES = {
  INTERNAL: 'internal',
  ETM: 'etm',
  RS24: 'rs24',
  CUSTOM: 'custom',
  IMPORT: 'import',
};

export const PRODUCT_SOURCE_LABELS = {
  [PRODUCT_SOURCE_TYPES.INTERNAL]: 'Внутренний',
  [PRODUCT_SOURCE_TYPES.ETM]: 'ETM',
  [PRODUCT_SOURCE_TYPES.RS24]: 'RS24',
  [PRODUCT_SOURCE_TYPES.CUSTOM]: 'Пользовательский',
  [PRODUCT_SOURCE_TYPES.IMPORT]: 'Импорт',
};

// =====================================
// Маркетплейсы
// =====================================
export const MARKETPLACES = {
  OZON: 'ozon',
  WILDBERRIES: 'wildberries',
  YANDEX_MARKET: 'yandex_market',
  AVITO: 'avito',
  SBER_MARKET: 'sber_market',
  ALIBABA: 'alibaba',
};

export const MARKETPLACE_LABELS = {
  [MARKETPLACES.OZON]: 'Ozon',
  [MARKETPLACES.WILDBERRIES]: 'Wildberries',
  [MARKETPLACES.YANDEX_MARKET]: 'Яндекс.Маркет',
  [MARKETPLACES.AVITO]: 'Авито',
  [MARKETPLACES.SBER_MARKET]: 'СберМегаМаркет',
  [MARKETPLACES.ALIBABA]: 'Alibaba',
};

export const MARKETPLACE_COLORS = {
  [MARKETPLACES.OZON]: '#005BFF',
  [MARKETPLACES.WILDBERRIES]: '#CB11AB',
  [MARKETPLACES.YANDEX_MARKET]: '#FFCC00',
  [MARKETPLACES.AVITO]: '#00D4AA',
  [MARKETPLACES.SBER_MARKET]: '#21A038',
  [MARKETPLACES.ALIBABA]: '#FF6A00',
};

// =====================================
// Поставщики
// =====================================
export const SUPPLIERS = {
  ETM: 'etm',
  RS24: 'rs24',
  CUSTOM: 'custom',
  MANUAL: 'manual',
};

export const SUPPLIER_LABELS = {
  [SUPPLIERS.ETM]: 'ETM',
  [SUPPLIERS.RS24]: 'RS24',
  [SUPPLIERS.CUSTOM]: 'Пользовательский',
  [SUPPLIERS.MANUAL]: 'Ручной ввод',
};

// =====================================
// Тарифы
// =====================================
export const TARIFF_TYPES = {
  FREE: 'free',
  BASIC: 'basic',
  STANDARD: 'standard',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
};

export const TARIFF_LABELS = {
  [TARIFF_TYPES.FREE]: 'Бесплатный',
  [TARIFF_TYPES.BASIC]: 'Базовый',
  [TARIFF_TYPES.STANDARD]: 'Стандарт',
  [TARIFF_TYPES.PROFESSIONAL]: 'Профессиональный',
  [TARIFF_TYPES.ENTERPRISE]: 'Корпоративный',
};

export const TARIFF_COLORS = {
  [TARIFF_TYPES.FREE]: 'default',
  [TARIFF_TYPES.BASIC]: 'blue',
  [TARIFF_TYPES.STANDARD]: 'green',
  [TARIFF_TYPES.PROFESSIONAL]: 'gold',
  [TARIFF_TYPES.ENTERPRISE]: 'purple',
};

// =====================================
// Роли пользователей
// =====================================
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
};

export const USER_ROLE_LABELS = {
  [USER_ROLES.ADMIN]: 'Администратор',
  [USER_ROLES.MANAGER]: 'Менеджер',
  [USER_ROLES.OPERATOR]: 'Оператор',
  [USER_ROLES.VIEWER]: 'Просмотр',
};

export const USER_ROLE_COLORS = {
  [USER_ROLES.ADMIN]: 'red',
  [USER_ROLES.MANAGER]: 'blue',
  [USER_ROLES.OPERATOR]: 'green',
  [USER_ROLES.VIEWER]: 'default',
};

// =====================================
// Статусы заказов
// =====================================
export const ORDER_STATUSES = {
  NEW: 'new',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
  REFUNDED: 'refunded',
};

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUSES.NEW]: 'Новый',
  [ORDER_STATUSES.CONFIRMED]: 'Подтвержден',
  [ORDER_STATUSES.PROCESSING]: 'В обработке',
  [ORDER_STATUSES.SHIPPED]: 'Отправлен',
  [ORDER_STATUSES.DELIVERED]: 'Доставлен',
  [ORDER_STATUSES.CANCELLED]: 'Отменен',
  [ORDER_STATUSES.RETURNED]: 'Возвращен',
  [ORDER_STATUSES.REFUNDED]: 'Возмещен',
};

export const ORDER_STATUS_COLORS = {
  [ORDER_STATUSES.NEW]: 'blue',
  [ORDER_STATUSES.CONFIRMED]: 'cyan',
  [ORDER_STATUSES.PROCESSING]: 'orange',
  [ORDER_STATUSES.SHIPPED]: 'geekblue',
  [ORDER_STATUSES.DELIVERED]: 'green',
  [ORDER_STATUSES.CANCELLED]: 'red',
  [ORDER_STATUSES.RETURNED]: 'volcano',
  [ORDER_STATUSES.REFUNDED]: 'purple',
};

// =====================================
// Статусы синхронизации
// =====================================
export const SYNC_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
  CANCELLED: 'cancelled',
};

export const SYNC_STATUS_LABELS = {
  [SYNC_STATUSES.PENDING]: 'Ожидание',
  [SYNC_STATUSES.RUNNING]: 'Выполняется',
  [SYNC_STATUSES.SUCCESS]: 'Успешно',
  [SYNC_STATUSES.ERROR]: 'Ошибка',
  [SYNC_STATUSES.CANCELLED]: 'Отменено',
};

export const SYNC_STATUS_COLORS = {
  [SYNC_STATUSES.PENDING]: 'default',
  [SYNC_STATUSES.RUNNING]: 'processing',
  [SYNC_STATUSES.SUCCESS]: 'success',
  [SYNC_STATUSES.ERROR]: 'error',
  [SYNC_STATUSES.CANCELLED]: 'warning',
};

// =====================================
// Размеры пагинации
// =====================================
export const PAGINATION_SIZES = [10, 20, 50, 100, 200];
export const DEFAULT_PAGE_SIZE = 50;

// =====================================
// Форматы экспорта
// =====================================
export const EXPORT_FORMATS = {
  XLSX: 'xlsx',
  CSV: 'csv',
  YML: 'yml',
  XML: 'xml',
  JSON: 'json',
  PDF: 'pdf',
};

export const EXPORT_FORMAT_LABELS = {
  [EXPORT_FORMATS.XLSX]: 'Excel (XLSX)',
  [EXPORT_FORMATS.CSV]: 'CSV',
  [EXPORT_FORMATS.YML]: 'YML (Яндекс.Маркет)',
  [EXPORT_FORMATS.XML]: 'XML',
  [EXPORT_FORMATS.JSON]: 'JSON',
  [EXPORT_FORMATS.PDF]: 'PDF',
};

// =====================================
// Типы файлов для импорта
// =====================================
export const IMPORT_FILE_TYPES = {
  XLSX: '.xlsx',
  XLS: '.xls',
  CSV: '.csv',
  XML: '.xml',
  JSON: '.json',
};

export const ACCEPTED_FILE_TYPES = Object.values(IMPORT_FILE_TYPES).join(',');

// =====================================
// Максимальные размеры файлов (в байтах)
// =====================================
export const MAX_FILE_SIZES = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  IMPORT: 100 * 1024 * 1024, // 100MB
  EXPORT: 500 * 1024 * 1024, // 500MB
};

// =====================================
// Типы уведомлений
// =====================================
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
};

// =====================================
// Период обновления данных (в миллисекундах)
// =====================================
export const REFRESH_INTERVALS = {
  DASHBOARD: 30000, // 30 секунд
  ORDERS: 60000, // 1 минута
  SYNC_STATUS: 5000, // 5 секунд
  STOCK: 120000, // 2 минуты
};

// =====================================
// Настройки приложения
// =====================================
export const APP_CONFIG = {
  NAME: 'ModuleTrade',
  VERSION: '1.0.0',
  SUPPORT_EMAIL: 'support@moduletrade.ru',
  DOCS_URL: 'https://docs.moduletrade.ru',
  DEFAULT_LANGUAGE: 'ru',
  DEFAULT_CURRENCY: 'RUB',
  DEFAULT_TIMEZONE: 'Europe/Moscow',
};

// =====================================
// Регулярные выражения для валидации
// =====================================
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  ARTICLE: /^[A-Za-z0-9\-_]{3,50}$/,
  BARCODE: /^[0-9]{8,14}$/,
  PRICE: /^\d+(\.\d{1,2})?$/,
};

// =====================================
// Цвета для статусов (дополнительные)
// =====================================
export const STATUS_COLORS = {
  ACTIVE: '#52c41a',
  INACTIVE: '#faad14',
  ERROR: '#ff4d4f',
  SUCCESS: '#52c41a',
  WARNING: '#faad14',
  INFO: '#1890ff',
  DEFAULT: '#d9d9d9',
};

// =====================================
// Форматы даты и времени
// =====================================
export const DATE_FORMATS = {
  DATE: 'DD.MM.YYYY',
  DATETIME: 'DD.MM.YYYY HH:mm',
  TIME: 'HH:mm',
  ISO: 'YYYY-MM-DD',
  ISO_DATETIME: 'YYYY-MM-DD HH:mm:ss',
};

// =====================================
// Валюты
// =====================================
export const CURRENCIES = {
  RUB: 'RUB',
  USD: 'USD',
  EUR: 'EUR',
  CNY: 'CNY',
};

export const CURRENCY_LABELS = {
  [CURRENCIES.RUB]: '₽',
  [CURRENCIES.USD]: '$',
  [CURRENCIES.EUR]: '€',
  [CURRENCIES.CNY]: '¥',
};

// =====================================
// Единицы измерения
// =====================================
export const UNITS = {
  PIECE: 'pcs',
  KILOGRAM: 'kg',
  GRAM: 'g',
  LITER: 'l',
  MILLILITER: 'ml',
  METER: 'm',
  CENTIMETER: 'cm',
  SQUARE_METER: 'm2',
};

export const UNIT_LABELS = {
  [UNITS.PIECE]: 'шт',
  [UNITS.KILOGRAM]: 'кг',
  [UNITS.GRAM]: 'г',
  [UNITS.LITER]: 'л',
  [UNITS.MILLILITER]: 'мл',
  [UNITS.METER]: 'м',
  [UNITS.CENTIMETER]: 'см',
  [UNITS.SQUARE_METER]: 'м²',
};