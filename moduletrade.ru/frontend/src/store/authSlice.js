// ===================================================
// ФАЙЛ: frontend/src/store/authSlice.js
// ИСПРАВЛЕННАЯ ВЕРСИЯ: Добавлены селекторы
// ===================================================
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { message } from 'antd';
import axios from 'utils/axios';
import { API_ENDPOINTS } from 'utils/constants';

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
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

      if (!token) {
        return { isAuthenticated: false };
      }

      const response = await axios.get(API_ENDPOINTS.ME);
      if (response.data.success) {
        const userData = response.data.data;
        return {
          isAuthenticated: true,
          user: userData.user,
          tenant: userData.tenant
        };
      }

      return { isAuthenticated: false };
    } catch (error) {
      // Токен недействителен, очищаем localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return rejectWithValue('Token invalid');
    }
  }
);

/**
 * Регистрация нового пользователя
 */
export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await axios.post(API_ENDPOINTS.REGISTER, userData);

      if (response.data.success) {
        // Поддержка обоих форматов ответа
        const accessToken = response.data.token || response.data.data?.tokens?.accessToken;
        const refreshToken = response.data.refreshToken || response.data.data?.tokens?.refreshToken;
        const user = response.data.user || response.data.data?.user;
        const tenant = response.data.tenant || response.data.data?.tenant;

        // Сохраняем токены
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('token', accessToken); // Для обратной совместимости
        localStorage.setItem('refreshToken', refreshToken);

        message.success('Регистрация успешна! Добро пожаловать!');

        return {
          user: {
            ...user,
            company_id: user.company_id || tenant?.id,
            company_name: user.company_name || tenant?.name
          },
          tenant,
          token: accessToken,
          refreshToken
        };
      }

      throw new Error(response.data.error || 'Registration failed');
    } catch (error) {
      const errorMessage = error.response?.data?.error ||
                          error.response?.data?.message ||
                          error.message ||
                          'Ошибка регистрации';

      message.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

/**
 * Вход в систему
 */
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password, rememberMe }, { rejectWithValue }) => {
    try {
      const response = await axios.post(API_ENDPOINTS.LOGIN, {
        email,
        password,
        remember_me: rememberMe
      });

      if (response.data.success) {
        // Поддержка обоих форматов ответа
        const accessToken = response.data.token || response.data.data?.tokens?.accessToken;
        const refreshToken = response.data.refreshToken || response.data.data?.tokens?.refreshToken;
        const user = response.data.user || response.data.data?.user;
        const tenant = response.data.tenant || response.data.data?.tenant;

        // Сохраняем токены
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('token', accessToken); // Для обратной совместимости
        localStorage.setItem('refreshToken', refreshToken);

        message.success('Вход выполнен успешно!');

        return {
          user: {
            ...user,
            company_id: user.company_id || tenant?.id,
            company_name: user.company_name || tenant?.name
          },
          tenant,
          token: accessToken,
          refreshToken
        };
      }

      throw new Error(response.data.error || 'Login failed');
    } catch (error) {
      const errorMessage = error.response?.data?.error ||
                          error.response?.data?.message ||
                          error.message ||
                          'Ошибка входа в систему';

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
      // Вызываем API для выхода из системы
      await axios.post(API_ENDPOINTS.LOGOUT);
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // В любом случае очищаем localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      message.success('Вы успешно вышли из системы');
    }
  }
);

/**
 * Смена пароля
 */
export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      const response = await axios.post(API_ENDPOINTS.CHANGE_PASSWORD, {
        currentPassword,
        newPassword
      });

      if (response.data.success) {
        message.success('Пароль успешно изменен');
        return true;
      }

      throw new Error(response.data.error || 'Failed to change password');
    } catch (error) {
      const errorMessage = error.response?.data?.error ||
                          error.response?.data?.message ||
                          error.message ||
                          'Ошибка смены пароля';

      message.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// =====================================
// INITIAL STATE
// =====================================
const initialState = {
  isAuthenticated: false,
  user: null,
  tenant: null,
  token: null,
  refreshToken: null,
  loading: false,
  error: null,
  checkingAuth: true, // Флаг для проверки авторизации при загрузке
};

// =====================================
// SLICE
// =====================================
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Очистка ошибки
    clearError: (state) => {
      state.error = null;
    },

    // Обновление данных пользователя
    updateUser: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },

    // Установка tenant
    setTenant: (state, action) => {
      state.tenant = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Check Auth
    builder
      .addCase(checkAuth.pending, (state) => {
        state.checkingAuth = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        if (action.payload.isAuthenticated) {
          state.isAuthenticated = true;
          state.user = action.payload.user;
          state.tenant = action.payload.tenant;
          state.token = localStorage.getItem('accessToken') || localStorage.getItem('token');
          state.refreshToken = localStorage.getItem('refreshToken');
        } else {
          state.isAuthenticated = false;
          state.user = null;
          state.tenant = null;
          state.token = null;
          state.refreshToken = null;
        }
        state.checkingAuth = false;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.tenant = null;
        state.token = null;
        state.refreshToken = null;
        state.checkingAuth = false;
      });

    // Register
    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.tenant = action.payload.tenant;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.loading = false;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.tenant = action.payload.tenant;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.loading = false;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Logout
    builder
      .addCase(logoutUser.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.tenant = null;
        state.token = null;
        state.refreshToken = null;
        state.error = null;
      });

    // Change Password
    builder
      .addCase(changePassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

// =====================================
// ACTIONS
// =====================================
export const { clearError, updateUser, setTenant } = authSlice.actions;

// =====================================
// SELECTORS
// =====================================
export const selectUser = (state) => state.auth.user;
export const selectTenant = (state) => state.auth.tenant;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectUserRole = (state) => state.auth.user?.role;
export const selectIsActive = (state) => state.auth.user?.is_active === true;
export const selectCheckingAuth = (state) => state.auth.checkingAuth;
export const selectToken = (state) => state.auth.token;
export const selectRefreshToken = (state) => state.auth.refreshToken;

// =====================================
// EXPORTS
// =====================================
export default authSlice.reducer;