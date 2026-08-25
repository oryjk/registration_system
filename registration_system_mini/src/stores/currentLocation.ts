import { ref } from "vue";
import { fetchCurrentLocation, type CurrentLocationState } from "@/utils/location";

const currentLocation = ref<CurrentLocationState | null>(null);
const isLocationLoading = ref(false);

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
    refreshCurrentLocation,
    ensureCurrentLocation,
  };
}
