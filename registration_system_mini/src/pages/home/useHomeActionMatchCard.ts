import { onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { getMatchDetail } from "@/api/match";
import type { AppMatchDetailResponse } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";

/** 首页读取详情只补全最近要处理的比赛卡，不阻塞比赛列表；换场/离开后丢弃旧响应。 */
export function useHomeActionMatchCard(
  match: Readonly<Ref<HomeMatchCardViewModel | null>>,
  fetchDetail = getMatchDetail,
) {
  const detail = shallowRef<AppMatchDetailResponse | null>(null);
  const loading = ref(false);
  const error = ref(false);
  let version = 0;

  async function reload() {
    const requestVersion = ++version;
    const current = match.value;
    detail.value = null;
    error.value = false;
    loading.value = !!current;
    if (!current) return;
    try {
      const response = await fetchDetail(current.id);
      if (requestVersion !== version) return;
      if (response.match.id !== current.id) throw new Error("比赛详情不匹配");
      detail.value = response;
    } catch {
      if (requestVersion === version) error.value = true;
    } finally {
      if (requestVersion === version) loading.value = false;
    }
  }

  watch(match, () => { void reload(); }, { immediate: true });
  onScopeDispose(() => { version += 1; });
  return { detail, loading, error, reload };
}
