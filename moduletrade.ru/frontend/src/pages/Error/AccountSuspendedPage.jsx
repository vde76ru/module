// ===================================================
// ФАЙЛ: frontend/src/pages/Error/AccountSuspendedPage.jsx
// ОБНОВЛЕНО: Использует новый useAuth из Redux
// ===================================================
import React from 'react';
import { Result, Button, Space } from 'antd';
import { useAuth } from '../../hooks/useAuth';

const AccountSuspendedPage = () => {
  const { logout } = useAuth();

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <Result
        status="warning"
        title="Аккаунт заблокирован"
        subTitle="Ваш аккаунт был временно заблокирован. Обратитесь к администратору для разблокировки."
        extra={
          <Space>
            <Button type="primary" onClick={logout}>
              Выйти из системы
            </Button>
            <Button onClick={() => window.location.href = 'mailto:support@moduletrade.ru'}>
              Связаться с поддержкой
            </Button>
          </Space>
        }
      />
    </div>
  );
};

export default AccountSuspendedPage;