// ===================================================
// ФАЙЛ: frontend/src/hooks/usePermissions.js
// ОБНОВЛЕНО: Использует новый useAuth из Redux вместо AuthContext
// ===================================================
import { useAuth } from './useAuth';
import {
  hasPermission as hasPermissionByRole,
  hasPermissions as hasPermissionsByRole,
  isAdmin as isAdminByRole,
  isSuperAdmin,
  getRolePermissions,
  USER_ROLES,
} from '../utils/constants';

/**
 * Хук для работы с правами пользователя
 * Обновлен для работы с Redux authSlice
 */
// Нормализация роли из бэкенда к кодам фронтенда
const normalizeUserRole = (rawRole) => {
  if (!rawRole) return null;
  const role = String(rawRole).toLowerCase();
  // Уже код
  if ([USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.OPERATOR, USER_ROLES.VIEWER].includes(role)) {
    return role;
  }
  // Отображаемые имена (ru)
  if (['владелец', 'администратор'].includes(role)) return USER_ROLES.ADMIN;
  if (['менеджер'].includes(role)) return USER_ROLES.MANAGER;
  if (['оператор'].includes(role)) return USER_ROLES.OPERATOR;
  if (['просмотр', 'наблюдатель', 'viewer'].includes(role)) return USER_ROLES.VIEWER;
  return USER_ROLES.VIEWER;
};

export const usePermissions = () => {
  const { user, company, userRole: userRoleFromState } = useAuth();

  const rawRole = userRoleFromState || user?.role || user?.roleName || user?.role_name || user?.role_code;
  const effectiveRole = normalizeUserRole(rawRole);

  return {
    // Базовые проверки прав
    hasPermission: (permission) => hasPermissionByRole(effectiveRole, permission),
    hasPermissions: (permissions, requireAll = true) =>
      hasPermissionsByRole(effectiveRole, permissions, requireAll),

    // Проверка ролей
    isAdmin: () => isAdminByRole(effectiveRole),
    isSuperAdmin: () => isSuperAdmin(effectiveRole),

    // Получение всех прав роли
    getAllPermissions: () => getRolePermissions(effectiveRole),

    // Информация о пользователе
    user,
    userRole: effectiveRole,
    company,

    // Проверка активности пользователя
    isActive: user?.is_active === true,
  };
};