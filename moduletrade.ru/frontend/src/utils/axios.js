// ===================================================
// ФАЙЛ: frontend/src/utils/axios.js
// УНИФИЦИРОВАННЫЙ HTTP КЛИЕНТ - ИСПРАВЛЕННАЯ ВЕРСИЯ
// ===================================================
import axios from 'axios';
import { notification } from 'antd';
import { API_ENDPOINTS } from 'utils/constants';

// =====================================
// КОНФИГУРАЦИЯ
// =====================================
// Исправлено: правильный URL для API (нормализация, убираем дубли /api)
// По умолчанию используем origin фронтенда, чтобы избежать проблем с CORS/SSL и поддоменами
const DEFAULT_BASE = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? window.location.origin
  : 'http://localhost:8080';
const RAW_API_BASE = (process.env.REACT_APP_API_URL || DEFAULT_BASE).replace(/\/+$/, '');
const API_BASE_URL = RAW_API_BASE.replace(/\/api$/, '');
const REQUEST_TIMEOUT = 30000;

// Избегаем одновременных параллельных запросов к /auth/refresh
let refreshRequest = null;

// =====================================
// СОЗДАНИЕ INSTANCE
// =====================================
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =====================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================

/**
 * Получение токена из localStorage
 * Исправлено: используем правильные ключи для токенов
 */
const getToken = () => {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
};

/**
 * Получение refresh токена
 */
const getRefreshToken = () => {
  return localStorage.getItem('refreshToken');
};

/**
 * Сохранение токенов
 * Исправлено: сохраняем токены под правильными ключами
 */
const setTokens = (token, refreshToken = null) => {
  localStorage.setItem('accessToken', token);
  localStorage.setItem('token', token); // Для обратной совместимости
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
};

/**
 * Очистка токенов
 */
const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

/**
 * Декодирование JWT токена
 */
const decodeToken = (token) => {
  try {
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    console.warn('Token decode error:', error);
    return null;
  }
};

/**
 * Проверка истечения токена
 */
const isTokenExpired = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
};

/**
 * Получение company_id из токена
 */
const getTenantIdFromToken = (token) => {
  const decoded = decodeToken(token);
  return decoded?.companyId || decoded?.company_id || null;
};

// =====================================
// REQUEST INTERCEPTOR
// =====================================
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken();

    // Добавляем токен авторизации
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;

      // Добавляем company_id если есть в токене
      const companyId = getTenantIdFromToken(token);
      if (companyId) {
        config.headers['X-Tenant-ID'] = companyId;
      }
    }

    // Логирование в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// =====================================
// RESPONSE INTERCEPTOR
// =====================================
axiosInstance.interceptors.response.use(
  (response) => {
    // Логирование в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Если запрос уже к эндпоинту обновления токена, не пытаемся рефрешить повторно
    if (originalRequest?.url && String(originalRequest.url).includes(API_ENDPOINTS.REFRESH)) {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Логирование ошибок в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`, {
        status: error.response?.status,
        error: error.response?.data,
      });
    }

    // Обработка 401 ошибки (Unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = getRefreshToken();

      // refreshToken у нас не JWT, поэтому не проверяем срок действия
      if (refreshToken) {
        try {
          // Единый запрос рефреша на все параллельные 401
          if (!refreshRequest) {
            refreshRequest = axios.post(
              `${API_BASE_URL}${API_ENDPOINTS.REFRESH}`,
              { refreshToken },
              { headers: { 'Content-Type': 'application/json' } }
            ).finally(() => { refreshRequest = null; });
          }

          const response = await refreshRequest;

          if (response.data && (response.data.success || response.status === 200)) {
            const newToken = response.data.token || response.data.data?.tokens?.accessToken;
            const newRefreshToken = response.data.refreshToken || response.data.data?.tokens?.refreshToken || refreshToken;

            // Сохраняем новые токены
            setTokens(newToken, newRefreshToken);

            // Повторяем оригинальный запрос с новым токеном
            originalRequest.headers.Authorization = `Bearer ${newToken}`;

            // Обновляем company_id если изменился
            const companyId = getTenantIdFromToken(newToken);
            if (companyId) {
              originalRequest.headers['X-Tenant-ID'] = companyId;
            }

            return axiosInstance(originalRequest);
          }
        } catch (refreshError) {
          console.warn('Token refresh failed:', refreshError);
          // Если обновление токена не удалось, очищаем авторизацию
          clearTokens();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // Если нет refresh токена или он истек
        clearTokens();
        window.location.href = '/login';
      }
    }

    // Обработка других ошибок
    if (error.response) {
      const status = error.response.status;
      const errorMessage = error.response.data?.error ||
                          error.response.data?.message ||
                          'Произошла ошибка';

      // Показываем уведомления для всех ошибок (кроме 401, который обрабатывается отдельно)
      if (status !== 401) {
        notification.error({
          message: 'Ошибка',
          description: errorMessage,
          duration: 5,
        });
      }
    } else if (error.request) {
      // Ошибка сети
      notification.error({
        message: 'Ошибка сети',
        description: 'Проверьте соединение с интернетом',
        duration: 5,
      });
    } else {
      // Другие ошибки
      notification.error({
        message: 'Ошибка',
        description: error.message || 'Неизвестная ошибка',
        duration: 5,
      });
    }

    return Promise.reject(error);
  }
);

// =====================================
// ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ
// =====================================

/**
 * Установка токена извне
 */
axiosInstance.setToken = (token, refreshToken = null) => {
  setTokens(token, refreshToken);
};

/**
 * Очистка токенов извне
 */
axiosInstance.clearTokens = () => {
  clearTokens();
};

/**
 * Получение текущего токена
 */
axiosInstance.getToken = () => {
  return getToken();
};

/**
 * Проверка авторизации
 */
axiosInstance.isAuthenticated = () => {
  const token = getToken();
  return token && !isTokenExpired(token);
};

/**
 * Получение информации о текущем пользователе из токена
 */
axiosInstance.getCurrentUser = () => {
  const token = getToken();
  return decodeToken(token);
};

/**
 * Создание URL для файлов/изображений
 */
axiosInstance.createFileUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL.replace('/api', '')}${path}`;
};

// =====================================
// ЭКСПОРТ
// =====================================
export default axiosInstance;