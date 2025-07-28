// frontend/src/utils/constants.js

// API Endpoints
export const API_ENDPOINTS = {
  // Авторизация
  LOGIN: '/auth/login',
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',
  
  // Товары
  PRODUCTS: '/products',
  PRODUCTS_IMPORT: '/products/import',
  PRODUCTS_EXPORT: '/products/export',
  
  // Склады
  WAREHOUSES: '/warehouses',
  WAREHOUSE_TRANSFER: '/warehouses/transfer',
  WAREHOUSE_STOCK: '/warehouses/:id/stock',
  
  // Синхронизация
  SYNC_STOCK: '/sync/stock',
  SYNC_ORDERS: '/sync/orders',
  SYNC_LOGS: '/sync/logs',
  
  // Поставщики
  SUPPLIERS: '/suppliers',
  SUPPLIER_PRODUCTS: '/suppliers/:id/products',
  
  // Маркетплейсы
  MARKETPLACES: '/marketplaces',
  MARKETPLACE_ORDERS: '/marketplaces/:id/orders',
  
  // Заказы
  ORDERS: '/orders',
  ORDER_DETAILS: '/orders/:id',
  ORDER_STATUS: '/orders/:id/status',
  
  // Аналитика
  ANALYTICS_DASHBOARD: '/analytics/dashboard',
  ANALYTICS_SALES: '/analytics/sales',
  ANALYTICS_PROFIT: '/analytics/profit',
  
  // Биллинг
  BILLING_TARIFFS: '/billing/tariffs',
  BILLING_USAGE: '/billing/usage',
  BILLING_TRANSACTIONS: '/billing/transactions',
  
  // Настройки
  SETTINGS_PROFILE: '/settings/profile',
  SETTINGS_INTEGRATIONS: '/settings/integrations',
  SETTINGS_NOTIFICATIONS: '/settings/notifications',
};

// Статусы товаров
export const PRODUCT_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
};

export const PRODUCT_STATUS_LABELS = {
  [PRODUCT_STATUSES.DRAFT]: 'Черновик',
  [PRODUCT_STATUSES.ACTIVE]: 'Активен',
  [PRODUCT_STATUSES.INACTIVE]: 'Неактивен',
  [PRODUCT_STATUSES.ARCHIVED]: 'Архивирован',
};

// Типы источников товаров
export const PRODUCT_SOURCE_TYPES = {
  INTERNAL: 'internal',
  ETM: 'etm',
  RS24: 'rs24',
  CUSTOM: 'custom',
};

export const PRODUCT_SOURCE_LABELS = {
  [PRODUCT_SOURCE_TYPES.INTERNAL]: 'Внутренний',
  [PRODUCT_SOURCE_TYPES.ETM]: 'ETM',
  [PRODUCT_SOURCE_TYPES.RS24]: 'RS24',
  [PRODUCT_SOURCE_TYPES.CUSTOM]: 'Пользовательский',
};

// Типы складов
export const WAREHOUSE_TYPES = {
  PHYSICAL: 'physical',
  VIRTUAL: 'virtual',
  MULTI: 'multi',
};

export const WAREHOUSE_TYPE_LABELS = {
  [WAREHOUSE_TYPES.PHYSICAL]: 'Физический',
  [WAREHOUSE_TYPES.VIRTUAL]: 'Виртуальный',
  [WAREHOUSE_TYPES.MULTI]: 'Мульти-склад',
};

// Статусы заказов
export const ORDER_STATUSES = {
  NEW: 'new',
  PENDING: 'pending',
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
  [ORDER_STATUSES.PENDING]: 'Ожидание',
  [ORDER_STATUSES.CONFIRMED]: 'Подтвержден',
  [ORDER_STATUSES.PROCESSING]: 'В обработке',
  [ORDER_STATUSES.SHIPPED]: 'Отправлен',
  [ORDER_STATUSES.DELIVERED]: 'Доставлен',
  [ORDER_STATUSES.CANCELLED]: 'Отменен',
  [ORDER_STATUSES.RETURNED]: 'Возвращен',
  [ORDER_STATUSES.REFUNDED]: 'Возмещен',
};

