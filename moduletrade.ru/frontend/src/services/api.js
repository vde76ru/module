// frontend/src/services/api.js
import axios from 'utils/axios';
import { notification } from 'antd';

// Базовая конфигурация axios
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://api.moduletrade.ru/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor для добавления токена
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor для обработки ответов
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Обработка ошибки 401 (Unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/api/auth/refresh', {
          refreshToken,
        });

        const { token } = response.data;
        localStorage.setItem('token', token);

        // Повторяем оригинальный запрос с новым токеном
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Если refresh token тоже невалиден
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Показываем уведомление об ошибке
    if (error.response?.status >= 400) {
      const message = error.response.data?.message || 'Произошла ошибка';
      notification.error({
        message: 'Ошибка',
        description: message,
        duration: 4,
      });
    }

    return Promise.reject(error);
  }
);

// =====================================
// API для авторизации
// =====================================
export const authAPI = {
  // Авторизация
  login: (email, password, rememberMe = false) =>
    api.post('/auth/login', {
      email,
      password,
      remember_me: rememberMe
    }),

  // Регистрация - ДОБАВЛЕНО!
  register: (userData) =>
    api.post('/auth/register', {
      name: userData.name,
      email: userData.email,
      password: userData.password,
      company_name: userData.company_name
    }),

  // Обновление токена
  refresh: (refreshToken) =>
    api.post('/auth/refresh', { refreshToken }),

  // Получение текущего пользователя
  getCurrentUser: () =>
    api.get('/auth/me'),

  // Выход из системы
  logout: () =>
    api.post('/auth/logout'),

  // Смена пароля
  changePassword: (oldPassword, newPassword) =>
    api.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword
    }),

  // Восстановление пароля
  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  // Сброс пароля
  resetPassword: (token, password) =>
    api.post('/auth/reset-password', {
      token,
      password
    }),
};

// =====================================
// API для товаров
// =====================================
export const productsAPI = {
  getProducts: (params = {}) =>
    api.get('/products', { params }),

  getProduct: (id) =>
    api.get(`/products/${id}`),

  createProduct: (data) =>
    api.post('/products', data),

  updateProduct: (id, data) =>
    api.put(`/products/${id}`, data),

  deleteProduct: (id) =>
    api.delete(`/products/${id}`),

  bulkUpdateProducts: (productIds, updateData) =>
    api.post('/products/bulk-update', {
      product_ids: productIds,
      updates: updateData
    }),

  bulkDeleteProducts: (productIds) =>
    api.post('/products/bulk-delete', {
      product_ids: productIds
    }),

  importProducts: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/products/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  getImportStatus: (importId) =>
    api.get(`/products/import/${importId}/status`),

  cancelImport: (importId) =>
    api.post(`/products/import/${importId}/cancel`),

  exportProducts: (format = 'yml', filters = {}) =>
    api.get(`/products/export/${format}`, {
      params: filters,
      responseType: 'blob',
    }),

  searchProducts: (query, filters = {}) =>
    api.get('/products/search', {
      params: { search: query, ...filters }
    }),

  getProductHistory: (productId) =>
    api.get(`/products/${productId}/history`),
};

// =====================================
// API для складов
// =====================================
export const warehousesAPI = {
  getWarehouses: (params = {}) =>
    api.get('/warehouses', { params }),

  getWarehouse: (id) =>
    api.get(`/warehouses/${id}`),

  createWarehouse: (data) =>
    api.post('/warehouses', data),

  updateWarehouse: (id, data) =>
    api.put(`/warehouses/${id}`, data),

  deleteWarehouse: (id) =>
    api.delete(`/warehouses/${id}`),

  transferProduct: (data) =>
    api.post('/warehouses/transfer', data),

  getStock: (warehouseId, params = {}) =>
    api.get(`/warehouses/${warehouseId}/stock`, { params }),

  updateStock: (warehouseId, productId, quantity) =>
    api.post(`/warehouses/${warehouseId}/stock`, {
      product_id: productId,
      quantity
    }),

  getMovements: (warehouseId, params = {}) =>
    api.get(`/warehouses/${warehouseId}/movements`, { params }),
};

// =====================================
// API для синхронизации
// =====================================
export const syncAPI = {
  syncStock: (productIds = [], syncAll = false) =>
    api.post('/sync/stock', {
      product_ids: productIds,
      sync_all: syncAll
    }),

  syncOrders: (marketplaceId, dateFrom, dateTo) =>
    api.post('/sync/orders', {
      marketplace_id: marketplaceId,
      date_from: dateFrom,
      date_to: dateTo
    }),

  getSyncLogs: (params = {}) =>
    api.get('/sync/logs', { params }),

  getSyncStatus: () =>
    api.get('/sync/status'),

  cancelSync: (syncId) =>
    api.post(`/sync/${syncId}/cancel`),
};

