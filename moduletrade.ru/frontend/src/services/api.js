// ===================================================
// ФАЙЛ: frontend/src/services/api.js
// ===================================================
import axios from 'axios';
import { message } from 'antd';

// Базовая конфигурация API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Создаем экземпляр axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для добавления токена к запросам
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерцептор для обработки ответов
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Если токен истек, пытаемся обновить его
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken
          });

          if (response.data.success) {
            const { access_token } = response.data.data;
            localStorage.setItem('accessToken', access_token);
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }

      // Если обновление токена не удалось, перенаправляем на логин
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Показываем ошибки пользователю
    if (error.response?.data?.error) {
      message.error(error.response.data.error);
    } else if (error.message) {
      message.error(error.message);
    }

    return Promise.reject(error);
  }
);

// =====================================
// API для авторизации
// =====================================
export const authAPI = {
  login: (credentials) =>
    api.post('/auth/login', credentials),

  logout: () =>
    api.post('/auth/logout'),

  refresh: (refreshToken) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),

  me: () =>
    api.get('/auth/me'),

  changePassword: (data) =>
    api.post('/auth/change-password', data),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (data) =>
    api.post('/auth/reset-password', data),
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

  getProductStats: () =>
    api.get('/products/stats'),

  bulkUpdateProducts: (data) =>
    api.post('/products/bulk-update', data),

  bulkDeleteProducts: (ids) =>
    api.post('/products/bulk-delete', { product_ids: ids }),

  importProducts: (file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.keys(options).forEach(key => {
      formData.append(key, options[key]);
    });

    return api.post('/products/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  getImportStatus: (importId) =>
    api.get(`/products/import/${importId}/status`),

  exportProducts: (params = {}) =>
    api.get('/products/export', {
      params,
      responseType: 'blob',
    }),

  searchProducts: (query, filters = {}) =>
    api.get('/products/search', {
      params: { search: query, ...filters },
    }),
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

  getWarehouseStock: (id, params = {}) =>
    api.get(`/warehouses/${id}/stock`, { params }),

  updateStock: (warehouseId, productId, quantity, reason) =>
    api.post(`/warehouses/${warehouseId}/stock`, {
      product_id: productId,
      quantity,
      reason,
    }),

  transferStock: (fromWarehouseId, toWarehouseId, items) =>
    api.post('/warehouses/transfer', {
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      items,
    }),

  getMovements: (warehouseId, params = {}) =>
    api.get(`/warehouses/${warehouseId}/movements`, { params }),
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

  syncSupplier: (id, options = {}) =>
    api.post(`/suppliers/${id}/sync`, options),

  testSupplierConnection: (id) =>
    api.post(`/suppliers/${id}/test`),
};

// =====================================
// API для маркетплейсов
// =====================================
export const marketplacesAPI = {
  getMarketplaces: (params = {}) =>
    api.get('/marketplaces', { params }),

  getMarketplace: (id) =>
    api.get(`/marketplaces/${id}`),

  createMarketplace: (data) =>
    api.post('/marketplaces', data),

  updateMarketplace: (id, data) =>
    api.put(`/marketplaces/${id}`, data),

  deleteMarketplace: (id) =>
    api.delete(`/marketplaces/${id}`),

  connectMarketplace: (type, credentials) =>
    api.post('/marketplaces/connect', {
      type,
      credentials,
    }),

  getMarketplaceOrders: (id, params = {}) =>
    api.get(`/marketplaces/${id}/orders`, { params }),

  getMarketplaceWarehouses: (id) =>
    api.get(`/marketplaces/${id}/warehouses`),

  testMarketplaceConnection: (id) =>
    api.post(`/marketplaces/${id}/test`),

  syncMarketplace: (id, options = {}) =>
    api.post(`/marketplaces/${id}/sync`, options),
};

// =====================================
// API для заказов
// =====================================
export const ordersAPI = {
  getOrders: (params = {}) =>
    api.get('/orders', { params }),

  getOrder: (id) =>
    api.get(`/orders/${id}`),

  updateOrderStatus: (id, status, reason = '') =>
    api.put(`/orders/${id}/status`, {
      status,
      reason,
    }),

  bulkUpdateOrders: (orderIds, updateData) =>
    api.post('/orders/bulk-update', {
      order_ids: orderIds,
      updates: updateData,
    }),

  exportOrders: (params = {}) =>
    api.get('/orders/export', {
      params,
      responseType: 'blob',
    }),

  getOrderLabels: (orderIds) =>
    api.post('/orders/labels', {
      order_ids: orderIds,
    }, {
      responseType: 'blob',
    }),
};

// =====================================
// API для пользователей
// =====================================
export const usersAPI = {
  getUsers: (params = {}) =>
    api.get('/users', { params }),

  getUser: (id) =>
    api.get(`/users/${id}`),

  createUser: (data) =>
    api.post('/users', data),

  updateUser: (id, data) =>
    api.put(`/users/${id}`, data),

  deleteUser: (id) =>
    api.delete(`/users/${id}`),
};

// =====================================
// API для синхронизации
// =====================================
export const syncAPI = {
  syncStock: (data) =>
    api.post('/sync/stock', data),

  syncOrders: (data) =>
    api.post('/sync/orders', data),

  getSyncLogs: (params = {}) =>
    api.get('/sync/logs', { params }),

  getSyncStatus: () =>
    api.get('/sync/status'),

  retrySync: (syncId) =>
    api.post(`/sync/${syncId}/retry`),

  cancelSync: (syncId) =>
    api.post(`/sync/${syncId}/cancel`),
};

// =====================================
// API для аналитики
// =====================================
export const analyticsAPI = {
  getDashboardData: () =>
    api.get('/analytics/dashboard'),

  getSalesAnalytics: (params = {}) =>
    api.get('/analytics/sales', { params }),

  getProfitAnalytics: (params = {}) =>
    api.get('/analytics/profit', { params }),

  getInventoryAnalytics: (params = {}) =>
    api.get('/analytics/inventory', { params }),

  exportAnalytics: (type, params = {}) =>
    api.get(`/analytics/export/${type}`, {
      params,
      responseType: 'blob',
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

  addPaymentMethod: (data) =>
    api.post('/billing/payment-methods', data),
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

  updateIntegrations: (data) =>
    api.put('/settings/integrations', data),

  getNotificationSettings: () =>
    api.get('/settings/notifications'),

  updateNotificationSettings: (data) =>
    api.put('/settings/notifications', data),

  getApiKeys: () =>
    api.get('/settings/api-keys'),

  generateApiKey: (name) =>
    api.post('/settings/api-keys', { name }),

  revokeApiKey: (keyId) =>
    api.delete(`/settings/api-keys/${keyId}`),
};

export default api;