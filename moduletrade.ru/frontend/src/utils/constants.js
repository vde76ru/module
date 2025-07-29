// ===================================================
// ФАЙЛ: frontend/src/utils/constants.js
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
// Права по ролям (на основе middleware auth.js)
// =====================================
export const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.PRODUCTS_IMPORT,
    PERMISSIONS.PRODUCTS_EXPORT,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.ORDERS_DELETE,
    PERMISSIONS.MARKETPLACES_VIEW,
    PERMISSIONS.MARKETPLACES_CREATE,
    PERMISSIONS.MARKETPLACES_UPDATE,
    PERMISSIONS.MARKETPLACES_DELETE,
    PERMISSIONS.WAREHOUSES_VIEW,
    PERMISSIONS.WAREHOUSES_CREATE,
    PERMISSIONS.WAREHOUSES_UPDATE,
    PERMISSIONS.WAREHOUSES_DELETE,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.SUPPLIERS_CREATE,
    PERMISSIONS.SUPPLIERS_UPDATE,
    PERMISSIONS.SUPPLIERS_DELETE,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.SYNC_EXECUTE,
    PERMISSIONS.SYNC_VIEW_LOGS,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.TENANT_ADMIN,
  ],

  [USER_ROLES.MANAGER]: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_IMPORT,
    PERMISSIONS.PRODUCTS_EXPORT,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.MARKETPLACES_VIEW,
    PERMISSIONS.WAREHOUSES_VIEW,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.SYNC_EXECUTE,
    PERMISSIONS.SYNC_VIEW_LOGS,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.BILLING_VIEW,
  ],

  [USER_ROLES.OPERATOR]: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.WAREHOUSES_VIEW,
    PERMISSIONS.SYNC_EXECUTE,
    PERMISSIONS.ANALYTICS_VIEW,
  ],

  [USER_ROLES.VIEWER]: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.MARKETPLACES_VIEW,
    PERMISSIONS.WAREHOUSES_VIEW,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
};

// =====================================
// Функции для проверки прав
// =====================================
export const hasPermission = (userRole, permission) => {
  if (!userRole || !permission) return false;
  if (userRole === USER_ROLES.ADMIN) return true; // Админы имеют все права
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
};

export const hasPermissions = (userRole, permissions, requireAll = true) => {
  if (!userRole || !permissions || !Array.isArray(permissions)) return false;
  if (requireAll) {
    return permissions.every(permission => hasPermission(userRole, permission));
  } else {
    return permissions.some(permission => hasPermission(userRole, permission));
  }
};

export const isAdmin = (userRole) => {
  return userRole === USER_ROLES.ADMIN;
};

export const isSuperAdmin = (userRole) => {
  // В текущей БД нет super_admin роли, поэтому возвращаем false
  return false;
};

export const getRolePermissions = (userRole) => {
  return ROLE_PERMISSIONS[userRole] || [];
};

// =====================================
// Тарифы (на основе БД)
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
// Статусы товаров (на основе БД)
// =====================================
export const PRODUCT_STATUS_COLORS = {
  ACTIVE: 'green',
  INACTIVE: 'red',
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
  [ORDER_STATUSES.SHIPPED]: 'geekblue',
  [ORDER_STATUSES.DELIVERED]: 'green',
  [ORDER_STATUSES.CANCELLED]: 'red',
  [ORDER_STATUSES.RETURNED]: 'volcano',
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
export const PAGINATION_SIZES = [20, 50, 100];
export const DEFAULT_PAGE_SIZE = 50;