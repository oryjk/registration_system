import { LogOut, Menu, Moon, PanelLeftOpen, Sun, User } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/layout/AppSidebar";
import { activateTheme, useAdminTheme } from "@/theme";

const COMPACT_SIDEBAR_MEDIA_QUERY = "(max-width: 820px)";

interface AdminShellProps {
  title: string;
  username: string;
  isSuperAdmin: boolean;
  currentPath: string;
  onLogout: () => void;
  children: ReactNode;
}

export function AdminShell({
  title,
  username,
  isSuperAdmin,
  currentPath,
  onLogout,
  children,
}: AdminShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY).matches,
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const theme = useAdminTheme();

  useEffect(() => {
    const compactSidebar = window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY);
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      setSidebarCollapsed(event.matches);
    };

    compactSidebar.addEventListener("change", handleBreakpointChange);
    return () =>
      compactSidebar.removeEventListener("change", handleBreakpointChange);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileSidebarOpen]);

  return (
    <SidebarProvider
      className="admin-shell"
      data-sidebar-collapsed={sidebarCollapsed}
    >
      <AppSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        isSuperAdmin={isSuperAdmin}
        currentPath={currentPath}
        onMobileClose={() => setMobileSidebarOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />

      <main aria-label="工作区" className="main-workspace">
        <div className="workspace-chrome">
          <header className="workspace-header">
            <div className="workspace-title-block">
              <Button
                aria-label="打开导航"
                className="workspace-mobile-menu-button"
                onClick={() => setMobileSidebarOpen(true)}
                type="button"
                variant="outline"
              >
                <Menu size={17} />
              </Button>
              {sidebarCollapsed ? (
                <Button
                  aria-label="展开侧边栏"
                  aria-pressed={sidebarCollapsed}
                  className="workspace-sidebar-toggle-button"
                  onClick={() => setSidebarCollapsed(false)}
                  title="展开侧边栏"
                  type="button"
                  variant="ghost"
                >
                  <PanelLeftOpen size={17} />
                </Button>
              ) : null}
              <div>
                <h2>{title}</h2>
              </div>
            </div>
            <div className="workspace-header-actions">
              <Button
                aria-label={
                  theme === "dark" ? "切换到浅色主题" : "切换到暗色主题"
                }
                type="button"
                variant="outline"
                onClick={() =>
                  activateTheme(theme === "dark" ? "light" : "dark")
                }
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                <span className="workspace-header-button-label">
                  {theme === "dark" ? "浅色" : "暗色"}
                </span>
              </Button>
              <div className="workspace-user-summary" title={username}>
                <span className="workspace-user-avatar">
                  <User size={15} />
                </span>
                <strong>{username}</strong>
              </div>
              <Button type="button" variant="outline" onClick={onLogout}>
                <LogOut size={15} />
                <span className="workspace-header-button-label">退出登录</span>
              </Button>
            </div>
          </header>
        </div>

        <div className="workspace-content">{children}</div>
      </main>
    </SidebarProvider>
  );
}
