// ===================================================
// ФАЙЛ: frontend/src/utils/axios.js
// УНИФИЦИРОВАННЫЙ HTTP КЛИЕНТ
// ===================================================
import axios from 'axios';
import { notification } from 'antd';

// =====================================
// КОНФИГУРАЦИЯ
// =====================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.moduletrade.ru/api';
const REQUEST_TIMEOUT = 30000;

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
 */
const getToken = () => {
  return localStorage.getItem('token');
};

/**
 * Получение refresh токена
 */
const getRefreshToken = () => {
  return localStorage.getItem('refreshToken');
};

/**
 * Сохранение токенов
 */
const setTokens = (token, refreshToken = null) => {
  localStorage.setItem('token', token);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
};

/**
 * Очистка токенов
 */
const clearTokens = () => {
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
 * Получение tenant_id из токена
 */
const getTenantIdFromToken = (token) => {
  const decoded = decodeToken(token);
  return decoded?.tenant_id || null;
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
      
      // Добавляем tenant_id если есть в токене
      const tenantId = getTenantIdFromToken(token);
      if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
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
      
      if (refreshToken && !isTokenExpired(refreshToken)) {
        try {
          // Пытаемся обновить токен
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken: refreshToken,
          });
          
          if (response.data.success && response.data.token) {
            const { token: newToken, refreshToken: newRefreshToken } = response.data;
            
            // Сохраняем новые токены
            setTokens(newToken, newRefreshToken || refreshToken);
            
            // Повторяем оригинальный запрос с новым токеном
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            // Обновляем tenant_id если изменился
            const tenantId = getTenantIdFromToken(newToken);
            if (tenantId) {
              originalRequest.headers['X-Tenant-ID'] = tenantId;
            }
            
            return axiosInstance(originalRequest);
          }
        } catch (refreshError) {
          console.warn('Token refresh failed:', refreshError);
          // Если refresh не удался, очищаем токены и перенаправляем на логин
          clearTokens();
          
          // Перенаправляем только если не находимся уже на странице логина
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          
          return Promise.reject(refreshError);
        }
      } else {
        // Refresh токен отсутствует или истек
        clearTokens();
        
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        
        return Promise.reject(error);
      }
    }
    
    // Обработка других HTTP ошибок
    if (error.response) {
      const { status, data } = error.response;
      let errorMessage = 'Произошла ошибка';
      
      // Определяем сообщение об ошибке
      if (data?.message) {
        errorMessage = data.message;
      } else if (data?.error) {
        errorMessage = data.error;
      } else {
        switch (status) {
          case 400:
            errorMessage = 'Неверные данные запроса';
            break;
          case 401:
            errorMessage = 'Ошибка авторизации';
            break;
          case 403:
            errorMessage = 'Доступ запрещен';
            break;
          case 404:
            errorMessage = 'Ресурс не найден';
            break;
          case 422:
            errorMessage = 'Ошибка валидации данных';
            break;
          case 429:
            errorMessage = 'Слишком много запросов';
            break;
          case 500:
            errorMessage = 'Внутренняя ошибка сервера';
            break;
          default:
            errorMessage = `Ошибка сервера (${status})`;
        }
      }
      
      // Показываем уведомление (кроме 401, который обрабатывается отдельно)
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