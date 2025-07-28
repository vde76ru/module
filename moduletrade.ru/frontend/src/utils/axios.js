// frontend/src/utils/axios.js
import axios from 'axios';
import { notification } from 'antd';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.moduletrade.ru/api';

// Создаем экземпляр axios
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor для добавления токена к запросам
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Добавляем tenant_id из токена если есть
    try {
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.tenant_id) {
          config.headers['X-Tenant-ID'] = payload.tenant_id;
        }
      }
    } catch (error) {
      console.warn('Error parsing token:', error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor для обработки ответов и ошибок
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const { config, response } = error;

    // Если получили 401 (Unauthorized)
    if (response?.status === 401) {
      // Пытаемся обновить токен
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken && !config.__isRetryRequest) {
        try {
          config.__isRetryRequest = true;

          const refreshResponse = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { refreshToken }
          );

          const { token: newToken } = refreshResponse.data;
          localStorage.setItem('token', newToken);

          // Повторяем оригинальный запрос с новым токеном
          config.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(config);

        } catch (refreshError) {
          // Если обновление токена не удалось, очищаем хранилище и перенаправляем на логин
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');

          notification.warning({
            message: 'Сессия истекла',
            description: 'Пожалуйста, войдите в систему заново',
            duration: 4,
          });

          // Перенаправляем на страницу логина
          setTimeout(() => {
            window.location.href = '/login';
          }, 1000);

          return Promise.reject(refreshError);
        }
      } else {
        // Нет refresh токена или уже пытались обновить
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');

        notification.warning({
          message: 'Требуется авторизация',
          description: 'Пожалуйста, войдите в систему',
          duration: 4,
        });

        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      }
    }

    // Обработка других ошибок
    if (response?.status >= 500) {
      notification.error({
        message: 'Ошибка сервера',
        description: 'Произошла внутренняя ошибка сервера. Попробуйте позже.',
        duration: 6,
      });
    } else if (response?.status === 403) {
      notification.error({
        message: 'Доступ запрещен',
        description: 'У вас нет прав для выполнения этого действия',
        duration: 4,
      });
    } else if (response?.status === 404) {
      notification.warning({
        message: 'Не найдено',
        description: 'Запрашиваемый ресурс не найден',
        duration: 4,
      });
    } else if (response?.status === 422) {
      // Ошибки валидации
      const errors = response.data?.errors || {};
      const errorMessages = Object.values(errors).flat();

      notification.error({
        message: 'Ошибка валидации',
        description: errorMessages.join(', ') || 'Проверьте правильность заполнения полей',
        duration: 6,
      });
    } else if (response?.status >= 400 && response?.status < 500) {
      // Клиентские ошибки
      const message = response.data?.message || response.data?.error || 'Ошибка запроса';

      notification.error({
        message: 'Ошибка',
        description: message,
        duration: 4,
      });
    }

    // Сетевые ошибки
    if (!response && error.code === 'NETWORK_ERROR') {
      notification.error({
        message: 'Ошибка сети',
        description: 'Проверьте подключение к интернету',
        duration: 4,
      });
    }

    // Timeout ошибки
    if (error.code === 'ECONNABORTED') {
      notification.error({
        message: 'Превышено время ожидания',
        description: 'Запрос выполняется слишком долго, попробуйте позже',
        duration: 4,
      });
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;