import { resolveActivityLocation } from "@/api/activity";
import { getAdminMapPreviewSettings, getMapPreviewSettings } from "@/api/system";

export interface TencentReverseGeocodeResponse {
  status: number;
  message?: string;
  result?: {
    address?: string;
    address_component?: {
      province?: string;
      city?: string;
      district?: string;
    };
  };
}

export interface ResolvedTencentLocation {
  label: string;
  city: string;
  district: string;
  address: string;
}

export interface CurrentLocationState extends ResolvedTencentLocation {
  latitude: number;
  longitude: number;
}

export function isOpenLocationSupported(platform?: string) {
  return platform !== "devtools";
}

export function buildTencentReverseGeocodeUrl(
  key: string,
  latitude: number,
  longitude: number,
) {
  return `https://apis.map.qq.com/ws/geocoder/v1/?location=${latitude},${longitude}&key=${key}&get_poi=0`;
}

export function resolveTencentLocationLabel(
  payload: TencentReverseGeocodeResponse | null | undefined,
): ResolvedTencentLocation {
  if (!payload || payload.status !== 0 || !payload.result) {
    return {
      label: "当前位置",
      city: "",
      district: "",
      address: "",
    };
  }

  const city = payload.result.address_component?.city?.trim() || "";
  const district = payload.result.address_component?.district?.trim() || "";
  const province = payload.result.address_component?.province?.trim() || "";
  const address = payload.result.address?.trim() || "";

  return {
    label: district || city || province || "当前位置",
    city,
    district,
    address,
  };
}

export function resolveBackendLocationLabel(payload: {
  title?: string | null;
  address?: string | null;
  display_name?: string | null;
}): ResolvedTencentLocation {
  const displayName = payload.display_name?.trim() || "";
  const title = payload.title?.trim() || "";
  const address = payload.address?.trim() || "";

  return {
    label: title || displayName || "当前位置",
    city: "",
    district: "",
    address: address || displayName,
  };
}

async function resolveLocationViaBackend(latitude: number, longitude: number) {
  try {
    const location = await resolveActivityLocation({ latitude, longitude });
    return resolveBackendLocationLabel(location);
  } catch (_error) {
    return null;
  }
}

async function resolveMapKeyFromBackend() {
  try {
    return (await getMapPreviewSettings()).tencent_map_key;
  } catch (_error) {
    try {
      return (await getAdminMapPreviewSettings()).tencent_map_key;
    } catch (_innerError) {
      return "";
    }
  }
}

export async function fetchCurrentLocation(
  key?: string,
): Promise<CurrentLocationState> {
  const location = await new Promise<UniApp.GetLocationSuccess>((resolve, reject) => {
    uni.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      success: resolve,
      fail: reject,
    });
  });

  const baseLocation = {
    latitude: location.latitude,
    longitude: location.longitude,
  };

  const backendResolved = await resolveLocationViaBackend(location.latitude, location.longitude);
  if (backendResolved) {
    return {
      ...baseLocation,
      ...backendResolved,
    };
  }

  const mapKey = key?.trim() || (await resolveMapKeyFromBackend());

  if (mapKey.trim()) {
    try {
      const response = await uni.request({
        url: buildTencentReverseGeocodeUrl(mapKey.trim(), location.latitude, location.longitude),
        method: "GET",
      });
      const resolved = resolveTencentLocationLabel(
        response.data as TencentReverseGeocodeResponse,
      );

      return {
        ...baseLocation,
        ...resolved,
      };
    } catch (_error) {
      return {
        ...baseLocation,
        label: "当前位置",
        city: "",
        district: "",
        address: "",
      };
    }
  }

  return {
    ...baseLocation,
    label: "当前位置",
    city: "",
    district: "",
    address: "",
  };
}
