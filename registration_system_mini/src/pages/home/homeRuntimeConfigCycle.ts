import { loadMiniAppRuntimeConfig, type MiniAppRuntimeConfig } from "@/config/runtimeConfig";

export type RuntimeConfigLoader = () => Promise<MiniAppRuntimeConfig>;

export interface RuntimeConfigCycle {
  load: RuntimeConfigLoader;
  reset: () => void;
}

// createRuntimeConfigCycle 把一次请求 coalesce 在「当前周期」内：
// 多个消费者拿到同一个 promise；reset 后进入新周期，允许重新发起请求。
//
// 周期失效（stale response）语义：
// 每次请求记住发起时的 generation，settle 时若 generation 已前进（说明期间发生过
// reset），该结果视为旧周期产物，不直接传播给消费者，而是转投当前周期的 load()——
// 旧消费者最终拿到最新周期的结果。因此「B 先返回 NEW、A 后返回 OLD」时 UI 保持 NEW。
// 转投不会造成递归风暴：每多一层转发都要求发生过一次 reset；也不会把旧 promise 写回
// current（load 只在 current 为空时赋值，且赋的是发起当次的最新周期 promise）。
//
// 失败的 promise 同样只存活到下一次 reset，天然支持失败重试。
export function createRuntimeConfigCycle(loadConfig: RuntimeConfigLoader): RuntimeConfigCycle {
  let generation = 0;
  let current: Promise<MiniAppRuntimeConfig> | null = null;

  function load(): Promise<MiniAppRuntimeConfig> {
    if (current) {
      return current;
    }
    const requestGeneration = generation;
    const request = loadConfig().then(
      (config) => (requestGeneration === generation ? config : load()),
      (error: unknown) => {
        if (requestGeneration === generation) {
          throw error;
        }
        return load();
      },
    );
    current = request;
    return request;
  }

  return {
    load,
    reset() {
      generation += 1;
      current = null;
    },
  };
}

// 首页专用周期：一轮 loadPageData 内，空状态插画与新手引导共享一次 runtime config
// 请求；页面每轮加载（首次/下拉刷新/隔时回访/重进）reset 开启新周期，
// 后台换图与失败重试都能在下一轮生效。
export function createHomeRuntimeConfigCycle(): RuntimeConfigCycle {
  return createRuntimeConfigCycle(loadMiniAppRuntimeConfig);
}
