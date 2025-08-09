// ===================================================
// ФАЙЛ: frontend/src/utils/constants.js
// ✅ ИСПРАВЛЕНО: API endpoints приведены в соответствие с бэкендом
// ===================================================

// =====================================
// API Endpoints (ИСПРАВЛЕНО под бэкенд)
// =====================================
export const API_ENDPOINTS = {
  // Авторизация
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  REFRESH: '/api/auth/refresh',
  LOGOUT: '/api/auth/logout',
  ME: '/api/auth/me',
  CHANGE_PASSWORD: '/api/auth/change-password',
  FORGOT_PASSWORD: '/api/auth/forgot-password',
  RESET_PASSWORD: '/api/auth/reset-password',

  // Товары
  PRODUCTS: '/api/products',
  PRODUCT_DETAILS: '/api/products/:id',
  PRODUCTS_IMPORT: '/api/product-import',
  PRODUCTS_EXPORT: '/api/products/export',
  PRODUCTS_SEARCH: '/api/products/search',
  PRODUCTS_BULK_UPDATE: '/api/products/bulk-update',
  PRODUCTS_BULK_DELETE: '/api/products/bulk-delete',
  PRODUCTS_CATEGORIES: '/api/products/categories/list',

  // Склады
  WAREHOUSES: '/api/warehouses',
  WAREHOUSE_DETAILS: '/api/warehouses/:id',
  WAREHOUSE_TRANSFER: '/api/warehouses/transfer',
  WAREHOUSE_STOCK: '/api/warehouses/:id/stock',
  WAREHOUSE_MOVEMENTS: '/api/warehouses/:id/movements',
  WAREHOUSE_UPDATE_STOCK: '/api/warehouses/stock',

  // Синхронизация
  SYNC_STOCK: '/api/sync/stock',
  SYNC_ORDERS: '/api/sync/orders',
  SYNC_LOGS: '/api/sync/history',
  SYNC_STATUS: '/api/sync/status',

  // Поставщики
  SUPPLIERS: '/api/suppliers',
  SUPPLIER_DETAILS: '/api/suppliers/:id',
  SUPPLIER_PRODUCTS: '/api/suppliers/:id/products',
  SUPPLIER_SYNC: '/api/suppliers/:id/sync',

  // Маркетплейсы
  MARKETPLACES: '/api/marketplaces',
  MARKETPLACE_DETAILS: '/api/marketplaces/:id',
  MARKETPLACE_ORDERS: '/api/marketplaces/:id/orders',
  MARKETPLACE_CONNECT: '/api/marketplaces',
  MARKETPLACE_TEST: '/api/marketplaces/:id/test',

  // Заказы
  ORDERS: '/api/orders',
  ORDER_DETAILS: '/api/orders/:id',
  ORDER_STATUS: '/api/orders/:id/status',
  ORDERS_BULK_UPDATE: '/api/orders/bulk-update',
  ORDERS_EXPORT: '/api/orders/export',

  // Пользователи
  USERS: '/api/users',
  USER_DETAILS: '/api/users/:id',

  // Аналитика
  ANALYTICS_DASHBOARD: '/api/analytics/dashboard',
  ANALYTICS_SALES: '/api/analytics/sales',
  ANALYTICS_PROFIT: '/api/analytics/profit',
  ANALYTICS_PRODUCTS: '/api/analytics/products',
  ANALYTICS_POPULARITY: '/api/analytics/popularity',
  ANALYTICS_WAREHOUSE: '/api/analytics/warehouse',
  ANALYTICS_MARKETPLACE: '/api/analytics/marketplace',
  ANALYTICS_BRAND: '/api/analytics/brand',
  ANALYTICS_CATEGORY: '/api/analytics/category',
  ANALYTICS_EXPORT: '/api/analytics/export',

  // Биллинг
  BILLING_TARIFFS: '/api/billing/tariffs',
  BILLING_USAGE: '/api/billing/usage',
  BILLING_CURRENT_TARIFF: '/api/billing/current-tariff',
  BILLING_SUBSCRIPTION_INFO: '/api/billing/subscription-info',
  BILLING_TRANSACTIONS: '/api/billing/transactions',
  BILLING_CHANGE_TARIFF: '/api/billing/change-tariff',
  BILLING_CREATE_PAYMENT_INTENT: '/api/billing/create-payment-intent',

  // Настройки
  SETTINGS_PROFILE: '/api/settings/profile',
  SETTINGS_INTEGRATIONS: '/api/settings/integrations',
  SETTINGS_NOTIFICATIONS: '/api/settings/notifications',
  SETTINGS_API_KEYS: '/api/settings/api-keys',

  // Словари
  DICTIONARIES: '/api/dictionaries',
  DICTIONARIES_BRANDS: '/api/dictionaries/brands',
  DICTIONARIES_CATEGORIES: '/api/dictionaries/categories',
  DICTIONARIES_ATTRIBUTES: '/api/dictionaries/attributes',

  // Аудит
  AUDIT_LOGS: '/api/audit/logs',
  AUDIT_EXPORT: '/api/audit/export',
};

