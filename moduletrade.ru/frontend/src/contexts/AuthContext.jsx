// ===================================================
// ФАЙЛ: frontend/src/contexts/AuthContext.jsx
// ===================================================
import React, { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Проверяем авторизацию при загрузке приложения
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.me();
      if (response.data.success) {
        const userData = response.data.data;
        setUser(userData);
        setTenant(userData.tenant);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Токен недействителен, очищаем localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);

      if (response.data.success) {
        const { user: userData, access_token, refresh_token } = response.data.data;

        // Сохраняем токены
        localStorage.setItem('accessToken', access_token);
        localStorage.setItem('refreshToken', refresh_token);

        // Устанавливаем состояние пользователя
        setUser(userData);
        setTenant(userData.tenant);
        setIsAuthenticated(true);

        message.success('Вход выполнен успешно');
        return { success: true };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || 'Ошибка входа в систему';
      message.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      // Отправляем запрос на logout (опционально)
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Очищаем состояние и localStorage
      setUser(null);
      setTenant(null);
      setIsAuthenticated(false);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');

      // Перенаправляем на страницу входа
      window.location.href = '/login';
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    if (userData.tenant) {
      setTenant(userData.tenant);
    }
  };

  const changePassword = async (passwordData) => {
    try {
      const response = await authAPI.changePassword(passwordData);
      if (response.data.success) {
        message.success('Пароль изменен успешно');
        return { success: true };
      }
    } catch (error) {
      console.error('Change password error:', error);
      const errorMessage = error.response?.data?.error || 'Ошибка изменения пароля';
      message.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const value = {
    user,
    tenant,
    isAuthenticated,
    loading,
    login,
    logout,
    updateUser,
    changePassword,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};