export interface TencentMapPoint {
  latitude: number
  longitude: number
}

export interface TencentLatLngLike {
  getLat?: () => number
  getLng?: () => number
  lat?: number
  lng?: number
  latitude?: number
  longitude?: number
}

export interface TencentMapInstance {
  on: (eventName: string, handler: (payload?: { latLng?: TencentLatLngLike }) => void) => void
  setCenter: (center: TencentLatLngLike) => void
  getCenter: () => TencentLatLngLike
}

export interface TencentMapConstructorOptions {
  center: TencentLatLngLike
  zoom: number
}

export interface TencentMapSdk {
  Map: new (container: HTMLElement, options: TencentMapConstructorOptions) => TencentMapInstance
  LatLng: new (latitude: number, longitude: number) => TencentLatLngLike
}

declare global {
  interface Window {
    TMap?: TencentMapSdk
  }
}

const SDK_ID = 'tencent-map-gl-sdk'
let sdkPromise: Promise<TencentMapSdk> | null = null

export const createTencentLatLng = (TMap: TencentMapSdk, point: TencentMapPoint) =>
  new TMap.LatLng(point.latitude, point.longitude)

export const extractTencentLatLng = (latLng: TencentLatLngLike | null | undefined): TencentMapPoint | null => {
  if (!latLng) return null

  const latitude =
    typeof latLng.getLat === 'function'
      ? latLng.getLat()
      : typeof latLng.lat === 'number'
        ? latLng.lat
        : typeof latLng.latitude === 'number'
          ? latLng.latitude
          : Number.NaN
  const longitude =
    typeof latLng.getLng === 'function'
      ? latLng.getLng()
      : typeof latLng.lng === 'number'
        ? latLng.lng
        : typeof latLng.longitude === 'number'
          ? latLng.longitude
          : Number.NaN

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

export const createTencentMarkerIcon = (fill = '#4F46E5') => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48" fill="none">
      <path d="M18 47C18 47 31 31.7 31 20.5C31 13.0442 25.1797 7 18 7C10.8203 7 5 13.0442 5 20.5C5 31.7 18 47 18 47Z" fill="${fill}"/>
      <circle cx="18" cy="20" r="7" fill="white"/>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const loadTencentMapSdk = async (key: string) => {
  const trimmedKey = key.trim()
  if (!trimmedKey) {
    throw new Error('腾讯地图 Key 未配置')
  }

  if (window.TMap) {
    return window.TMap
  }
  if (sdkPromise) {
    return sdkPromise
  }

  sdkPromise = new Promise<TencentMapSdk>((resolve, reject) => {
    const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.TMap) resolve(window.TMap)
        else reject(new Error('腾讯地图 SDK 加载完成但未找到全局对象'))
      })
      existing.addEventListener('error', () => {
        reject(new Error('腾讯地图 SDK 加载失败'))
      })
      return
    }

    const script = document.createElement('script')
    script.id = SDK_ID
    script.async = true
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(trimmedKey)}`
    script.onload = () => {
      if (window.TMap) resolve(window.TMap)
      else reject(new Error('腾讯地图 SDK 加载完成但未找到全局对象'))
    }
    script.onerror = () => reject(new Error('腾讯地图 SDK 加载失败'))
    document.head.appendChild(script)
  }).catch((error) => {
    sdkPromise = null
    throw error
  })

  return sdkPromise
}
