import { ref } from "vue";
import { getVenueSuggestions, type BackendVenueSuggestion, type VenueOption } from "@/api/match";

interface VenueFormFields {
  location: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
}

/** 发布表单共用的场地选择流程：常用场地懒加载（首次打开请求一次并缓存）、手动输入和地图选点。 */
export function useVenuePicker(form: VenueFormFields) {
  const visible = ref(false);
  const suggestions = ref<BackendVenueSuggestion[]>([]);
  const loading = ref(false);
  let loaded = false;

  async function loadSuggestions() {
    if (loaded || loading.value) return;
    loading.value = true;
    try {
      suggestions.value = await getVenueSuggestions(10);
      loaded = true;
    } catch {
      // 建议加载失败不阻塞选场地：弹层仍可手动输入/地图选点。
    } finally {
      loading.value = false;
    }
  }

  function open() {
    void loadSuggestions();
    visible.value = true;
  }

  function close() {
    visible.value = false;
  }

  function select(venue: VenueOption) {
    form.location = venue.location;
    form.locationLatitude = venue.latitude ?? null;
    form.locationLongitude = venue.longitude ?? null;
    close();
  }

  function manualInput(location: string) {
    form.location = location;
    form.locationLatitude = null;
    form.locationLongitude = null;
    close();
  }

  function chooseLocation() {
    close();
    uni.chooseLocation({
      success(location) {
        form.location = location.name || location.address || "";
        form.locationLatitude = location.latitude;
        form.locationLongitude = location.longitude;
      },
      fail() {
        uni.showToast({
          title: "未选择地点",
          icon: "none",
        });
      },
    });
  }

  return { visible, suggestions, loading, loadSuggestions, open, close, select, manualInput, chooseLocation };
}
