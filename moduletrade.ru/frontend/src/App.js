// ===================================================
// ФАЙЛ: frontend/src/App.js
// ИСПРАВЛЕНО: Полный импорт PERMISSIONS и корректная структура
// ===================================================
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { Provider } from 'react-redux';
import { store } from './store';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Layout from './components/Layout/Layout';

// ===================================================
// СТРАНИЦЫ - ИСПРАВЛЕННЫЕ ИМПОРТЫ
// ===================================================

// Auth страницы
import Login from './pages/Auth/Login';
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

// Error страницы
import ForbiddenPage from './pages/Error/ForbiddenPage';
import NotFoundPage from './pages/Error/NotFoundPage';
import AccountSuspendedPage from './pages/Error/AccountSuspendedPage';

// ✅ ИСПРАВЛЕНО: Полный путь к константам
import { PERMISSIONS } from './utils/constants';

function App() {
  return (
    <Provider store={store}>
      <ConfigProvider locale={ruRU}>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Страница входа */}
              <Route path="/login" element={<Login />} />
              
              {/* Страница заблокированного аккаунта */}
              <Route path="/account-suspended" element={<AccountSuspendedPage />} />
              
              {/* Страница отказа в доступе */}
              <Route path="/forbidden" element={<ForbiddenPage />} />

              {/* Главная - редирект на dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Защищенные маршруты */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                {/* Dashboard - доступен всем авторизованным */}
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
    </Provider>
  );
}

export default App;