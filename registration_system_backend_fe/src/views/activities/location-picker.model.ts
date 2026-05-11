import type { LocationSearchResult } from '@/services/activity'

export interface MapPoint {
  latitude: number
  longitude: number
}

export interface PickedLocation extends LocationSearchResult {
  isAdjusted: boolean
}

export interface AppliedLocationSelection {
  title: string
  locationLatitude: number
  locationLongitude: number
  isAdjusted: boolean
}

export const toLocationTitle = (displayName: string) => {
  const [first, second] = displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return first || second || displayName
}

export const normalizeLocationSearchResults = (
  results: LocationSearchResult[],
): LocationSearchResult[] =>
  results.map((item) => ({
    ...item,
    title: item.title?.trim() || toLocationTitle(item.display_name),
  }))

export const createPickedLocation = (result: LocationSearchResult): PickedLocation => ({
  ...result,
  isAdjusted: false,
})

export const createManualPickedLocation = (
  title: string,
  latitude: number,
  longitude: number,
): PickedLocation => ({
  provider_place_id: `manual:${latitude.toFixed(6)},${longitude.toFixed(6)}`,
  title: title.trim() || '手动定位点',
  address: title.trim() || '手动定位点',
  display_name: title.trim() || '手动定位点',
  latitude: latitude.toFixed(6),
  longitude: longitude.toFixed(6),
  isAdjusted: true,
})

export const movePickedLocation = (
  location: PickedLocation,
  point: MapPoint,
): PickedLocation => ({
  ...location,
  latitude: point.latitude.toFixed(6),
  longitude: point.longitude.toFixed(6),
  isAdjusted: true,
})

export const renamePickedLocation = (
  location: PickedLocation,
  resolved: LocationSearchResult,
): PickedLocation => ({
  ...location,
  provider_place_id: resolved.provider_place_id,
  title: resolved.title?.trim() || location.title,
  address: resolved.address?.trim() || location.address,
  display_name: resolved.display_name?.trim() || location.display_name,
})