// =====================================
// Storage Keys
// =====================================
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
  THEME: 'theme',
  LANGUAGE: 'language',
  PREFERENCES: 'userPreferences',
};



// =====================================
// Source Types (из БД)
// =====================================
export const SOURCE_TYPES = {
  MANUAL: 'manual',
  IMPORT: 'import',
  API: 'api'
};

export const SOURCE_TYPE_LABELS = {
  [SOURCE_TYPES.MANUAL]: 'Ручной ввод',
  [SOURCE_TYPES.IMPORT]: 'Импорт',
  [SOURCE_TYPES.API]: 'API'
};

export const SOURCE_TYPE_COLORS = {
  [SOURCE_TYPES.MANUAL]: 'blue',
  [SOURCE_TYPES.IMPORT]: 'green',
  [SOURCE_TYPES.API]: 'purple'
};

// =====================================
// Base Units (из БД)
// =====================================
export const BASE_UNITS = {
  PIECE: 'шт',
  KG: 'кг',
  LITER: 'л',
  METER: 'м',
  SQUARE_METER: 'м²',
  CUBIC_METER: 'м³'
};

export const BASE_UNIT_LABELS = {
  [BASE_UNITS.PIECE]: 'Штуки',
  [BASE_UNITS.KG]: 'Килограммы',
  [BASE_UNITS.LITER]: 'Литры',
  [BASE_UNITS.METER]: 'Метры',
  [BASE_UNITS.SQUARE_METER]: 'Квадратные метры',
  [BASE_UNITS.CUBIC_METER]: 'Кубические метры'
};

// =====================================
// Subscription Statuses (из БД)
// =====================================
export const SUBSCRIPTION_STATUSES = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
};

export const SUBSCRIPTION_STATUS_LABELS = {
  [SUBSCRIPTION_STATUSES.TRIAL]: 'Пробный период',
  [SUBSCRIPTION_STATUSES.ACTIVE]: 'Активна',
  [SUBSCRIPTION_STATUSES.EXPIRED]: 'Истекла',
  [SUBSCRIPTION_STATUSES.CANCELLED]: 'Отменена'
};

// =====================================
// Warehouse Types (из БД)
// =====================================
export const WAREHOUSE_TYPES = {
  MAIN: 'main',
  REGIONAL: 'regional',
  PICKUP: 'pickup',
  VIRTUAL: 'virtual'
};

export const WAREHOUSE_TYPE_LABELS = {
  [WAREHOUSE_TYPES.MAIN]: 'Основной',
  [WAREHOUSE_TYPES.REGIONAL]: 'Региональный',
  [WAREHOUSE_TYPES.PICKUP]: 'Пункт выдачи',
  [WAREHOUSE_TYPES.VIRTUAL]: 'Виртуальный'
};

// =====================================
// Supplier Types (из БД)
// =====================================
export const SUPPLIER_TYPES = {
  API: 'api',
  MANUAL: 'manual',
  FILE: 'file'
};

export const SUPPLIER_TYPE_LABELS = {
  [SUPPLIER_TYPES.API]: 'API',
  [SUPPLIER_TYPES.MANUAL]: 'Ручной ввод',
  [SUPPLIER_TYPES.FILE]: 'Файл'
};



// =====================================
// Order Statuses (из БД)
// =====================================
export const ORDER_STATUSES = {
  NEW: 'new',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned'
};

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUSES.NEW]: 'Новый',
  [ORDER_STATUSES.CONFIRMED]: 'Подтвержден',
  [ORDER_STATUSES.PROCESSING]: 'В обработке',
  [ORDER_STATUSES.SHIPPED]: 'Отправлен',
  [ORDER_STATUSES.DELIVERED]: 'Доставлен',
  [ORDER_STATUSES.CANCELLED]: 'Отменен',
  [ORDER_STATUSES.RETURNED]: 'Возвращен'
};

export const ORDER_STATUS_COLORS = {
  [ORDER_STATUSES.NEW]: 'blue',
  [ORDER_STATUSES.CONFIRMED]: 'cyan',
  [ORDER_STATUSES.PROCESSING]: 'orange',
  [ORDER_STATUSES.SHIPPED]: 'purple',
  [ORDER_STATUSES.DELIVERED]: 'green',
  [ORDER_STATUSES.CANCELLED]: 'red',
  [ORDER_STATUSES.RETURNED]: 'yellow',
};

