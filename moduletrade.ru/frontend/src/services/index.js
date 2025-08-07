// ===================================================
// ФАЙЛ: frontend/src/services/index.js
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ ВСЕХ API
// ===================================================
import axios from 'utils/axios';
import { API_ENDPOINTS } from 'utils/constants';

// =====================================
// БАЗОВЫЙ КЛАСС ДЛЯ API СЕРВИСОВ
// =====================================
class BaseAPIService {
  /**
   * Обработка ошибок API
   */
  handleError(error) {
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        'Произошла неизвестная ошибка';
    
    const errorDetails = {
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
    };
    
    // В development режиме выводим подробную информацию об ошибке
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', errorDetails);
    }
    
    throw new Error(errorMessage);
  }

  /**
   * Замена параметров в URL
   */
  replaceUrlParams(url, params) {
    return url.replace(/:(\w+)/g, (match, key) => {
      return params[key] || match;
    });
  }
}

// =====================================
// AUTHENTICATION API
// =====================================
class AuthAPI extends BaseAPIService {
  /**
   * Вход в систему
   */
  async login(email, password, rememberMe = false) {
    try {
      const response = await axios.post(API_ENDPOINTS.LOGIN, {
        email,
        password,
        remember_me: rememberMe,
      });

      const { token, refreshToken, user } = response.data;

      // Сохраняем токены через axios instance
      axios.setToken(token, refreshToken);
      
      // Сохраняем данные пользователя
      this.setUser(user);

      return { token, refreshToken, user };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Регистрация
   */
  async register(userData) {
    try {
      const response = await axios.post(API_ENDPOINTS.REGISTER, userData);
      const { token, refreshToken, user } = response.data;

      axios.setToken(token, refreshToken);
      this.setUser(user);

      return { token, refreshToken, user };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Выход из системы
   */
  async logout() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken) {
        await axios.post(API_ENDPOINTS.LOGOUT, { refreshToken });
      }
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  /**
   * Обновление токена
   */
  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post(API_ENDPOINTS.REFRESH, { refreshToken });
      const { token: newToken, refreshToken: newRefreshToken } = response.data;

      axios.setToken(newToken, newRefreshToken);

      return { token: newToken, refreshToken: newRefreshToken };
    } catch (error) {
      this.clearAuth();
      throw this.handleError(error);
    }
  }

  /**
   * Получение текущего пользователя
   */
  async getCurrentUser() {
    try {
      const response = await axios.get(API_ENDPOINTS.ME);
      const user = response.data.user || response.data;
      this.setUser(user);
      return user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Смена пароля
   */
  async changePassword(oldPassword, newPassword) {
    try {
      const response = await axios.post(API_ENDPOINTS.CHANGE_PASSWORD, {
        old_password: oldPassword,
        new_password: newPassword,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Восстановление пароля
   */
  async forgotPassword(email) {
    try {
      const response = await axios.post(API_ENDPOINTS.FORGOT_PASSWORD, { email });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Сброс пароля
   */
  async resetPassword(token, newPassword) {
    try {
      const response = await axios.post(API_ENDPOINTS.RESET_PASSWORD, {
        token,
        new_password: newPassword,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Проверка авторизации при загрузке приложения
   */
  async checkAuth() {
    try {
      if (!axios.isAuthenticated()) {
        return null;
      }

      const user = await this.getCurrentUser();
      return user;
    } catch (error) {
      this.clearAuth();
      return null;
    }
  }

  /**
   * Обновление данных пользователя
   */
  async updateUser(userData) {
    try {
      const response = await axios.put(API_ENDPOINTS.ME, userData);
      const user = response.data.user || response.data;
      this.setUser(user);
      return user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Вспомогательные методы для работы с localStorage
  setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  getUser() {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  }

  clearAuth() {
    axios.clearTokens();
    localStorage.removeItem('user');
  }

  isAuthenticated() {
    return axios.isAuthenticated();
  }
}

// =====================================
// PRODUCTS API
// =====================================
class ProductsAPI extends BaseAPIService {
  /**
   * Получение списка товаров
   */
  async getProducts(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.PRODUCTS, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение товара по ID
   */
  async getProduct(id) {
    try {
      const response = await axios.get(`${API_ENDPOINTS.PRODUCTS}/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Создание товара
   */
  async createProduct(productData) {
    try {
      const response = await axios.post(API_ENDPOINTS.PRODUCTS, productData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Обновление товара
   */
  async updateProduct(id, productData) {
    try {
      const response = await axios.put(`${API_ENDPOINTS.PRODUCTS}/${id}`, productData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Удаление товара
   */
  async deleteProduct(id) {
    try {
      const response = await axios.delete(`${API_ENDPOINTS.PRODUCTS}/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Поиск товаров
   */
  async searchProducts(query, params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.PRODUCTS_SEARCH, {
        params: { q: query, ...params }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Импорт товаров
   */
  async importProducts(file, options = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      Object.keys(options).forEach(key => {
        formData.append(key, options[key]);
      });

      const response = await axios.post(API_ENDPOINTS.PRODUCTS_IMPORT, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Экспорт товаров
   */
  async exportProducts(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.PRODUCTS_EXPORT, {
        params,
        responseType: 'blob'
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Массовое обновление товаров
   */
  async bulkUpdateProducts(productIds, updates) {
    try {
      const response = await axios.post(API_ENDPOINTS.PRODUCTS_BULK_UPDATE, {
        product_ids: productIds,
        updates
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Массовое удаление товаров
   */
  async bulkDeleteProducts(productIds) {
    try {
      const response = await axios.post(API_ENDPOINTS.PRODUCTS_BULK_DELETE, {
        product_ids: productIds
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// ORDERS API
// =====================================
class OrdersAPI extends BaseAPIService {
  async getOrders(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ORDERS, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getOrder(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.ORDER_DETAILS, { id });
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateOrderStatus(id, status, comment = null) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.ORDER_STATUS, { id });
      const response = await axios.put(url, { status, comment });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async bulkUpdateOrders(orderIds, updates) {
    try {
      const response = await axios.post(API_ENDPOINTS.ORDERS_BULK_UPDATE, {
        order_ids: orderIds,
        updates
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async exportOrders(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ORDERS_EXPORT, {
        params,
        responseType: 'blob'
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// WAREHOUSES API
// =====================================
class WarehousesAPI extends BaseAPIService {
  async getWarehouses() {
    try {
      const response = await axios.get(API_ENDPOINTS.WAREHOUSES);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getWarehouseStock(id, params = {}) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.WAREHOUSE_STOCK, { id });
      const response = await axios.get(url, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getWarehouseMovements(id, params = {}) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.WAREHOUSE_MOVEMENTS, { id });
      const response = await axios.get(url, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async transferStock(transferData) {
    try {
      const response = await axios.post(API_ENDPOINTS.WAREHOUSE_TRANSFER, transferData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// SUPPLIERS API
// =====================================
class SuppliersAPI extends BaseAPIService {
  async getSuppliers() {
    try {
      const response = await axios.get(API_ENDPOINTS.SUPPLIERS);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSupplierProducts(id, params = {}) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.SUPPLIER_PRODUCTS, { id });
      const response = await axios.get(url, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async syncSupplier(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.SUPPLIER_SYNC, { id });
      const response = await axios.post(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// MARKETPLACES API
// =====================================
class MarketplacesAPI extends BaseAPIService {
  async getMarketplaces() {
    try {
      const response = await axios.get(API_ENDPOINTS.MARKETPLACES);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getMarketplaceOrders(id, params = {}) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.MARKETPLACE_ORDERS, { id });
      const response = await axios.get(url, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async connectMarketplace(marketplaceData) {
    try {
      const response = await axios.post(API_ENDPOINTS.MARKETPLACE_CONNECT, marketplaceData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async testMarketplace(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.MARKETPLACE_TEST, { id });
      const response = await axios.post(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// SYNC API
// =====================================
class SyncAPI extends BaseAPIService {
  async syncStock(data) {
    try {
      const response = await axios.post(API_ENDPOINTS.SYNC_STOCK, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async syncOrders(data) {
    try {
      const response = await axios.post(API_ENDPOINTS.SYNC_ORDERS, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSyncLogs(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.SYNC_LOGS, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSyncStatus() {
    try {
      const response = await axios.get(API_ENDPOINTS.SYNC_STATUS);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// ANALYTICS API
// =====================================
class AnalyticsAPI extends BaseAPIService {
  async getDashboard() {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_DASHBOARD);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSalesReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_SALES, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProfitReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_PROFIT, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getInventoryReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_INVENTORY, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async exportReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_EXPORT, {
        params,
        responseType: 'blob'
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// BILLING API
// =====================================
class BillingAPI extends BaseAPIService {
  async getTariffs() {
    try {
      const response = await axios.get(API_ENDPOINTS.BILLING_TARIFFS);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUsage() {
    try {
      const response = await axios.get(API_ENDPOINTS.BILLING_USAGE);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getTransactions(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.BILLING_TRANSACTIONS, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async changeTariff(tariffId) {
    try {
      const response = await axios.post(API_ENDPOINTS.BILLING_CHANGE_TARIFF, { tariffId });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPaymentMethods() {
    try {
      const response = await axios.get(API_ENDPOINTS.BILLING_PAYMENT_METHODS);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// USERS API
// =====================================
class UsersAPI extends BaseAPIService {
  async getUsers(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.USERS, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUser(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.USER_DETAILS, { id });
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createUser(userData) {
    try {
      const response = await axios.post(API_ENDPOINTS.USERS, userData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUser(id, userData) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.USER_DETAILS, { id });
      const response = await axios.put(url, userData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteUser(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.USER_DETAILS, { id });
      const response = await axios.delete(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// SETTINGS API
// =====================================
class SettingsAPI extends BaseAPIService {
  async getProfile() {
    try {
      const response = await axios.get(API_ENDPOINTS.SETTINGS_PROFILE);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await axios.put(API_ENDPOINTS.SETTINGS_PROFILE, profileData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getIntegrations() {
    try {
      const response = await axios.get(API_ENDPOINTS.SETTINGS_INTEGRATIONS);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateIntegrations(integrationsData) {
    try {
      const response = await axios.put(API_ENDPOINTS.SETTINGS_INTEGRATIONS, integrationsData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getNotifications() {
    try {
      const response = await axios.get(API_ENDPOINTS.SETTINGS_NOTIFICATIONS);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateNotifications(notificationsData) {
    try {
      const response = await axios.put(API_ENDPOINTS.SETTINGS_NOTIFICATIONS, notificationsData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getApiKeys() {
    try {
      const response = await axios.get(API_ENDPOINTS.SETTINGS_API_KEYS);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// СОЗДАНИЕ ЭКЗЕМПЛЯРОВ API
// =====================================
const authAPI = new AuthAPI();
const productsAPI = new ProductsAPI();
const ordersAPI = new OrdersAPI();
const warehousesAPI = new WarehousesAPI();
const suppliersAPI = new SuppliersAPI();
const marketplacesAPI = new MarketplacesAPI();
const syncAPI = new SyncAPI();
const analyticsAPI = new AnalyticsAPI();
const billingAPI = new BillingAPI();
const usersAPI = new UsersAPI();
const settingsAPI = new SettingsAPI();

// =====================================
// ЕДИНЫЙ API ОБЪЕКТ
// =====================================
export const api = {
  auth: authAPI,
  products: productsAPI,
  orders: ordersAPI,
  warehouses: warehousesAPI,
  suppliers: suppliersAPI,
  marketplaces: marketplacesAPI,
  sync: syncAPI,
  analytics: analyticsAPI,
  billing: billingAPI,
  users: usersAPI,
  settings: settingsAPI,
};

// =====================================
// ЭКСПОРТ ОТДЕЛЬНЫХ API ДЛЯ СОВМЕСТИМОСТИ
// =====================================
export {
  authAPI,
  productsAPI,
  ordersAPI,
  warehousesAPI,
  suppliersAPI,
  marketplacesAPI,
  syncAPI,
  analyticsAPI,
  billingAPI,
  usersAPI,
  settingsAPI,
};

// =====================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// =====================================
export default api;