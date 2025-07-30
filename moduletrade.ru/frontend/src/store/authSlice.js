// ===================================================
// ФАЙЛ: frontend/src/store/authSlice.js
// УНИФИЦИРОВАННЫЙ: Объединена логика AuthContext + authSlice
// ===================================================
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { message } from 'antd';
import axios from '../utils/axios';
import { API_ENDPOINTS } from '../utils/constants';

// =====================================
// ASYNC THUNKS
// =====================================

/**
 * Проверка авторизации при загрузке приложения
 */
export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('accessToken');

      if (!token) {
        return { isAuthenticated: false };
      }

      const response = await axios.get(API_ENDPOINTS.ME);
      if (response.data.success) {
        const userData = response.data.data;
        return {
          isAuthenticated: true,
          user: userData,
          tenant: userData.tenant
        };
      }
      
      return { isAuthenticated: false };
    } catch (error) {
      // Токен недействителен, очищаем localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return rejectWithValue('Token invalid');
    }
  }
);

/**
 * Вход в систему
 */
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await axios.post(API_ENDPOINTS.LOGIN, credentials);

      if (response.data.success) {
        const { user: userData, access_token, refresh_token } = response.data.data;

        // Сохраняем токены
        localStorage.setItem('accessToken', access_token);
        localStorage.setItem('refreshToken', refresh_token);

        message.success('Вход выполнен успешно');
        
        return {
          user: userData,
          tenant: userData.tenant,
          tokens: {
            accessToken: access_token,
            refreshToken: refresh_token
          }
        };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Ошибка входа в систему';
      message.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

/**
 * Выход из системы
 */
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      // Отправляем запрос на logout (опционально)
      await axios.post(API_ENDPOINTS.LOGOUT);
    } catch (error) {
      console.error('Logout error:', error);
      // Игнорируем ошибки при выходе
    } finally {
      // Очищаем localStorage в любом случае
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      // Перенаправляем на страницу входа
      window.location.href = '/login';
    }
  }
);

/**
 * Смена пароля
 */
export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (passwordData, { rejectWithValue }) => {
    try {
      const response = await axios.post(API_ENDPOINTS.CHANGE_PASSWORD, passwordData);
      if (response.data.success) {
        message.success('Пароль изменен успешно');
        return response.data;
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Ошибка изменения пароля';
      message.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

/**
 * Обновление токена
 */
export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post(API_ENDPOINTS.REFRESH, {
        refreshToken
      });

      const { access_token, refresh_token } = response.data;

      // Обновляем токены
      localStorage.setItem('accessToken', access_token);
      if (refresh_token) {
        localStorage.setItem('refreshToken', refresh_token);
      }

      return {
        accessToken: access_token,
        refreshToken: refresh_token
      };
    } catch (error) {
      // При ошибке обновления токена очищаем авторизацию
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return rejectWithValue('Refresh failed');
    }
  }
);

// =====================================
// INITIAL STATE
// =====================================

const initialState = {
  user: null,
  tenant: null,
  isAuthenticated: false,
  loading: true, // Важно: true для начальной проверки авторизации
  error: null,
  tokens: {
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken')
  }
};

// =====================================
// SLICE
// =====================================

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Ручная очистка ошибок
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * Обновление данных пользователя
     */
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      if (action.payload.tenant) {
        state.tenant = action.payload.tenant;
      }
    },

    /**
     * Ручной сброс состояния (для форс-логаута)
     */
    resetAuth: (state) => {
      state.user = null;
      state.tenant = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      state.tokens = {
        accessToken: null,
        refreshToken: null
      };
      
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  },
  extraReducers: (builder) => {
    builder
      // ========== CHECK AUTH ==========
      .addCase(checkAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.isAuthenticated) {
          state.user = action.payload.user;
          state.tenant = action.payload.tenant;
          state.isAuthenticated = true;
        } else {
          state.isAuthenticated = false;
        }
      })
      .addCase(checkAuth.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.tenant = null;
      })

      // ========== LOGIN ==========
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.tenant = action.payload.tenant;
        state.tokens = action.payload.tokens;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })

      // ========== LOGOUT ==========
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.tenant = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.error = null;
        state.tokens = {
          accessToken: null,
          refreshToken: null
        };
      })

      // ========== CHANGE PASSWORD ==========
      .addCase(changePassword.pending, (state) => {
        state.loading = true;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // ========== REFRESH TOKEN ==========
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.tokens = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(refreshToken.rejected, (state) => {
        state.user = null;
        state.tenant = null;
        state.isAuthenticated = false;
        state.tokens = {
          accessToken: null,
          refreshToken: null
        };
      });
  }
});

// =====================================
// ACTIONS
// =====================================

export const { clearError, updateUser, resetAuth } = authSlice.actions;

// =====================================
// SELECTORS
// =====================================

export const selectUser = (state) => state.auth.user;
export const selectTenant = (state) => state.auth.tenant;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectTokens = (state) => state.auth.tokens;

// Производные селекторы
export const selectUserRole = (state) => state.auth.user?.role;
export const selectIsActive = (state) => state.auth.user?.is_active === true;

// =====================================
// ЭКСПОРТ
// =====================================

export default authSlice.reducer;