import React from 'react';
import { Result, Button, Typography, Alert, Card, Space } from 'antd';
import {
  BugOutlined,
  ReloadOutlined,
  HomeOutlined,
  WarningOutlined
} from '@ant-design/icons';

const { Paragraph, Text } = Typography;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorId = 'ERR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    this.setState({
      error,
      errorInfo,
      errorId
    });

    // Логирование ошибки (в реальном приложении отправляем на сервер)
    this.logError(error, errorInfo, errorId);
  }

  logError = (error, errorInfo, errorId) => {
    const errorData = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId() // Получаем ID пользователя из контекста
    };

    // В реальном приложении отправляем на сервер
    console.error('Error logged:', errorData);

    // Можно отправить на сервер логирования
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorData)
    // });
  };

  getUserId = () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId || 'anonymous';
      }
    } catch (e) {
      return 'anonymous';
    }
    return 'anonymous';
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  reportBug = () => {
    const { error, errorInfo, errorId } = this.state;

    const bugReport = {
      id: errorId,
      error: error?.message,
      stack: error?.stack,
      component: errorInfo?.componentStack,
      timestamp: new Date().toISOString()
    };

    // Открыть форму отправки бага или скопировать в буфер
    navigator.clipboard?.writeText(JSON.stringify(bugReport, null, 2));

    // Можно открыть модальное окно или перейти к форме отправки багов
    console.log('Bug report copied to clipboard:', bugReport);
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorId } = this.state;
      const { fallback, level = 'page' } = this.props;

      // Если передан кастомный fallback компонент
      if (fallback) {
        return fallback(error, errorInfo, this.handleRetry);
      }

      // Разные уровни отображения ошибок
      if (level === 'inline') {
        return (
          <Alert
            message="Ошибка компонента"
            description="Произошла ошибка при загрузке этого компонента"
            type="error"
            showIcon
            action={
              <Button size="small" onClick={this.handleRetry}>
                Повторить
              </Button>
            }
            style={{ margin: '16px 0' }}
          />
        );
      }

      if (level === 'section') {
        return (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <WarningOutlined style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }} />
            <Typography.Title level={4}>Что-то пошло не так</Typography.Title>
            <Paragraph type="secondary">
              Произошла ошибка в этой части приложения
            </Paragraph>
            <Space>
              <Button onClick={this.handleRetry}>
                Повторить попытку
              </Button>
              <Button type="primary" onClick={this.handleReload}>
                Обновить страницу
              </Button>
            </Space>
          </div>
        );
      }

      // Полноэкранная ошибка (по умолчанию)
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          padding: '24px'
        }}>
          <Card style={{ maxWidth: '600px', width: '100%' }}>
            <Result
              status="error"
              title="Упс! Что-то пошло не так"
              subTitle={
                <div>
                  <Paragraph>
                    Произошла непредвиденная ошибка. Наша команда уже уведомлена об этой проблеме.
                  </Paragraph>
                  {errorId && (
                    <Paragraph>
                      <Text strong>ID ошибки:</Text> <Text code>{errorId}</Text>
                    </Paragraph>
                  )}
                </div>
              }
              extra={
                <Space direction="vertical" size="middle">
                  <Space>
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={this.handleReload}
                    >
                      Обновить страницу
                    </Button>
                    <Button
                      icon={<HomeOutlined />}
                      onClick={this.handleGoHome}
                    >
                      На главную
                    </Button>
                    <Button
                      onClick={this.handleRetry}
                    >
                      Повторить попытку
                    </Button>
                  </Space>

                  <Button
                    type="link"
                    icon={<BugOutlined />}
                    onClick={this.reportBug}
                    size="small"
                  >
                    Сообщить об ошибке
                  </Button>
                </Space>
              }
            />

            {process.env.NODE_ENV === 'development' && error && (
              <Card
                title="Детали ошибки (только в режиме разработки)"
                size="small"
                style={{ marginTop: '16px' }}
              >
                <Paragraph>
                  <Text strong>Ошибка:</Text>
                  <br />
                  <Text code>{error.message}</Text>
                </Paragraph>

                {error.stack && (
                  <Paragraph>
                    <Text strong>Stack trace:</Text>
                    <br />
                    <Text code style={{ whiteSpace: 'pre-wrap', fontSize: '11px' }}>
                      {error.stack}
                    </Text>
                  </Paragraph>
                )}

                {errorInfo && errorInfo.componentStack && (
                  <Paragraph>
                    <Text strong>Component stack:</Text>
                    <br />
                    <Text code style={{ whiteSpace: 'pre-wrap', fontSize: '11px' }}>
                      {errorInfo.componentStack}
                    </Text>
                  </Paragraph>
                )}
              </Card>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC для обертывания компонентов
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

// Хук для ручного вызова ошибки
export const useErrorHandler = () => {
  return (error, errorInfo) => {
    throw new Error(error);
  };
};

export default ErrorBoundary;