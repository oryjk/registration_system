import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardCheck,
  Coffee,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Store,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";
import { BrandMark } from "@/components/BrandMark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export interface NavItem {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
  /** 隐藏子路由（详情/编辑页）也计入该项的高亮匹配 */
  matchPrefixes?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "系统概览",
    description: "平台运行总览",
    icon: LayoutDashboard,
  },
  {
    path: "/matches",
    label: "比赛管理",
    description: "赛事与报名",
    icon: CalendarDays,
    matchPrefixes: ["/matches"],
  },
  {
    path: "/teams",
    label: "球队管理",
    description: "球队与成员",
    icon: Users,
    matchPrefixes: ["/teams"],
  },
  {
    path: "/admins",
    label: "场馆管理员",
    description: "账号与场馆",
    icon: Store,
    superAdminOnly: true,
    matchPrefixes: ["/admins"],
  },
  {
    path: "/access",
    label: "接入状态",
    description: "对端服务健康",
    icon: ShieldCheck,
    matchPrefixes: ["/access"],
  },
  {
    path: "/mini-review",
    label: "审核版本",
    description: "小程序提审记录",
    icon: ClipboardCheck,
    matchPrefixes: ["/mini-review"],
  },
  {
    path: "/tips",
    label: "打赏与建议",
    description: "用户反馈",
    icon: Coffee,
    matchPrefixes: ["/tips"],
  },
  {
    path: "/system-settings",
    label: "系统设置",
    description: "平台参数",
    icon: Settings,
    matchPrefixes: ["/system-settings"],
  },
];

export function isNavItemActive(item: NavItem, pathname: string) {
  if (item.path === "/") return pathname === "/";
  return (item.matchPrefixes ?? [item.path]).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

interface AppSidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  isSuperAdmin: boolean;
  currentPath: string;
  onMobileClose: () => void;
  onToggleCollapsed: () => void;
}

export function AppSidebar({
  collapsed,
  mobileOpen,
  isSuperAdmin,
  currentPath,
  onMobileClose,
  onToggleCollapsed,
}: AppSidebarProps) {
  const navigate = useNavigate();
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.superAdminOnly || isSuperAdmin,
  );

  return (
    <>
      <button
        aria-label="关闭导航"
        className="sidebar-mobile-backdrop"
        data-open={mobileOpen}
        onClick={onMobileClose}
        tabIndex={mobileOpen ? 0 : -1}
        type="button"
      />
      <Sidebar data-collapsed={collapsed} data-mobile-open={mobileOpen}>
        <SidebarHeader>
          <div className="sidebar-header-inner">
            <button
              aria-label="开踢管理台首页"
              className="sidebar-brand"
              onClick={() => {
                navigate("/");
                onMobileClose();
              }}
              title={collapsed ? "开踢管理台" : undefined}
              type="button"
            >
              <span className="brand-mark">
                <BrandMark className="brand-logo" />
              </span>
              <span className="sidebar-brand-title">
                <strong>开踢管理台</strong>
                <span className="sidebar-brand-subtitle">GO CONSOLE</span>
              </span>
            </button>
            {!collapsed && (
              <button
                aria-label="收起侧边栏"
                className="sidebar-collapse-toggle"
                onClick={onToggleCollapsed}
                title="收起侧边栏"
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="sidebar-collapse-toggle-icons"
                >
                  <PanelLeftClose
                    className="sidebar-collapse-toggle-icon sidebar-collapse-toggle-icon-default"
                    size={16}
                  />
                  <PanelLeftOpen
                    className="sidebar-collapse-toggle-icon sidebar-collapse-toggle-icon-hover"
                    size={16}
                  />
                </span>
              </button>
            )}
            <button
              aria-label="关闭导航"
              className="sidebar-mobile-close"
              onClick={onMobileClose}
              type="button"
            >
              <X size={17} />
            </button>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>控制台</SidebarGroupLabel>
            <SidebarMenu aria-label="主菜单" role="navigation">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <button
                      aria-current={
                        isNavItemActive(item, currentPath) ? "page" : undefined
                      }
                      className="sidebar-menu-button"
                      data-active={isNavItemActive(item, currentPath)}
                      onClick={() => {
                        navigate(item.path);
                        onMobileClose();
                      }}
                      title={collapsed ? item.label : undefined}
                      type="button"
                    >
                      <span className="sidebar-icon-slot">
                        <Icon size={16} />
                      </span>
                      <span className="sidebar-menu-label">
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </button>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </>
  );
}
