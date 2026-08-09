/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_TENCENT_MAP_KEY?: string;
  readonly VITE_FORCE_MINI_REVIEW_MODE?: string;
  readonly VITE_USE_MOCK?: string;
  readonly VITE_ENABLE_H5_TEST_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
