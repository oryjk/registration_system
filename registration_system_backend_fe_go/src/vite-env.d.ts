/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 管理端 API 基础地址；dev 走 /go-api 代理，out109 部署为外网 API base */
  readonly ADMIN_API_BASE_URL?: string;
  /** 路由 base（子路径部署前缀，如 /regist-admin-v3/） */
  readonly ADMIN_ROUTE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
