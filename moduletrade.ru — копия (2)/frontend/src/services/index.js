// ===================================================
// ФАЙЛ: frontend/src/services/index.js
// ✅ ИСПРАВЛЕНО: API сервисы приведены в соответствие с бэкендом
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
    const errorMessage = error.response?.data?.error ||
                        error.response?.data?.message ||
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

  /**
   * Обработка ответа от API (стандартная структура бэкенда)
   */
  handleResponse(response) {
    if (response.data && response.data.success !== undefined) {
      return response.data;
    }
    return response.data;
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

      const result = this.handleResponse(response);

      if (result.success) {
        const { token, refreshToken, data } = result;

        // Сохраняем токены через axios instance
        axios.setToken(token, refreshToken);

        // Сохраняем данные пользователя
        this.setUser(data.user);

        return { token, refreshToken, user: data.user };
      }

      throw new Error(result.error || 'Login failed');
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
      const result = this.handleResponse(response);

      if (result.success) {
        const { token, refreshToken, data } = result;

        axios.setToken(token, refreshToken);
        this.setUser(data.user);

        return { token, refreshToken, user: data.user };
      }

      throw new Error(result.error || 'Registration failed');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Выход из системы
   */
  async logout() {
    try {
      await axios.post(API_ENDPOINTS.LOGOUT);
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
      const result = this.handleResponse(response);

      if (result.success) {
        const user = result.data.user;
        this.setUser(user);
        return user;
      }

      throw new Error(result.error || 'Failed to get user');
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
        currentPassword: oldPassword,
        newPassword: newPassword,
      });
      return this.handleResponse(response);
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
      return this.handleResponse(response);
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
        newPassword: newPassword,
      });
      return this.handleResponse(response);
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
      const result = this.handleResponse(response);

      if (result.success) {
        const user = result.data.user;
        this.setUser(user);
        return user;
      }

      throw new Error(result.error || 'Failed to update user');
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
      const result = this.handleResponse(response);

      if (result.success) {
        return {
          products: result.data || [],
          pagination: result.pagination || {},
          total: result.pagination?.total || 0
        };
      }

      throw new Error(result.error || 'Failed to fetch products');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение товара по ID
   */
  async getProduct(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.PRODUCT_DETAILS, { id });
      const response = await axios.get(url);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch product');
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
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to create product');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Обновление товара
   */
  async updateProduct(id, productData) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.PRODUCT_DETAILS, { id });
      const response = await axios.put(url, productData);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to update product');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Удаление товара
   */
  async deleteProduct(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.PRODUCT_DETAILS, { id });
      const response = await axios.delete(url);
      const result = this.handleResponse(response);

      if (result.success) {
        return result;
      }

      throw new Error(result.error || 'Failed to delete product');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Получение категорий
   */
  async getCategories() {
    try {
      const response = await axios.get(API_ENDPOINTS.PRODUCTS_CATEGORIES);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch categories');
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
      return this.handleResponse(response);
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
      return this.handleResponse(response);
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
      return this.handleResponse(response);
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
      const result = this.handleResponse(response);

      if (result.success) {
        return {
          orders: result.data || [],
          pagination: result.pagination || {},
          total: result.pagination?.total || 0
        };
      }

      throw new Error(result.error || 'Failed to fetch orders');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getOrder(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.ORDER_DETAILS, { id });
      const response = await axios.get(url);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch order');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateOrderStatus(id, status, comment = null) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.ORDER_STATUS, { id });
      const response = await axios.put(url, { status, comment });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to update order status');
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
      return this.handleResponse(response);
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
  async getWarehouses(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.WAREHOUSES, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch warehouses');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getWarehouseStock(id, params = {}) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.WAREHOUSE_STOCK, { id });
      const response = await axios.get(url, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return {
          stock: result.data || [],
          pagination: result.pagination || {},
          total: result.pagination?.total || 0
        };
      }

      throw new Error(result.error || 'Failed to fetch warehouse stock');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getWarehouseMovements(id, params = {}) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.WAREHOUSE_MOVEMENTS, { id });
      const response = await axios.get(url, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch warehouse movements');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateStock(stockData) {
    try {
      const response = await axios.post(API_ENDPOINTS.WAREHOUSE_UPDATE_STOCK, stockData);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to update stock');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async transferStock(transferData) {
    try {
      const response = await axios.post(API_ENDPOINTS.WAREHOUSE_TRANSFER, transferData);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to transfer stock');
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// SUPPLIERS API
// =====================================
class SuppliersAPI extends BaseAPIService {
  async getSuppliers(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.SUPPLIERS, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch suppliers');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSupplierProducts(id, params = {}) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.SUPPLIER_PRODUCTS, { id });
      const response = await axios.get(url, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch supplier products');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async syncSupplier(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.SUPPLIER_SYNC, { id });
      const response = await axios.post(url);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to sync supplier');
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// =====================================
// MARKETPLACES API
// =====================================
class MarketplacesAPI extends BaseAPIService {
  async getMarketplaces(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.MARKETPLACES, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch marketplaces');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getMarketplaceOrders(id, params = {}) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.MARKETPLACE_ORDERS, { id });
      const response = await axios.get(url, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch marketplace orders');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async connectMarketplace(marketplaceData) {
    try {
      const response = await axios.post(API_ENDPOINTS.MARKETPLACE_CONNECT, marketplaceData);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to connect marketplace');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async testMarketplace(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.MARKETPLACE_TEST, { id });
      const response = await axios.post(url);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to test marketplace');
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
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to sync stock');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async syncOrders(data) {
    try {
      const response = await axios.post(API_ENDPOINTS.SYNC_ORDERS, data);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to sync orders');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSyncLogs(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.SYNC_LOGS, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch sync logs');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSyncStatus() {
    try {
      const response = await axios.get(API_ENDPOINTS.SYNC_STATUS);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch sync status');
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
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch dashboard data');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSalesReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_SALES, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch sales report');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProfitReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_PROFIT, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch profit report');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProductsReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_PRODUCTS, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch products report');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPopularityReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_POPULARITY, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch popularity report');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getWarehouseReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_WAREHOUSE, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch warehouse report');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getMarketplaceReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_MARKETPLACE, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch marketplace report');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getBrandReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_BRAND, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch brand report');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCategoryReport(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.ANALYTICS_CATEGORY, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch category report');
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
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch tariffs');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUsage() {
    try {
      const response = await axios.get(API_ENDPOINTS.BILLING_USAGE);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch usage');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSubscriptionInfo() {
    try {
      const response = await axios.get(API_ENDPOINTS.BILLING_SUBSCRIPTION_INFO);
      const result = this.handleResponse(response);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to fetch subscription info');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getTransactions(params = {}) {
    try {
      const response = await axios.get(API_ENDPOINTS.BILLING_TRANSACTIONS, { params });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch transactions');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async changeTariff(tariffId) {
    try {
      const response = await axios.post(API_ENDPOINTS.BILLING_CHANGE_TARIFF, { tariff_id: tariffId });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to change tariff');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createPaymentIntent(tariffId) {
    try {
      const response = await axios.post(API_ENDPOINTS.BILLING_CREATE_PAYMENT_INTENT, { tariff_id: tariffId });
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to create payment intent');
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
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch users');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUser(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.USER_DETAILS, { id });
      const response = await axios.get(url);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch user');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createUser(userData) {
    try {
      const response = await axios.post(API_ENDPOINTS.USERS, userData);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to create user');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUser(id, userData) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.USER_DETAILS, { id });
      const response = await axios.put(url, userData);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to update user');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteUser(id) {
    try {
      const url = this.replaceUrlParams(API_ENDPOINTS.USER_DETAILS, { id });
      const response = await axios.delete(url);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to delete user');
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
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch profile');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await axios.put(API_ENDPOINTS.SETTINGS_PROFILE, profileData);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to update profile');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getIntegrations() {
    try {
      const response = await axios.get(API_ENDPOINTS.SETTINGS_INTEGRATIONS);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch integrations');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateIntegrations(integrationsData) {
    try {
      const response = await axios.put(API_ENDPOINTS.SETTINGS_INTEGRATIONS, integrationsData);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to update integrations');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getNotifications() {
    try {
      const response = await axios.get(API_ENDPOINTS.SETTINGS_NOTIFICATIONS);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch notifications');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateNotifications(notificationsData) {
    try {
      const response = await axios.put(API_ENDPOINTS.SETTINGS_NOTIFICATIONS, notificationsData);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to update notifications');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getApiKeys() {
    try {
      const response = await axios.get(API_ENDPOINTS.SETTINGS_API_KEYS);
      const result = this.handleResponse(response);

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error || 'Failed to fetch API keys');
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