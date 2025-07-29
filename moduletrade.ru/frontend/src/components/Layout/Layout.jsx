// ===================================================
// ФАЙЛ: frontend/src/components/Layout/Layout.jsx
// ===================================================
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Layout as AntLayout, theme } from 'antd';
import Sidebar from './Sidebar';
import Header from './Header';

const { Content, Sider } = AntLayout;

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={250}
        collapsedWidth={80}
      >
        <Sidebar collapsed={collapsed} />
      </Sider>
      <AntLayout>
        <Header />
        <Content
          style={{
            margin: '16px',
            padding: '24px',
            background: colorBgContainer,
            borderRadius: '8px',
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;