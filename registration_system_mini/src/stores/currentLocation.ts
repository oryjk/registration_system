import { computed, ref } from "vue";
import { fetchCurrentLocation, type CurrentLocationState } from "@/utils/location";

const currentLocation = ref<CurrentLocationState | null>(null);
const isLocationLoading = ref(false);

const locationLabel = computed(() => {
  if (currentLocation.value?.label) {
    return currentLocation.value.label;
  }

  return isLocationLoading.value ? "定位中" : "点击定位";
});

const locationAddress = computed(
  () => currentLocation.value?.address || "点击定位后查看当前位置",
);

const locationMarkers = computed(() => {
  if (!currentLocation.value) {
    return [];
  }

  return [
    {
      id: 1,
      latitude: currentLocation.value.latitude,
      longitude: currentLocation.value.longitude,
      width: 28,
      height: 36,
      callout: {
        content: currentLocation.value.label,
        color: "#111111",
        fontSize: 12,
        borderRadius: 18,
        borderWidth: 0,
        bgColor: "#c8ff00",
        padding: 8,
        display: "ALWAYS",
      },
    },
  ];
});

export async function refreshCurrentLocation() {
  if (isLocationLoading.value) {
    return currentLocation.value;
  }

  isLocationLoading.value = true;
  try {
    currentLocation.value = await fetchCurrentLocation(import.meta.env.VITE_TENCENT_MAP_KEY);
    return currentLocation.value;
  } finally {
    isLocationLoading.value = false;
  }
}

export async function ensureCurrentLocation() {
  if (currentLocation.value) {
    return currentLocation.value;
  }

  return refreshCurrentLocation();
}

export function useCurrentLocation() {
  return {
    currentLocation,
    isLocationLoading,
    locationLabel,
    locationAddress,
    locationMarkers,
    refreshCurrentLocation,
    ensureCurrentLocation,
  };
}
