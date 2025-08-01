// ===================================================
// ФАЙЛ: frontend/src/hooks/usePermissions.js
// ОБНОВЛЕНО: Использует новый useAuth из Redux вместо AuthContext
// ===================================================
import { useAuth } from './useAuth';
import {
  hasPermission,
  hasPermissions,
  isAdmin,
  isSuperAdmin,
  getRolePermissions
} from '../utils/constants';

/**
 * Хук для работы с правами пользователя
 * Обновлен для работы с Redux authSlice
 */
export const usePermissions = () => {
  const { user, tenant, userRole } = useAuth();

  return {
    // Базовые проверки прав
    hasPermission: (permission) => hasPermission(userRole, permission),
    hasPermissions: (permissions, requireAll = true) =>
      hasPermissions(userRole, permissions, requireAll),

    // Проверка ролей
    isAdmin: () => isAdmin(userRole),
    isSuperAdmin: () => isSuperAdmin(userRole), // всегда false в текущей системе

    // Получение всех прав роли
    getAllPermissions: () => getRolePermissions(userRole),

    // Информация о пользователе
    user,
    userRole,
    tenant,

    // Проверка активности пользователя
    isActive: user?.is_active === true,
  };
};