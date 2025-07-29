// ===================================================
// ФАЙЛ: frontend/src/App.js
// ===================================================
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Layout from './components/Layout/Layout';

// Страницы
import LoginPage from './pages/Auth/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ProductsPage from './pages/Products/ProductsPage';
import OrdersPage from './pages/Orders/OrdersPage';
import MarketplacesPage from './pages/Marketplaces/MarketplacesPage';
import WarehousesPage from './pages/Warehouses/WarehousesPage';
import SuppliersPage from './pages/Suppliers/SuppliersPage';
import UsersPage from './pages/Users/UsersPage';
import AnalyticsPage from './pages/Analytics/AnalyticsPage';
import SyncPage from './pages/Sync/SyncPage';
import SettingsPage from './pages/Settings/SettingsPage';
import ForbiddenPage from './pages/Error/ForbiddenPage';
import NotFoundPage from './pages/Error/NotFoundPage';
import AccountSuspendedPage from './pages/Error/AccountSuspendedPage';

// Константы для прав
import { PERMISSIONS } from './utils/constants';

function App() {
  return (
    <ConfigProvider locale={ruRU}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Публичные маршруты */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/account-suspended" element={<AccountSuspendedPage />} />

            {/* Защищенные маршруты */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              {/* Главная страница */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* Дашборд - доступен всем авторизованным */}
              <Route path="dashboard" element={<DashboardPage />} />

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

              {/* Синхронизация - требуется право синхронизации */}
              <Route path="sync" element={
                <ProtectedRoute permission={PERMISSIONS.SYNC_EXECUTE}>
                  <SyncPage />
                </ProtectedRoute>
              } />

              {/* Аналитика - требуется право просмотра аналитики */}
              <Route path="analytics/*" element={
                <ProtectedRoute permission={PERMISSIONS.ANALYTICS_VIEW}>
                  <AnalyticsPage />
                </ProtectedRoute>
              } />

              {/* Пользователи - только для админов */}
              <Route path="users/*" element={
                <ProtectedRoute adminOnly>
                  <UsersPage />
                </ProtectedRoute>
              } />

              {/* Настройки - доступны всем */}
              <Route path="settings/*" element={<SettingsPage />} />
            </Route>

            {/* 404 страница */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;