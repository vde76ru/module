import React from 'react';
import { Spin, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const { Text } = Typography;

const LoadingSpinner = ({ 
  size = 'default', 
  tip = 'Загрузка...', 
  spinning = true, 
  children,
  style = {},
  overlay = false,
  className = ''
}) => {
  const antIcon = <LoadingOutlined style={{ fontSize: getIconSize(size) }} spin />;

  function getIconSize(size) {
    switch (size) {
      case 'small': return 16;
      case 'large': return 32;
      case 'xl': return 48;
      default: return 24;
    }
  }

  const spinnerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: size === 'large' || size === 'xl' ? '200px' : '100px',
    ...style
  };

  if (overlay) {
    return (
      <div style={{ position: 'relative' }}>
        {children}
        {spinning && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 1000
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <Spin indicator={antIcon} />
              {tip && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">{tip}</Text>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (children) {
    return (
      <Spin spinning={spinning} indicator={antIcon} tip={tip} className={className}>
        {children}
      </Spin>
    );
  }

  return (
    <div style={spinnerStyle} className={className}>
      <Spin indicator={antIcon} />
      {tip && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">{tip}</Text>
        </div>
      )}
    </div>
  );
};

// Предустановленные варианты спиннеров
LoadingSpinner.Page = ({ tip = 'Загружается страница...' }) => (
  <LoadingSpinner
    size="large"
    tip={tip}
    style={{
      minHeight: '50vh',
      backgroundColor: '#fafafa'
    }}
  />
);

LoadingSpinner.Content = ({ tip = 'Загрузка контента...' }) => (
  <LoadingSpinner
    size="default"
    tip={tip}
    style={{
      minHeight: '200px',
      padding: '40px'
    }}
  />
);

LoadingSpinner.Inline = ({ tip = 'Загрузка...' }) => (
  <LoadingSpinner
    size="small"
    tip={tip}
    style={{
      minHeight: 'auto',
      padding: '20px',
      display: 'inline-flex',
      flexDirection: 'row'
    }}
  />
);

LoadingSpinner.Table = ({ tip = 'Загрузка данных...' }) => (
  <div style={{ 
    textAlign: 'center', 
    padding: '50px 0',
    color: '#999'
  }}>
    <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
    <div style={{ marginTop: 12 }}>
      <Text type="secondary">{tip}</Text>
    </div>
  </div>
);

LoadingSpinner.Button = ({ loading = false, children, ...props }) => (
  <Spin spinning={loading} indicator={<LoadingOutlined />}>
    {children}
  </Spin>
);

export default LoadingSpinner;