/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 管理端默认 API 基础地址 */
  readonly ADMIN_API_BASE_URL?: string;
  readonly ADMIN_API_SERVER_LABEL?: string;
  /** 配置备用 API 基础地址后，登录页显示服务器选择 */
  readonly ADMIN_API_ALTERNATE_BASE_URL?: string;
  readonly ADMIN_API_ALTERNATE_SERVER_LABEL?: string;
  /** 路由 base（子路径部署前缀，如 /regist-admin-v3/） */
  readonly ADMIN_ROUTE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
