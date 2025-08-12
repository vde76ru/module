// ===================================================
// ФАЙЛ: frontend/src/services/auth.js
// ОБНОВЛЕННЫЙ AUTHSERVICE С ЕДИНЫМ AXIOS
// ===================================================
import axios from 'utils/axios';
import { API_ENDPOINTS, STORAGE_KEYS } from 'utils/constants';

class AuthService {
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

      const { token, refreshToken, data } = response.data;

      // Сохраняем токены через единый axios instance
      axios.setToken(token, refreshToken);

      // Сохраняем данные пользователя
      const user = data?.user || response.data.user;
      this.setUser(user);

      return { token, refreshToken, user };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Регистрация нового пользователя
   */
  async register(userData) {
    try {
      const response = await axios.post(API_ENDPOINTS.REGISTER, userData);
      const { token, refreshToken, data } = response.data;

      // Сохраняем токены и пользователя через единый axios
      axios.setToken(token, refreshToken);
      const user = data?.user || response.data.user;
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
      const refreshToken = this.getRefreshToken();

      if (refreshToken) {
        await axios.post(API_ENDPOINTS.LOGOUT, { refreshToken });
      }
    } catch (error) {
      // Игнорируем ошибки при выходе
      console.warn('Logout error:', error);
    } finally {
      // Очищаем локальное хранилище в любом случае
      this.clearAuth();
    }
  }

  /**
   * Обновление токена
   */
  async refreshToken() {
    try {
      const refreshToken = this.getRefreshToken();

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post(API_ENDPOINTS.REFRESH, { refreshToken });
      const { token: newToken, refreshToken: newRefreshToken } = response.data;

      // Сохраняем новые токены через единый axios
      axios.setToken(newToken, newRefreshToken);

      return { token: newToken, refreshToken: newRefreshToken };
    } catch (error) {
      this.clearAuth();
      throw this.handleError(error);
    }
  }

  /**
   * Получение информации о текущем пользователе
   */
  async getCurrentUser() {
    try {
      const response = await axios.get(API_ENDPOINTS.ME);
      const payload = response.data;
      const user = payload?.data?.user || payload?.user || payload;
      this.setUser(user);
      return user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Обновление данных пользователя
   */
  async updateUser(userData) {
    try {
      const response = await axios.put(API_ENDPOINTS.ME, userData);
      const payload = response.data;
      const user = payload?.data?.user || payload?.user || payload;
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
        currentPassword: oldPassword,
        newPassword: newPassword,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Забыли пароль
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
        newPassword: newPassword,
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
      // Используем проверку из единого axios instance
      if (!axios.isAuthenticated()) {
        return null;
      }

      const user = await this.getCurrentUser();
      return user;
    } catch (error) {
      console.warn('Auth check failed:', error);
      this.clearAuth();
      return null;
    }
  }

  /**
   * Получение токена
   */
  getToken() {
    return axios.getToken();
  }

  /**
   * Получение refresh токена
   */
  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  }

  /**
   * Сохранение токенов
   */
  setTokens(token, refreshToken) {
    axios.setToken(token, refreshToken);
  }

  /**
   * Получение данных пользователя
   */
  getUser() {
    const userData = localStorage.getItem('user');
    try {
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.warn('Failed to parse user data:', error);
      return null;
    }
  }

  /**
   * Сохранение данных пользователя
   */
  setUser(user) {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  /**
   * Очистка авторизации
   */
  clearAuth() {
    axios.clearTokens();
    localStorage.removeItem('user');
  }

  /**
   * Проверка авторизации
   */
  isAuthenticated() {
    return axios.isAuthenticated();
  }

  /**
   * Получение информации о пользователе из токена
   */
  getCurrentUserFromToken() {
    return axios.getCurrentUser();
  }

  /**
   * Проверка роли пользователя
   */
  hasRole(role) {
    const user = this.getUser();
    return user?.role === role;
  }

  /**
   * Проверка прав доступа
   */
  hasPermission(permission) {
    const user = this.getUser();
    if (!user) return false;

    // Администраторы имеют все права
    if (user.role === 'admin') return true;

    return user.permissions?.includes(permission) || false;
  }

  /**
   * Проверка множественных прав
   */
  hasPermissions(permissions) {
    return permissions.every(permission => this.hasPermission(permission));
  }

  /**
   * Проверка активности пользователя
   */
  isActive() {
    const user = this.getUser();
    return user?.is_active !== false;
  }

  /**
   * Проверка администратора
   */
  isAdmin() {
    return this.hasRole('admin');
  }

  /**
   * Получение company_id пользователя
   */
  getTenantId() {
    const user = this.getUser();
    return user?.company_id || null;
  }

  /**
   * Обработка ошибок API
   */
  handleError(error) {
    const errorMessage = error.response?.data?.message ||
                        error.response?.data?.error ||
                        error.message ||
                        'Произошла неизвестная ошибка';

    // В development режиме выводим подробную информацию об ошибке
    if (process.env.NODE_ENV === 'development') {
      console.error('Auth Service Error:', {
        message: errorMessage,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    return new Error(errorMessage);
  }
}

// Создаем единый экземпляр
const authService = new AuthService();

export default authService;