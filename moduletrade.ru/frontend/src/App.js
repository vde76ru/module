// frontend/src/App.js
// --- Финальная, проработанная версия с профессиональной маршрутизацией ---

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';

import { store } from 'store';
import ProtectedRoute from 'components/Auth/ProtectedRoute';
import Layout from 'components/Layout/Layout';
import Login from 'pages/Auth/Login';
import Dashboard from 'pages/Dashboard/Dashboard';
import ProductsPage from 'pages/Products/ProductsPage';
import ProductDetailsPage from 'pages/Products/ProductDetailsPage';
import WarehousesPage from 'pages/Warehouses/WarehousesPage';
import SyncPage from 'pages/Sync/SyncPage';
import AnalyticsPage from 'pages/Analytics/AnalyticsPage';
import OrderList from 'pages/OrderList';
import OrderDetails from 'pages/OrderDetails';
import Register from 'pages/Auth/Register';

import './App.css';

function App() {
  return (
    // Оборачиваем все приложение в Provider, чтобы Redux был доступен везде
    <Provider store={store}>
      {/* Подключаем русскую локализацию для компонентов Ant Design */}
      <ConfigProvider locale={ruRU}>
        <Router>
          <Routes>
            {/* --- Публичный маршрут --- */}
            {/* Страница входа доступна всем */}
            <Route path="/login" element={<Login />} />

            {/* --- Защищенные маршруты --- */}
            {/* Все остальные пути (/*) ведут на защищенную часть приложения */}
            <Route
              path="/*"
              element={
                // ProtectedRoute проверяет, авторизован ли пользователь.
                // Если нет, он перенаправит на /login.
                <ProtectedRoute>
                  {/* Layout - это общий шаблон для всех внутренних страниц */}
                  <Layout>
                    {/* Внутри Layout находится вложенная маршрутизация */}
                    <Routes>
                      {/* При заходе на корень сайта, перенаправляем на /dashboard */}
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />

                      {/* Товары */}
                      <Route path="/products" element={<ProductsPage />} />
                      <Route path="/products/:id" element={<ProductDetailsPage />} />

                      {/* Склады */}
                      <Route path="/warehouses" element={<WarehousesPage />} />

                      {/* Заказы */}
                      <Route path="/orders" element={<OrderList />} />
                      <Route path="/orders/:orderId" element={<OrderDetails />} />

                      {/* Синхронизация */}
                      <Route path="/sync" element={<SyncPage />} />

                      {/* Аналитика */}
                      <Route path="/analytics" element={<AnalyticsPage />} />

                      {/* Регистрация */}
                      <Route path="/register" element={<Register />} />

                      {/* Настройки (раскомментируйте, когда страница будет создана) */}
                      {/* <Route path="/settings" element={<SettingsPage />} /> */}

                      {/* Если страница не найдена, перенаправляем на /dashboard */}
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </ConfigProvider>
    </Provider>
  );
}

export default App;