// =====================================
// Product Statuses (из БД)
// =====================================
export const PRODUCT_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OUT_OF_STOCK: 'out_of_stock',
  DISCONTINUED: 'discontinued',
  DRAFT: 'draft'
};

export const PRODUCT_STATUS_LABELS = {
  [PRODUCT_STATUSES.ACTIVE]: 'Активный',
  [PRODUCT_STATUSES.INACTIVE]: 'Неактивный',
  [PRODUCT_STATUSES.OUT_OF_STOCK]: 'Нет в наличии',
  [PRODUCT_STATUSES.DISCONTINUED]: 'Снят с производства',
  [PRODUCT_STATUSES.DRAFT]: 'Черновик'
};

export const PRODUCT_STATUS_COLORS = {
  [PRODUCT_STATUSES.ACTIVE]: 'green',
  [PRODUCT_STATUSES.INACTIVE]: 'default',
  [PRODUCT_STATUSES.OUT_OF_STOCK]: 'orange',
  [PRODUCT_STATUSES.DISCONTINUED]: 'red',
  [PRODUCT_STATUSES.DRAFT]: 'default'
};

// =====================================
// Маршруты
// =====================================
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',

  // Основные страницы
  PRODUCTS: '/products',
  PRODUCTS_CREATE: '/products/new',
  PRODUCTS_EDIT: '/products/:id/edit',

  ORDERS: '/orders',
  ORDERS_DETAILS: '/orders/:id',

  WAREHOUSES: '/warehouses',
  WAREHOUSES_CREATE: '/warehouses/new',
  WAREHOUSES_EDIT: '/warehouses/:id/edit',

  MARKETPLACES: '/marketplaces',
  SUPPLIERS: '/suppliers',
  USERS: '/users',
  ANALYTICS: '/analytics',
  SYNC: '/sync',

  // Настройки
  SETTINGS: '/settings',
  SETTINGS_PROFILE: '/settings/profile',
  SETTINGS_INTEGRATIONS: '/settings/integrations',
  SETTINGS_NOTIFICATIONS: '/settings/notifications',
  SETTINGS_API_KEYS: '/settings/api-keys',
};

// =====================================
// Роли пользователей (на основе БД)
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
// Права доступа (на основе middleware)
// =====================================
export const PERMISSIONS = {
  // Товары
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  PRODUCTS_IMPORT: 'products.import',
  PRODUCTS_EXPORT: 'products.export',

  // Заказы
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_DELETE: 'orders.delete',
  ORDERS_EXPORT: 'orders.export',

  // Маркетплейсы
  MARKETPLACES_VIEW: 'marketplaces.view',
  MARKETPLACES_CREATE: 'marketplaces.create',
  MARKETPLACES_UPDATE: 'marketplaces.update',
  MARKETPLACES_DELETE: 'marketplaces.delete',

  // Склады
  WAREHOUSES_VIEW: 'warehouses.view',
  WAREHOUSES_CREATE: 'warehouses.create',
  WAREHOUSES_UPDATE: 'warehouses.update',
  WAREHOUSES_DELETE: 'warehouses.delete',
  WAREHOUSES_TRANSFER: 'warehouses.transfer',

  // Поставщики
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_CREATE: 'suppliers.create',
  SUPPLIERS_UPDATE: 'suppliers.update',
  SUPPLIERS_DELETE: 'suppliers.delete',

  // Пользователи
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',

  // Синхронизация
  SYNC_EXECUTE: 'sync.execute',
  SYNC_VIEW_LOGS: 'sync.view_logs',

  // Аналитика
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',

  // Биллинг
  BILLING_VIEW: 'billing.view',
  BILLING_MANAGE: 'billing.manage',

  // Системные
  SYSTEM_ADMIN: 'system.admin',
  TENANT_ADMIN: 'tenant.admin',
};

// =====================================
// Права по ролям (на основе middleware)
// =====================================

// Базовые права для viewer
const VIEWER_PERMISSIONS = [
  PERMISSIONS.PRODUCTS_VIEW,
  PERMISSIONS.ORDERS_VIEW,
  PERMISSIONS.WAREHOUSES_VIEW,
  PERMISSIONS.SUPPLIERS_VIEW,
  PERMISSIONS.MARKETPLACES_VIEW,
  PERMISSIONS.ANALYTICS_VIEW,
];

// Дополнительные права для operator
const OPERATOR_ADDITIONAL_PERMISSIONS = [
  PERMISSIONS.PRODUCTS_UPDATE,
  PERMISSIONS.ORDERS_UPDATE,
  PERMISSIONS.WAREHOUSES_TRANSFER,
  PERMISSIONS.SYNC_EXECUTE,
];

