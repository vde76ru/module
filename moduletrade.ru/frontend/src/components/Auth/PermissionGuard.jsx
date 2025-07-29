// ===================================================
// ФАЙЛ: frontend/src/components/Auth/PermissionGuard.jsx
// ===================================================
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, hasPermissions, isAdmin } from '../../utils/constants';
import { Result } from 'antd';

const PermissionGuard = ({
  permission,
  permissions,
  requireAll = true,
  adminOnly = false,
  fallback = null,
  children
}) => {
  const { user } = useAuth();

  if (!user) {
    return fallback || (
      <Result
        status="403"
        title="403"
        subTitle="Вы не авторизованы"
      />
    );
  }

  const userRole = user.role;

  // Проверка на админа
  if (adminOnly && !isAdmin(userRole)) {
    return fallback || (
      <Result
        status="403"
        title="403"
        subTitle="Доступ только для администраторов"
      />
    );
  }

  // Проверка конкретного права
  if (permission && !hasPermission(userRole, permission)) {
    return fallback || (
      <Result
        status="403"
        title="403"
        subTitle="У вас нет прав для доступа к этой функции"
      />
    );
  }

  // Проверка множественных прав
  if (permissions && !hasPermissions(userRole, permissions, requireAll)) {
    return fallback || (
      <Result
        status="403"
        title="403"
        subTitle="У вас нет достаточных прав для доступа к этой функции"
      />
    );
  }

  return children;
};

export default PermissionGuard;