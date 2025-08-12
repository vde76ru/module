// ===================================================
// ФАЙЛ: frontend/src/components/Auth/ProtectedRoute.jsx
// ✅ ОБНОВЛЕНО: Использует Redux вместо AuthContext
// ✅ Объединяет функциональность ProtectedRoute и PermissionGuard
// ===================================================
import React from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from 'hooks/useAuth';
import { usePermissions } from 'hooks/usePermissions';

/**
 * Компонент для защиты роутов с проверкой авторизации и прав доступа
 * Объединяет функциональность старых ProtectedRoute и PermissionGuard
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Защищаемый контент
 * @param {string} props.permission - Одиночное право для проверки
 * @param {string[]} props.permissions - Массив прав для проверки
 * @param {boolean} props.requireAll - Требовать все права из массива (true) или хотя бы одно (false)
 * @param {boolean} props.adminOnly - Доступ только для администраторов
 * @param {string} props.redirectTo - Куда перенаправлять при отсутствии доступа
 */
const ProtectedRoute = ({
  children,
  permission,
  permissions,
  requireAll = true,
  adminOnly = false,
  redirectTo = '/login'
}) => {
  const { isAuthenticated, loading, user } = useAuth();
  const { hasPermission, hasPermissions, isAdmin } = usePermissions();

  // Показываем загрузку пока проверяем авторизацию
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" tip="Проверка авторизации..." />
      </div>
    );
  }

  // Если не авторизован - перенаправляем на логин
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Проверяем активность пользователя
  if (user && !user.is_active) {
    return <Navigate to="/account-suspended" replace />;
  }

  // Проверка прав администратора
  if (adminOnly && !isAdmin()) {
    return <Navigate to="/403" replace />;
  }

  // Проверка единичного права
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/403" replace />;
  }

  // Проверка множественных прав
  if (permissions && permissions.length > 0) {
    const hasRequiredPermissions = hasPermissions(permissions, requireAll);
    if (!hasRequiredPermissions) {
      return <Navigate to="/403" replace />;
    }
  }

  // Если все проверки пройдены - показываем контент
  return children;
};

export default ProtectedRoute;