import DashboardOutlined from "@ant-design/icons/es/icons/DashboardOutlined";
import CalendarOutlined from "@ant-design/icons/es/icons/CalendarOutlined";
import LogoutOutlined from "@ant-design/icons/es/icons/LogoutOutlined";
import MenuFoldOutlined from "@ant-design/icons/es/icons/MenuFoldOutlined";
import MenuUnfoldOutlined from "@ant-design/icons/es/icons/MenuUnfoldOutlined";
import SafetyCertificateOutlined from "@ant-design/icons/es/icons/SafetyCertificateOutlined";
import ShopOutlined from "@ant-design/icons/es/icons/ShopOutlined";
import TeamOutlined from "@ant-design/icons/es/icons/TeamOutlined";
import Button from "antd/es/button";
import Drawer from "antd/es/drawer";
import Grid from "antd/es/grid";
import Layout from "antd/es/layout";
import Menu from "antd/es/menu";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

function Brand() {
  return (
    <div className="brand-lockup">
      <div className="brand-symbol">KT</div>
      <div className="brand-copy">
        <strong>开踢管理台</strong>
        <span>GO CONSOLE</span>
      </div>
    </div>
  );
}

export function AppShell() {
  const screens = Grid.useBreakpoint();
  const desktop = screens.lg ?? false;
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { admin, logout } = useAuth();
  const selectedMenuKey = location.pathname.startsWith("/matches") ? "/matches" : location.pathname.startsWith("/teams") ? "/teams" : location.pathname.startsWith("/admins") ? "/admins" : location.pathname;
  const menuItems = [
    { key: "/", icon: <DashboardOutlined />, label: <NavLink to="/">系统概览</NavLink> },
    { key: "/matches", icon: <CalendarOutlined />, label: <NavLink to="/matches">比赛管理</NavLink> },
    { key: "/teams", icon: <TeamOutlined />, label: <NavLink to="/teams">球队管理</NavLink> },
    ...(admin?.is_super_admin ? [{ key: "/admins", icon: <ShopOutlined />, label: <NavLink to="/admins">场馆管理员</NavLink> }] : []),
    { key: "/access", icon: <SafetyCertificateOutlined />, label: <NavLink to="/access">接入状态</NavLink> },
  ];

  const menu = (
    <Menu
      mode="inline"
      theme="dark"
      selectedKeys={[selectedMenuKey]}
      items={menuItems}
      onClick={() => setDrawerOpen(false)}
    />
  );

  return (
    <Layout className="app-layout">
      {desktop ? (
        <Sider className="app-sider" width={232} collapsedWidth={76} collapsed={collapsed}>
          <Brand />
          <nav aria-label="主导航">{menu}</nav>
          <Text className="sider-version">v0.1 · GO</Text>
        </Sider>
      ) : null}

      <Drawer
        placement="left"
        width={252}
        open={!desktop && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0, background: "#18211c" }, header: { display: "none" } }}
      >
        <div className="drawer-brand"><Brand /></div>
        {menu}
      </Drawer>

      <Layout>
        <Header className="app-header">
          <div className="header-leading">
            <Tooltip title={desktop ? (collapsed ? "展开导航" : "收起导航") : "打开导航"}>
              <Button
                type="text"
                shape="circle"
                icon={desktop ? (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />) : <MenuUnfoldOutlined />}
                aria-label={desktop ? "切换导航" : "打开导航"}
                onClick={() => (desktop ? setCollapsed((value) => !value) : setDrawerOpen(true))}
              />
            </Tooltip>
            <div>
              <Title level={4}>Go 服务工作台</Title>
              <Text type="secondary">赛事报名与球队管理</Text>
            </div>
          </div>
          <div className="header-actions">
            <div className="header-environment">
              <span className="environment-dot" />
              <Text>{admin?.username}</Text>
            </div>
            <Tooltip title="退出登录">
              <Button type="text" shape="circle" icon={<LogoutOutlined />} aria-label="退出登录" onClick={logout} />
            </Tooltip>
          </div>
        </Header>
        <Content className="app-content"><Outlet /></Content>
      </Layout>
    </Layout>
  );
}
