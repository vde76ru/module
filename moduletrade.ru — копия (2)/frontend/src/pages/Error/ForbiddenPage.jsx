// ===================================================
// ФАЙЛ: frontend/src/pages/Error/ForbiddenPage.jsx
// ===================================================
import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const ForbiddenPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <Result
        status="403"
        title="403"
        subTitle="Извините, у вас нет прав для доступа к этой странице."
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            Вернуться на главную
          </Button>
        }
      />
    </div>
  );
};

export default ForbiddenPage;