// Дополнительные права для manager
const MANAGER_ADDITIONAL_PERMISSIONS = [
  PERMISSIONS.PRODUCTS_CREATE,
  PERMISSIONS.PRODUCTS_DELETE,
  PERMISSIONS.ORDERS_CREATE,
  PERMISSIONS.ORDERS_DELETE,
  PERMISSIONS.ORDERS_EXPORT,
  PERMISSIONS.WAREHOUSES_CREATE,
  PERMISSIONS.WAREHOUSES_UPDATE,
  PERMISSIONS.SUPPLIERS_UPDATE,
  PERMISSIONS.MARKETPLACES_UPDATE,
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.BILLING_VIEW,
];

export const ROLE_PERMISSIONS = {
  [USER_ROLES.VIEWER]: VIEWER_PERMISSIONS,
  [USER_ROLES.OPERATOR]: [
    ...VIEWER_PERMISSIONS,
    ...OPERATOR_ADDITIONAL_PERMISSIONS,
  ],
  [USER_ROLES.MANAGER]: [
    ...VIEWER_PERMISSIONS,
    ...OPERATOR_ADDITIONAL_PERMISSIONS,
    ...MANAGER_ADDITIONAL_PERMISSIONS,
  ],
  [USER_ROLES.ADMIN]: Object.values(PERMISSIONS),
};

// =====================================
// Маркетплейсы (на основе БД)
// =====================================
export const MARKETPLACES = {
  OZON: 'ozon',
  WILDBERRIES: 'wildberries',
  YANDEX_MARKET: 'yandex_market',
  AVITO: 'avito',
};

export const MARKETPLACE_LABELS = {
  [MARKETPLACES.OZON]: 'Ozon',
  [MARKETPLACES.WILDBERRIES]: 'Wildberries',
  [MARKETPLACES.YANDEX_MARKET]: 'Яндекс.Маркет',
  [MARKETPLACES.AVITO]: 'Avito',
};

export const MARKETPLACE_COLORS = {
  [MARKETPLACES.OZON]: '#005BFF',
  [MARKETPLACES.WILDBERRIES]: '#CB11AB',
  [MARKETPLACES.YANDEX_MARKET]: '#FFCC00',
  [MARKETPLACES.AVITO]: '#00D4AA',
};

// =====================================
// Поставщики (на основе БД)
// =====================================
export const SUPPLIERS = {
  ETM: 'etm',
  RS24: 'rs24',
  MANUAL: 'manual',
};

export const SUPPLIER_LABELS = {
  [SUPPLIERS.ETM]: 'ETM',
  [SUPPLIERS.RS24]: 'RS24',
  [SUPPLIERS.MANUAL]: 'Ручной ввод',
};



// =====================================
// ✅ ФУНКЦИИ ДЛЯ РАБОТЫ С ПРАВАМИ
// =====================================

/**
 * Проверка наличия права у роли
 * @param {string} userRole - Роль пользователя
 * @param {string} permission - Требуемое право
 * @returns {boolean}
 */
export const hasPermission = (userRole, permission) => {
  if (!userRole || !permission) return false;

  // Администраторы имеют все права
  if (userRole === USER_ROLES.ADMIN) return true;

  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
};

/**
 * Проверка наличия нескольких прав у роли
 * @param {string} userRole - Роль пользователя
 * @param {string[]} permissions - Массив требуемых прав
 * @param {boolean} requireAll - Требовать все права (true) или хотя бы одно (false)
 * @returns {boolean}
 */
export const hasPermissions = (userRole, permissions, requireAll = true) => {
  if (!userRole || !permissions || !Array.isArray(permissions)) return false;

  if (requireAll) {
    return permissions.every(permission => hasPermission(userRole, permission));
  } else {
    return permissions.some(permission => hasPermission(userRole, permission));
  }
};

/**
 * Проверка роли администратора
 * @param {string} userRole - Роль пользователя
 * @returns {boolean}
 */
export const isAdmin = (userRole) => {
  return userRole === USER_ROLES.ADMIN;
};

/**
 * Проверка роли суперадминистратора (в текущей системе не используется)
 * @param {string} userRole - Роль пользователя
 * @returns {boolean}
 */
export const isSuperAdmin = (userRole) => {
  // В текущей системе суперадминистраторов нет
  return false;
};

/**
 * Получение всех прав роли
 * @param {string} userRole - Роль пользователя
 * @returns {string[]}
 */
export const getRolePermissions = (userRole) => {
  if (!userRole) return [];

  // Администраторы имеют все права
  if (userRole === USER_ROLES.ADMIN) {
    return Object.values(PERMISSIONS);
  }

  return ROLE_PERMISSIONS[userRole] || [];
};