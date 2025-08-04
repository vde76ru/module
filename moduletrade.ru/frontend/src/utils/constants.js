// ===================================================
// ФАЙЛ: frontend/src/utils/constants.js
// ✅ ИСПРАВЛЕНО: Добавлены недостающие функции для работы с правами
// ===================================================

// =====================================
// API Endpoints
// =====================================
export const API_ENDPOINTS = {
  // Авторизация
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',
  CHANGE_PASSWORD: '/auth/change-password',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',

  // Товары
  PRODUCTS: '/products',
  PRODUCT_DETAILS: '/products/:id',
  PRODUCTS_IMPORT: '/products/import',
  PRODUCTS_EXPORT: '/products/export',
  PRODUCTS_SEARCH: '/products/search',
  PRODUCTS_BULK_UPDATE: '/products/bulk-update',
  PRODUCTS_BULK_DELETE: '/products/bulk-delete',

  // Склады
  WAREHOUSES: '/warehouses',
  WAREHOUSE_DETAILS: '/warehouses/:id',
  WAREHOUSE_TRANSFER: '/warehouses/transfer',
  WAREHOUSE_STOCK: '/warehouses/:id/stock',
  WAREHOUSE_MOVEMENTS: '/warehouses/:id/movements',
  WAREHOUSE_UPDATE_STOCK: '/warehouses/stock',

  // Синхронизация
  SYNC_STOCK: '/sync/stock',
  SYNC_ORDERS: '/sync/orders',
  SYNC_LOGS: '/sync/logs',
  SYNC_STATUS: '/sync/status',

  // Поставщики
  SUPPLIERS: '/suppliers',
  SUPPLIER_DETAILS: '/suppliers/:id',
  SUPPLIER_PRODUCTS: '/suppliers/:id/products',
  SUPPLIER_SYNC: '/suppliers/:id/sync',

  // Маркетплейсы
  MARKETPLACES: '/marketplaces',
  MARKETPLACE_DETAILS: '/marketplaces/:id',
  MARKETPLACE_ORDERS: '/marketplaces/:id/orders',
  MARKETPLACE_CONNECT: '/marketplaces/connect',
  MARKETPLACE_TEST: '/marketplaces/:id/test',

  // Заказы
  ORDERS: '/orders',
  ORDER_DETAILS: '/orders/:id',
  ORDER_STATUS: '/orders/:id/status',
  ORDERS_BULK_UPDATE: '/orders/bulk-update',
  ORDERS_EXPORT: '/orders/export',

  // Пользователи
  USERS: '/users',
  USER_DETAILS: '/users/:id',

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
// Статусы заказов (на основе БД)
// =====================================
export const ORDER_STATUSES = {
  NEW: 'new',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
};

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUSES.NEW]: 'Новый',
  [ORDER_STATUSES.CONFIRMED]: 'Подтвержден',
  [ORDER_STATUSES.PROCESSING]: 'В обработке',
  [ORDER_STATUSES.SHIPPED]: 'Отправлен',
  [ORDER_STATUSES.DELIVERED]: 'Доставлен',
  [ORDER_STATUSES.CANCELLED]: 'Отменен',
  [ORDER_STATUSES.RETURNED]: 'Возвращен',
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
// Статусы товаров
// =====================================
export const PRODUCT_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OUT_OF_STOCK: 'out_of_stock',
  DISCONTINUED: 'discontinued',
};

export const PRODUCT_STATUS_LABELS = {
  [PRODUCT_STATUSES.ACTIVE]: 'Активный',
  [PRODUCT_STATUSES.INACTIVE]: 'Неактивный',
  [PRODUCT_STATUSES.OUT_OF_STOCK]: 'Нет в наличии',
  [PRODUCT_STATUSES.DISCONTINUED]: 'Снят с производства',
};

export const PRODUCT_STATUS_COLORS = {
  [PRODUCT_STATUSES.ACTIVE]: 'green',
  [PRODUCT_STATUSES.INACTIVE]: 'default',
  [PRODUCT_STATUSES.OUT_OF_STOCK]: 'orange',
  [PRODUCT_STATUSES.DISCONTINUED]: 'red',
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