// Статусы синхронизации
export const SYNC_STATUSES = {
  SUCCESS: 'success',
  ERROR: 'error',
  PROCESSING: 'processing',
  WARNING: 'warning',
};

export const SYNC_STATUS_LABELS = {
  [SYNC_STATUSES.SUCCESS]: 'Успешно',
  [SYNC_STATUSES.ERROR]: 'Ошибка',
  [SYNC_STATUSES.PROCESSING]: 'Обработка',
  [SYNC_STATUSES.WARNING]: 'Предупреждение',
};

// Типы синхронизации
export const SYNC_TYPES = {
  STOCK: 'stock',
  ORDERS: 'orders',
  PRODUCTS: 'products',
  PRICES: 'prices',
};

export const SYNC_TYPE_LABELS = {
  [SYNC_TYPES.STOCK]: 'Остатки',
  [SYNC_TYPES.ORDERS]: 'Заказы',
  [SYNC_TYPES.PRODUCTS]: 'Товары',
  [SYNC_TYPES.PRICES]: 'Цены',
};

// Маркетплейсы
export const MARKETPLACES = {
  OZON: 'ozon',
  WILDBERRIES: 'wildberries',
  YANDEX_MARKET: 'yandex_market',
  AVITO: 'avito',
  SBER_MARKET: 'sber_market',
};

export const MARKETPLACE_LABELS = {
  [MARKETPLACES.OZON]: 'Ozon',
  [MARKETPLACES.WILDBERRIES]: 'Wildberries',
  [MARKETPLACES.YANDEX_MARKET]: 'Яндекс.Маркет',
  [MARKETPLACES.AVITO]: 'Авито',
  [MARKETPLACES.SBER_MARKET]: 'СберМегаМаркет',
};

// Поставщики
export const SUPPLIERS = {
  ETM: 'etm',
  RS24: 'rs24',
  CUSTOM: 'custom',
};

export const SUPPLIER_LABELS = {
  [SUPPLIERS.ETM]: 'ETM',
  [SUPPLIERS.RS24]: 'RS24',
  [SUPPLIERS.CUSTOM]: 'Пользовательский',
};

// Тарифы
export const TARIFF_TYPES = {
  FREE: 'free',
  BASIC: 'basic',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
};

export const TARIFF_LABELS = {
  [TARIFF_TYPES.FREE]: 'Бесплатный',
  [TARIFF_TYPES.BASIC]: 'Базовый',
  [TARIFF_TYPES.PROFESSIONAL]: 'Профессиональный',
  [TARIFF_TYPES.ENTERPRISE]: 'Корпоративный',
};

// Роли пользователей
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

// Размеры пагинации
export const PAGINATION_SIZES = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 50;

// Форматы экспорта
export const EXPORT_FORMATS = {
  XLSX: 'xlsx',
  CSV: 'csv',
  YML: 'yml',
  XML: 'xml',
  JSON: 'json',
};

export const EXPORT_FORMAT_LABELS = {
  [EXPORT_FORMATS.XLSX]: 'Excel (XLSX)',
  [EXPORT_FORMATS.CSV]: 'CSV',
  [EXPORT_FORMATS.YML]: 'YML (Яндекс.Маркет)',
  [EXPORT_FORMATS.XML]: 'XML',
  [EXPORT_FORMATS.JSON]: 'JSON',
};

// Типы файлов для импорта
export const IMPORT_FILE_TYPES = {
  XLSX: '.xlsx',
  XLS: '.xls',
  CSV: '.csv',
  XML: '.xml',
};

// Максимальные размеры файлов (в байтах)
export const MAX_FILE_SIZES = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  IMPORT: 50 * 1024 * 1024, // 50MB
};

// Типы уведомлений
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
};

// Период обновления дан