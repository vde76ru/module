// ===================================================
// ФАЙЛ: frontend/src/hooks/useAuth.js
// НОВЫЙ ФАЙЛ: Замена useAuth из AuthContext на Redux
// ===================================================
import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import {
  selectUser,
  selectCompany,
  selectIsAuthenticated,
  selectIsLoading,
  selectAuthError,
  selectUserRole,
  selectIsActive,
  selectCheckingAuth,
  checkAuth,
  loginUser,
  logoutUser,
  changePassword,
  updateUser,
  clearError
} from '../store/authSlice';

/**
 * Хук для работы с аутентификацией через Redux
 * Полная замена useAuth из AuthContext
 */
export const useAuth = () => {
  const dispatch = useDispatch();

  // Селекторы
  const user = useSelector(selectUser);
  const company = useSelector(selectCompany);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectIsLoading);
  const isCheckingAuth = useSelector(selectCheckingAuth);
  const loading = isLoading || isCheckingAuth;
  const error = useSelector(selectAuthError);
  const userRole = useSelector(selectUserRole);
  const isActive = useSelector(selectIsActive);

  // Действия
  const checkAuthAsync = useCallback(() => {
    return dispatch(checkAuth());
  }, [dispatch]);

  const login = useCallback(async (credentials) => {
    const result = await dispatch(loginUser(credentials));
    if (result.type === 'auth/login/fulfilled') {
      return { success: true };
    } else {
      return { success: false, error: result.payload };
    }
  }, [dispatch]);

  const logout = useCallback(() => {
    return dispatch(logoutUser());
  }, [dispatch]);

  const changePasswordAsync = useCallback(async (passwordData) => {
    const result = await dispatch(changePassword(passwordData));
    if (result.type === 'auth/changePassword/fulfilled') {
      return { success: true };
    } else {
      return { success: false, error: result.payload };
    }
  }, [dispatch]);

  const updateUserData = useCallback((userData) => {
    dispatch(updateUser(userData));
  }, [dispatch]);

  const clearAuthError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    // Состояние
    user,
    company,
    isAuthenticated,
    loading,
    error,
    userRole,
    isActive,

    // Действия (сохраняем совместимость с AuthContext API)
    checkAuth: checkAuthAsync,
    login,
    logout,
    changePassword: changePasswordAsync,
    updateUser: updateUserData,
    clearError: clearAuthError
  };
};