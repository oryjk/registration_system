
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
