// ===================================================
// ФАЙЛ: frontend/src/components/Auth/ProtectedRoute.jsx
// ===================================================
import React from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../contexts/AuthContext';
import PermissionGuard from './PermissionGuard';

const ProtectedRoute = ({
  children,
  permission,
  permissions,
  requireAll = true,
  adminOnly = false,
  redirectTo = '/login'
}) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Проверяем активность пользователя
  if (user && !user.is_active) {
    return <Navigate to="/account-suspended" replace />;
  }

  return (
    <PermissionGuard
      permission={permission}
      permissions={permissions}
      requireAll={requireAll}
      adminOnly={adminOnly}
      fallback={<Navigate to="/403" replace />}
    >
      {children}
    </PermissionGuard>
  );
};

export default ProtectedRoute;