type H5UniConfig = {
  qqMapKey?: string;
};

type H5MapEnv = {
  VITE_TENCENT_MAP_KEY?: string;
};

export function applyH5TencentMapConfig(
  uniConfig: H5UniConfig,
  env: H5MapEnv,
) {
  if (uniConfig.qqMapKey) {
    return uniConfig;
  }

  const key = env.VITE_TENCENT_MAP_KEY?.trim();
  if (!key) {
    return uniConfig;
  }

  uniConfig.qqMapKey = key;
  return uniConfig;
}

export function initH5TencentMapConfig() {
  if (typeof window === "undefined") {
    return;
  }

  const runtimeConfig = ((window as typeof window & {
    __uniConfig?: H5UniConfig;
  }).__uniConfig ??= {});

  applyH5TencentMapConfig(runtimeConfig, import.meta.env);
}
