// ===================================================
// ФАЙЛ: frontend/src/pages/Error/NotFoundPage.jsx
// ===================================================
import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <Result
        status="404"
        title="404"
        subTitle="Извините, страница, которую вы посещаете, не существует."
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            Вернуться на главную
          </Button>
        }
      />
    </div>
  );
};

export default NotFoundPage;