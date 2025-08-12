// ===================================================
// ФАЙЛ: frontend/src/App.js
// ИСПРАВЛЕННАЯ ВЕРСИЯ: Восстановлен компонент AuthInitializer
// ===================================================
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { Provider, useDispatch } from 'react-redux';
import { store } from './store';
import { checkAuth } from './store/authSlice';

import ProtectedRoute from './components/Auth/ProtectedRoute';
import Layout from './components/Layout/Layout';

// ===================================================
// СТРАНИЦЫ
// ===================================================

// Auth страницы
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import Dashboard from './pages/Dashboard/Dashboard';

// Основные страницы
import ProductsPage from './pages/Products/ProductsPage';
import OrdersPage from './pages/Orders/OrdersPage';
import MarketplacesPage from './pages/Marketplaces/MarketplacesPage';
import WarehousesPage from './pages/Warehouses/WarehousesPage';
import SuppliersPage from './pages/Suppliers/SuppliersPage';
import UsersPage from './pages/Users/UsersPage';
import AnalyticsPage from './pages/Analytics/AnalyticsPage';
import SyncPage from './pages/Sync/SyncPage';
import SettingsPage from './pages/Settings/SettingsPage';
import MappingDashboard from './pages/Mapping/MappingDashboard';
import IntelligentMappingManager from './pages/Mapping/IntelligentMappingManager';
import DictionariesPage from './pages/Dictionaries/DictionariesPage';
import IntegrationsPage from './pages/Integrations/IntegrationsPage';
import RS24SetupWizard from './pages/Integrations/RS24SetupWizard';

// Error страницы
import ForbiddenPage from './pages/Error/ForbiddenPage';
import NotFoundPage from './pages/Error/NotFoundPage';
import AccountSuspendedPage from './pages/Error/AccountSuspendedPage';

import { PERMISSIONS } from 'utils/constants';

// ===================================================
// КОМПОНЕНТ ИНИЦИАЛИЗАЦИИ АВТОРИЗАЦИИ
// ===================================================
const AuthInitializer = ({ children }) => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Автоматически проверяем авторизацию при загрузке приложения
    dispatch(checkAuth());
  }, [dispatch]);

  return children;
};

// ===================================================
// ОСНОВНОЕ ПРИЛОЖЕНИЕ
// ===================================================
function AppContent() {
  return (
    <ConfigProvider locale={ruRU}>
      <AuthInitializer>
        <Router>
          <Routes>
            {/* Публичные маршруты */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/account-suspended" element={<AccountSuspendedPage />} />

            {/* Защищенные маршруты */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              {/* Главная страница */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />

              {/* Товары - требуется право просмотра товаров */}
              <Route path="products/*" element={
                <ProtectedRoute permission={PERMISSIONS.PRODUCTS_VIEW}>
                  <ProductsPage />
                </ProtectedRoute>
              } />

              {/* Заказы - требуется право просмотра заказов */}
              <Route path="orders/*" element={
                <ProtectedRoute permission={PERMISSIONS.ORDERS_VIEW}>
                  <OrdersPage />
                </ProtectedRoute>
              } />

              {/* Маркетплейсы - требуется право просмотра маркетплейсов */}
              <Route path="marketplaces/*" element={
                <ProtectedRoute permission={PERMISSIONS.MARKETPLACES_VIEW}>
                  <MarketplacesPage />
                </ProtectedRoute>
              } />

              {/* Склады - требуется право просмотра складов */}
              <Route path="warehouses/*" element={
                <ProtectedRoute permission={PERMISSIONS.WAREHOUSES_VIEW}>
                  <WarehousesPage />
                </ProtectedRoute>
              } />

              {/* Поставщики - требуется право просмотра поставщиков */}
              <Route path="suppliers/*" element={
                <ProtectedRoute permission={PERMISSIONS.SUPPLIERS_VIEW}>
                  <SuppliersPage />
                </ProtectedRoute>
              } />

              {/* Пользователи - требуется право просмотра пользователей */}
              <Route path="users/*" element={
                <ProtectedRoute permission={PERMISSIONS.USERS_VIEW}>
                  <UsersPage />
                </ProtectedRoute>
              } />

              {/* Аналитика - требуется право просмотра аналитики */}
              <Route path="analytics/*" element={
                <ProtectedRoute permission={PERMISSIONS.ANALYTICS_VIEW}>
                  <AnalyticsPage />
                </ProtectedRoute>
              } />

              {/* Синхронизация - требуется право просмотра синхронизации */}
              <Route path="sync/*" element={
                <ProtectedRoute permission={PERMISSIONS.SYNC_VIEW}>
                  <SyncPage />
                </ProtectedRoute>
              } />

              {/* Настройки - требуется право просмотра настроек */}
              <Route path="settings/*" element={
                <ProtectedRoute permission={PERMISSIONS.SETTINGS_VIEW}>
                  <SettingsPage />
                </ProtectedRoute>
              } />

              {/* Маппинги - подтверждение сопоставлений */}
              <Route path="mapping" element={
                <ProtectedRoute permission={PERMISSIONS.PRODUCTS_MANAGE}>
                  <MappingDashboard />
                </ProtectedRoute>
              } />
              <Route path="mapping/intelligent" element={
                <ProtectedRoute permission={PERMISSIONS.PRODUCTS_MANAGE}>
                  <IntelligentMappingManager />
                </ProtectedRoute>
              } />

              {/* Справочники - управление категориями, брендами, атрибутами */}
              <Route path="dictionaries/*" element={
                <ProtectedRoute permission={PERMISSIONS.PRODUCTS_MANAGE}>
                  <DictionariesPage />
                </ProtectedRoute>
              } />

              {/* Интеграции - настройка RS24 и Яндекс.Маркет */}
              <Route path="integrations/*" element={
                <ProtectedRoute permission={PERMISSIONS.SETTINGS_VIEW}>
                  <IntegrationsPage />
                </ProtectedRoute>
              } />
              <Route path="integrations/rs24/wizard" element={
                <ProtectedRoute permission={PERMISSIONS.SETTINGS_VIEW}>
                  <RS24SetupWizard />
                </ProtectedRoute>
              } />
            </Route>

            {/* 404 для всех остальных маршрутов */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
      </AuthInitializer>
    </ConfigProvider>
  );
}

// ===================================================
// КОРНЕВОЙ КОМПОНЕНТ С REDUX PROVIDER
// ===================================================
function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;