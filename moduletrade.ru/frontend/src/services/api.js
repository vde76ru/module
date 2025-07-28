// frontend/src/services/api.js
import axios from 'utils/axios';
import { notification } from 'antd';

// Базовая конфигурация axios
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
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

// API для авторизации
export const authAPI = {
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
  
  refresh: (refreshToken) => 
    api.post('/auth/refresh', { refreshToken }),
  
  getCurrentUser: () => 
    api.get('/auth/me'),
  
  logout: () => 
    api.post('/auth/logout'),
};

// API для товаров
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
  
  importProducts: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/products/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  exportProducts: (format = 'yml') => 
    api.get(`/products/export/${format}`, {
      responseType: 'blob',
    }),
};

// API для складов
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
};

// API для синхронизации
export const syncAPI = {
  syncStock: (data) => 
    api.post('/sync/stock', data),
  
  syncOrders: (data) => 
    api.post('/sync/orders', data),
  
  getSyncLogs: (params = {}) => 
    api.get('/sync/logs', { params }),
  
  getSyncStatus: () => 
    api.get('/sync/status'),
};

// API для маркетплейсов
export const marketplacesAPI = {
  getMarketplaces: () => 
    api.get('/marketplaces'),
  
  getMarketplace: (id) => 
    api.get(`/marketplaces/${id}`),
  
  updateMarketplaceConfig: (id, config) => 
    api.put(`/marketplaces/${id}/config`, config),
  
  testMarketplaceConnection: (id) => 
    api.post(`/marketplaces/${id}/test`),
};

// API для поставщиков
export const suppliersAPI = {
  getSuppliers: () => 
    api.get('/suppliers'),
  
  getSupplier: (id) => 
    api.get(`/suppliers/${id}`),
  
  updateSupplierConfig: (id, config) => 
    api.put(`/suppliers/${id}/config`, config),
  
  testSupplierConnection: (id) => 
    api.post(`/suppliers/${id}/test`),
  
  importFromSupplier: (id, params) => 
    api.post(`/suppliers/${id}/import`, params),
};

// API для биллинга
export const billingAPI = {
  getCurrentTariff: () => 
    api.get('/billing/tariff'),
  
  getTariffs: () => 
    api.get('/billing/tariffs'),
  
  getTransactions: (params = {}) => 
    api.get('/billing/transactions', { params }),
  
  changeTariff: (tariffId) => 
    api.post('/billing/change-tariff', { tariffId }),
};

// API для аналитики
export const analyticsAPI = {
  getDashboardStats: () => 
    api.get('/analytics/dashboard'),
  
  getSalesReport: (params = {}) => 
    api.get('/analytics/sales', { params }),
  
  getInventoryReport: (params = {}) => 
    api.get('/analytics/inventory', { params }),
  
  getProfitReport: (params = {}) => 
    api.get('/analytics/profit', { params }),
};

export default api;