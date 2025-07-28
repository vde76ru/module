// frontend/src/services/auth.js
import axios from '../utils/axios';
import { API_ENDPOINTS, STORAGE_KEYS } from '../utils/constants';

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

      const { token, refreshToken, user } = response.data;

      // Сохраняем токены
      this.setTokens(token, refreshToken);
      
      // Сохраняем данные пользователя
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
      const response = await axios.post('/auth/register', userData);
      const { token, refreshToken, user } = response.data;

      // Сохраняем токены и пользователя
      this.setTokens(token, refreshToken);
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

      const response = await axios.post(API_ENDPOINTS.REFRESH, {
        refreshToken,
      });

      const { token: newToken, refreshToken: newRefreshToken } = response.data;

      // Обновляем токены
      this.setTokens(newToken, newRefreshToken || refreshToken);

      return newToken;
    } catch (error) {
      // При ошибке обновления токена очищаем авторизацию
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
      const user = response.data.data || response.data;
      
      // Обновляем данные пользователя в localStorage
      this.setUser(user);
      
      return user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Обновление профиля пользователя
   */
  async updateProfile(profileData) {
    try {
      const response = await axios.put(API_ENDPOINTS.SETTINGS_PROFILE, profileData);
      const user = response.data.data || response.data;
      
      // Обновляем данные пользователя
      this.setUser(user);
      
      return user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Смена пароля
   */
  async changePassword(currentPassword, newPassword) {
    try {
      await axios.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      
      return true;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Восстановление пароля
   */
  async forgotPassword(email) {
    try {
      await axios.post('/auth/forgot-password', { email });
      return true;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Сброс пароля
   */
  async resetPassword(token, password, confirmPassword) {
    try {
      await axios.post('/auth/reset-password', {
        token,
        password,
        password_confirmation: confirmPassword,
      });
      
      return true;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Проверка валидности токена
   */
  async validateToken() {
    try {
      const token = this.getToken();
      
      if (!token) {
        return false;
      }

      // Проверяем срок действия токена
      const tokenPayload = this.parseToken(token);
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (tokenPayload.exp < currentTime) {
        // Токен истек, пытаемся обновить
        try {
          await this.refreshToken();
          return true;
        } catch (refreshError) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Утилиты для работы с токенами и localStorage

  /**
   * Получение токена из localStorage
   */
  getToken() {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  /**
   * Получение refresh токена из localStorage
   */
  getRefreshToken() {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Сохранение токенов в localStorage
   */
  setTokens(token, refreshToken) {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    }
    if (refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
  }

  /**
   * Получение данных пользователя из localStorage
   */
  getUser() {
    try {
      const userData = localStorage.getItem(STORAGE_KEYS.USER);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }

  /**
   * Сохранение данных пользователя в localStorage
   */
  setUser(user) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
  }

  /**
   * Очистка всех данных авторизации
   */
  clearAuth() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  /**
   * Проверка, авторизован ли пользователь
   */
  isAuthenticated() {
    const token = this.getToken();
    
    if (!token) {
      return false;
    }

    try {
      const tokenPayload = this.parseToken(token);
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Проверяем, не истек ли токен
      return tokenPayload.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  /**
   * Парсинг JWT токена
   */
  parseToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }

  /**
   * Получение роли пользователя
   */
  getUserRole() {
    const user = this.getUser();
    return user?.role || null;
  }

  /**
   * Проверка прав пользователя
   */
  hasPermission(permission) {
    const user = this.getUser();
    
    if (!user || !user.permissions) {
      return false;
    }

    return user.permissions.includes(permission);
  }

  /**
   * Проверка роли пользователя
   */
  hasRole(role) {
    const userRole = this.getUserRole();
    
    if (Array.isArray(role)) {
      return role.includes(userRole);
    }
    
    return userRole === role;
  }

  /**
   * Получение информации о тенанте
   */
  getTenantInfo() {
    const user = this.getUser();
    return user?.tenant || null;
  }

  /**
   * Обработка ошибок
   */
  handleError(error) {
    if (error.response) {
      // Ошибка от сервера
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          this.clearAuth();
          return new Error('Неверные учетные данные');
        case 403:
          return new Error('Доступ запрещен');
        case 422:
          const errors = data.errors || {};
          const errorMessages = Object.values(errors).flat();
          return new Error(errorMessages.join(', ') || 'Ошибка валидации');
        case 429:
          return new Error('Слишком много попыток. Попробуйте позже');
        default:
          return new Error(data.message || 'Ошибка сервера');
      }
    } else if (error.request) {
      // Сетевая ошибка
      return new Error('Ошибка сети. Проверьте подключение к интернету');
    } else {
      // Другая ошибка
      return new Error(error.message || 'Неизвестная ошибка');
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
const authService = new AuthService();
export default authService;