// =====================================
// API для заказов
// =====================================
export const ordersAPI = {
  getOrders: (params = {}) =>
    api.get('/orders', { params }),

  getOrder: (id) =>
    api.get(`/orders/${id}`),

  updateOrderStatus: (id, status) =>
    api.put(`/orders/${id}/status`, { status }),

  bulkUpdateOrders: (orderIds, updates) =>
    api.post('/orders/bulk-update', {
      order_ids: orderIds,
      updates
    }),

  exportOrders: (format = 'xlsx', filters = {}) =>
    api.get(`/orders/export/${format}`, {
      params: filters,
      responseType: 'blob'
    }),
};

// =====================================
// API для маркетплейсов
// =====================================
export const marketplacesAPI = {
  getMarketplaces: () =>
    api.get('/marketplaces'),

  getMarketplace: (id) =>
    api.get(`/marketplaces/${id}`),

  connectMarketplace: (data) =>
    api.post('/marketplaces/connect', data),

  disconnectMarketplace: (id) =>
    api.delete(`/marketplaces/${id}/disconnect`),

  getMarketplaceOrders: (id, params = {}) =>
    api.get(`/marketplaces/${id}/orders`, { params }),

  testConnection: (id) =>
    api.post(`/marketplaces/${id}/test`),
};

// =====================================
// API для поставщиков
// =====================================
export const suppliersAPI = {
  getSuppliers: (params = {}) =>
    api.get('/suppliers', { params }),

  getSupplier: (id) =>
    api.get(`/suppliers/${id}`),

  createSupplier: (data) =>
    api.post('/suppliers', data),

  updateSupplier: (id, data) =>
    api.put(`/suppliers/${id}`, data),

  deleteSupplier: (id) =>
    api.delete(`/suppliers/${id}`),

  getSupplierProducts: (id, params = {}) =>
    api.get(`/suppliers/${id}/products`, { params }),

  syncSupplierProducts: (id) =>
    api.post(`/suppliers/${id}/sync`),
};

// =====================================
// API для аналитики
// =====================================
export const analyticsAPI = {
  getDashboard: (params = {}) =>
    api.get('/analytics/dashboard', { params }),

  getSalesAnalytics: (params = {}) =>
    api.get('/analytics/sales', { params }),

  getProfitAnalytics: (params = {}) =>
    api.get('/analytics/profit', { params }),

  getInventoryAnalytics: (params = {}) =>
    api.get('/analytics/inventory', { params }),

  exportReport: (reportType, params = {}) =>
    api.get(`/analytics/export/${reportType}`, {
      params,
      responseType: 'blob'
    }),
};

// =====================================
// API для биллинга
// =====================================
export const billingAPI = {
  getTariffs: () =>
    api.get('/billing/tariffs'),

  getCurrentUsage: () =>
    api.get('/billing/usage'),

  getTransactions: (params = {}) =>
    api.get('/billing/transactions', { params }),

  changeTariff: (tariffId) =>
    api.post('/billing/change-tariff', { tariff_id: tariffId }),

  getPaymentMethods: () =>
    api.get('/billing/payment-methods'),

  addPaymentMethod: (paymentMethodData) =>
    api.post('/billing/payment-methods', paymentMethodData),

  deletePaymentMethod: (id) =>
    api.delete(`/billing/payment-methods/${id}`),
};

// =====================================
// API для настроек
// =====================================
export const settingsAPI = {
  getProfile: () =>
    api.get('/settings/profile'),

  updateProfile: (data) =>
    api.put('/settings/profile', data),

  getIntegrations: () =>
    api.get('/settings/integrations'),

  updateIntegration: (type, settings) =>
    api.put(`/settings/integrations/${type}`, settings),

  getNotificationSettings: () =>
    api.get('/settings/notifications'),

  updateNotificationSettings: (settings) =>
    api.put('/settings/notifications', settings),

  generateApiKey: (name, permissions) =>
    api.post('/settings/api-keys', {
      name,
      permissions
    }),

  getApiKeys: () =>
    api.get('/settings/api-keys'),

  deleteApiKey: (id) =>
    api.delete(`/settings/api-keys/${id}`),
};

// Экспорт основного API объекта
export default api;