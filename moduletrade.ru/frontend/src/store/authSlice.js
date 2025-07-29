// frontend/src/store/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '../services/api';

// =====================================
// ASYNC THUNKS
// =====================================

/**
 * Авторизация пользователя
 */
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password, rememberMe = false }, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(email, password, rememberMe);
      
      // ✅ ИСПРАВЛЕНО: Используем правильную структуру ответа
      const responseData = response.data.data || response.data;

      // Сохраняем токены в localStorage
      localStorage.setItem('token', responseData.token);
      localStorage.setItem('refreshToken', responseData.refreshToken);
      localStorage.setItem('user', JSON.stringify(responseData.user));

      return responseData;
    } catch (error) {
      console.error('Login error:', error);
      return rejectWithValue(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Ошибка авторизации'
      );
    }
  }
);

/**
 * Регистрация нового пользователя
 */
export const registerUser = createAsyncThunk(
  'auth/register',
  async ({ name, email, password, company_name }, { rejectWithValue }) => {
    try {
      const response = await authAPI.register({
        name,
        email,
        password,
        company_name
      });

      // ✅ ИСПРАВЛЕНО: Используем правильную структуру ответа
      const responseData = response.data.data || response.data;

      // Сохраняем токены в localStorage
      localStorage.setItem('token', responseData.token);
      localStorage.setItem('refreshToken', responseData.refreshToken);
      localStorage.setItem('user', JSON.stringify(responseData.user));

      return responseData;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Ошибка регистрации'
      );
    }
  }
);

/**
 * Обновление токена
 */
export const refreshToken = createAsyncThunk(
  'auth/refresh',
  async (_, { rejectWithValue }) => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await authAPI.refresh(refreshToken);

      // ✅ ИСПРАВЛЕНО: Используем правильную структуру ответа
      const responseData = response.data.data || response.data;

      // Обновляем токен
      localStorage.setItem('token', responseData.token);

      return responseData;
    } catch (error) {
      // Очищаем токены при ошибке
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      return rejectWithValue('Срок действия сессии истек');
    }
  }
);

/**
 * Получение текущего пользователя
 */
export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authAPI.getCurrentUser();

      // ✅ ИСПРАВЛЕНО: Используем правильную структуру ответа
      const userData = response.data.data?.user || response.data.user || response.data;

      // Обновляем данные пользователя в localStorage
      localStorage.setItem('user', JSON.stringify(userData));

      return userData;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Ошибка получения данных пользователя'
      );
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
      // Пытаемся уведомить сервер о выходе
      await authAPI.logout();
    } catch (error) {
      // Игнорируем ошибки API при выходе
      console.warn('Logout API error:', error);
    } finally {
      // В любом случае очищаем локальные данные
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }

    return null;
  }
);

// =====================================
// INITIAL STATE
// =====================================

const getInitialUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
    return null;
  }
};

const initialState = {
  user: getInitialUser(),
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
  error: null,
  isRegistering: false,
  isRefreshing: false,
};

// =====================================
// SLICE
// =====================================

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Ручной выход из системы
     */
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      state.loading = false;
      state.isRegistering = false;
      state.isRefreshing = false;

      // Очищаем localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    },

    /**
     * Очистка ошибок
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * Установка пользователя
     */
    setUser: (state, action) => {
      state.user = action.payload;
      if (action.payload) {
        localStorage.setItem('user', JSON.stringify(action.payload));
      }
    },

    /**
     * Установка токена
     */
    setToken: (state, action) => {
      state.token = action.payload;
      state.isAuthenticated = !!action.payload;
      if (action.payload) {
        localStorage.setItem('token', action.payload);
      } else {
        localStorage.removeItem('token');
      }
    },

    /**
     * Очистка состояния загрузки
     */
    clearLoading: (state) => {
      state.loading = false;
      state.isRegistering = false;
      state.isRefreshing = false;
    }
  },

  extraReducers: (builder) => {
    builder
      // ===== LOGIN =====
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
      })

      // ===== REGISTER =====
      .addCase(registerUser.pending, (state) => {
        state.isRegistering = true;
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isRegistering = false;
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isRegistering = false;
        state.loading = false;
        state.error = action.payload;
      })

      // ===== REFRESH TOKEN =====
      .addCase(refreshToken.pending, (state) => {
        state.isRefreshing = true;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.isRefreshing = false;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        if (action.payload.user) {
          state.user = action.payload.user;
        }
      })
      .addCase(refreshToken.rejected, (state) => {
        state.isRefreshing = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;

        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      })

      // ===== GET CURRENT USER =====
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.loading = false;
        // Не очищаем токены при ошибке получения пользователя
        // это может быть временная проблема сети
        if (!state.token) {
          state.isAuthenticated = false;

          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      })

      // ===== LOGOUT =====
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.error = null;
        state.isRegistering = false;
        state.isRefreshing = false;
      })
      .addCase(logoutUser.rejected, (state) => {
        // Даже при ошибке API очищаем состояние
        state.loading = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.error = null;
        state.isRegistering = false;
        state.isRefreshing = false;
      });
  },
});

// =====================================
// SELECTORS
// =====================================

export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectIsRegistering = (state) => state.auth.isRegistering;

// =====================================
// EXPORTS
// =====================================

export const {
  logout,
  clearError,
  setUser,
  setToken,
  clearLoading
} = authSlice.actions;

export default authSlice.reducer;