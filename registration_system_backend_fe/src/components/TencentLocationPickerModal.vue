<template>
  <dialog ref="dialogRef" class="modal" @close="handleDialogClose">
    <div class="modal-box max-w-5xl p-0">
      <div class="border-b border-base-200 px-6 py-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-xl font-bold">腾讯地图选择地点</h3>
            <p class="mt-1 text-sm text-base-content/60">
              搜索后可直接选点；如果定位点不准确，可以拖动地图或点击地图重新落点。
            </p>
          </div>
          <span class="badge badge-outline gap-1.5">
            <span class="h-2 w-2 rounded-full bg-success"></span>
            腾讯地图
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-5 px-6 py-6">
        <div class="flex flex-col gap-3 lg:flex-row">
          <label class="flex-1">
            <span class="sr-only">地点关键词</span>
            <input
              v-model="keyword"
              type="text"
              class="input input-bordered h-12 w-full"
              placeholder="输入场馆、小区、商圈或道路名"
              @keydown.enter.prevent="searchLocations"
            />
          </label>
          <button
            type="button"
            class="btn btn-primary h-12 px-5"
            :disabled="searching"
            @click="searchLocations"
          >
            <span v-if="searching" class="loading loading-spinner loading-xs"></span>
            搜索地点
          </button>
        </div>

        <div v-if="searchError" class="alert alert-error py-2 text-sm">{{ searchError }}</div>

        <div class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <section class="rounded-3xl border border-base-300 bg-base-100 p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold">搜索结果</p>
                <p class="text-xs text-base-content/50">点击结果后会在右侧腾讯地图中定位</p>
              </div>
              <p v-if="results.length" class="text-xs text-base-content/50">
                共 {{ results.length }} 条
              </p>
            </div>

            <div v-if="results.length" class="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
              <button
                v-for="result in results"
                :key="result.provider_place_id"
                type="button"
                class="rounded-2xl border px-4 py-3 text-left transition hover:border-primary/40 hover:bg-base-200"
                :class="
                  selectedLocation?.provider_place_id === result.provider_place_id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-base-300'
                "
                @click="selectLocation(result)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold">{{ result.title }}</p>
                    <p class="mt-1 text-xs leading-5 text-base-content/60">
                      {{ result.display_name }}
                    </p>
                  </div>
                  <span
                    class="badge badge-sm"
                    :class="
                      selectedLocation?.provider_place_id === result.provider_place_id
                        ? 'badge-primary'
                        : 'badge-ghost'
                    "
                  >
                    {{ selectedLocation?.provider_place_id === result.provider_place_id ? '当前' : '候选' }}
                  </span>
                </div>
              </button>
            </div>

            <div
              v-else
              class="flex h-72 items-center justify-center rounded-2xl border border-dashed border-base-300 text-sm text-base-content/40"
            >
              输入关键词后搜索地点
            </div>
          </section>

          <section class="rounded-3xl border border-base-300 bg-base-100 p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold">地图预览</p>
                <p class="text-xs text-base-content/50">拖动地图或点击地图重新选择精确位置</p>
              </div>
              <span
                v-if="selectedLocation"
                class="badge badge-sm"
                :class="selectedLocation.isAdjusted ? 'badge-warning' : 'badge-outline'"
              >
                {{ selectedLocation.isAdjusted ? '已手动调整' : '搜索原始点位' }}
              </span>
            </div>

            <div
              v-if="mapError"
              class="flex h-[25rem] items-center justify-center rounded-2xl border border-error/30 bg-error/5 px-4 text-sm text-error"
            >
              {{ mapError }}
            </div>

            <div
              v-else-if="!selectedLocation"
              class="flex h-[25rem] items-center justify-center rounded-2xl border border-dashed border-base-300 text-sm text-base-content/40"
            >
              选择一个搜索结果后查看腾讯地图
            </div>

            <div v-else class="flex flex-col gap-3">
              <div class="relative overflow-hidden rounded-2xl border border-base-300 bg-base-200">
                <div ref="mapContainerRef" class="h-[25rem] w-full"></div>
                <div
                  v-if="selectedLocation"
                  data-testid="map-center-pin"
                  class="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full"
                >
                  <div class="drop-shadow-[0_12px_20px_rgba(79,70,229,0.3)]">
                    <svg
                      width="36"
                      height="48"
                      viewBox="0 0 36 48"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M18 47C18 47 31 31.7 31 20.5C31 13.0442 25.1797 7 18 7C10.8203 7 5 13.0442 5 20.5C5 31.7 18 47 18 47Z"
                        fill="#4F46E5"
                      />
                      <circle cx="18" cy="20" r="7" fill="white" />
                    </svg>
                  </div>
                </div>
                <div
                  v-if="mapLoading"
                  class="absolute inset-0 flex items-center justify-center bg-base-100/75 backdrop-blur-sm"
                >
                  <span class="loading loading-spinner loading-md text-primary"></span>
                </div>
              </div>

              <div class="rounded-2xl bg-base-200/70 px-4 py-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold">{{ selectedLocation.title }}</p>
                    <p class="mt-1 text-xs leading-5 text-base-content/60">
                      {{ selectedLocation.display_name }}
                    </p>
                  </div>
                  <div class="text-right text-xs text-base-content/55">
                    <p v-if="resolvingLocationName" class="text-primary">正在更新地点名...</p>
                    <p>纬度 {{ selectedLocation.latitude }}</p>
                    <p>经度 {{ selectedLocation.longitude }}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 border-t border-base-200 px-6 py-4">
        <button type="button" class="btn btn-ghost" @click="closeDialog">取消</button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!selectedLocation"
          @click="applySelection"
        >
          使用该地点
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import {
  resolveActivityLocation,
  searchActivityLocations,
  type LocationSearchResult,
} from '@/services/activity'
import { getMapPreviewSettings } from '@/services/system'
import {
  createManualPickedLocation,
  createPickedLocation,
  movePickedLocation,
  normalizeLocationSearchResults,
  renamePickedLocation,
  type AppliedLocationSelection,
  type PickedLocation,
} from '@/views/activities/location-picker.model'
import {
  createTencentLatLng,
  extractTencentLatLng,
  loadTencentMapSdk,
  type TencentLatLngLike,
  type TencentMapInstance,
} from '@/utils/tencent-map'

const props = defineProps<{
  open: boolean
  locationTitle?: string
  locationLatitude?: number | null
  locationLongitude?: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  apply: [value: AppliedLocationSelection]
}>()

const dialogRef = ref<HTMLDialogElement>()
const mapContainerRef = ref<HTMLDivElement>()
const keyword = ref('')
const searching = ref(false)
const searchError = ref('')
const results = ref<LocationSearchResult[]>([])
const selectedLocation = ref<PickedLocation | null>(null)
const mapLoading = ref(false)
const mapError = ref('')
const previewKey = ref('')
const mapInstance = ref<TencentMapInstance | null>(null)
const resolvingLocationName = ref(false)
let resolveRequestId = 0

const hasSavedCoordinates = computed(
  () => props.locationLatitude != null && props.locationLongitude != null,
)

const syncSelectionFromProps = () => {
  keyword.value = props.locationTitle?.trim() || ''
  searchError.value = ''
  results.value = []
  mapError.value = ''
  resolvingLocationName.value = false
  selectedLocation.value = hasSavedCoordinates.value
    ? createManualPickedLocation(
        props.locationTitle || '已保存地点',
        props.locationLatitude ?? 0,
        props.locationLongitude ?? 0,
      )
    : null
}

const ensurePreviewKey = async () => {
  if (previewKey.value) return previewKey.value
  const preview = await getMapPreviewSettings()
  previewKey.value = preview.tencent_map_key.trim()
  if (!previewKey.value) {
    throw new Error('系统未配置腾讯地图 Key，无法显示地图预览')
  }
  return previewKey.value
}

const syncMapCenter = (location: PickedLocation) => {
  if (!mapInstance.value || !window.TMap) return
  const point = createTencentLatLng(window.TMap, {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  })
  mapInstance.value.setCenter(point)
}

const updateLocationFromLatLng = (latLng: TencentLatLngLike | null | undefined) => {
  const point = extractTencentLatLng(latLng)
  if (!point || !selectedLocation.value) return
  selectedLocation.value = movePickedLocation(selectedLocation.value, point)
  void syncLocationNameFromPoint(point.latitude, point.longitude)
}

const syncLocationNameFromPoint = async (latitude: number, longitude: number) => {
  const currentLocation = selectedLocation.value
  if (!currentLocation) return

  const requestId = ++resolveRequestId
  resolvingLocationName.value = true
  try {
    const resolved = await resolveActivityLocation(latitude, longitude)
    if (requestId !== resolveRequestId || !selectedLocation.value) return

    selectedLocation.value = renamePickedLocation(selectedLocation.value, {
      ...resolved,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    })
  } catch {
    if (requestId !== resolveRequestId) return
  } finally {
    if (requestId === resolveRequestId) {
      resolvingLocationName.value = false
    }
  }
}

const bindMapEvents = () => {
  if (!mapInstance.value) return
  const map = mapInstance.value

  map.on('click', (event?: { latLng?: TencentLatLngLike }) => {
    if (event?.latLng) {
      map.setCenter(event.latLng)
      updateLocationFromLatLng(event.latLng)
    }
  })
  map.on('dragend', () => {
    updateLocationFromLatLng(map.getCenter())
  })
}

const ensureMap = async () => {
  if (!props.open || !selectedLocation.value) return

  mapLoading.value = true
  mapError.value = ''
  try {
    const key = await ensurePreviewKey()
    const TMap = await loadTencentMapSdk(key)
    if (!TMap) {
      throw new Error('腾讯地图 SDK 未正确加载')
    }
    await nextTick()

    if (!mapContainerRef.value) return
    if (!mapInstance.value) {
      const center = createTencentLatLng(TMap, {
        latitude: Number(selectedLocation.value.latitude),
        longitude: Number(selectedLocation.value.longitude),
      })
      mapInstance.value = new TMap.Map(mapContainerRef.value, {
        center,
        zoom: 16,
      })
      bindMapEvents()
    }

    syncMapCenter(selectedLocation.value)
  } catch (error: unknown) {
    mapError.value = (error as Error).message || '腾讯地图加载失败'
  } finally {
    mapLoading.value = false
  }
}

const selectLocation = (result: LocationSearchResult) => {
  resolveRequestId += 1
  resolvingLocationName.value = false
  selectedLocation.value = createPickedLocation(result)
}

const searchLocations = async () => {
  const normalizedKeyword = keyword.value.trim()
  if (!normalizedKeyword) {
    searchError.value = '请输入地点关键词'
    results.value = []
    selectedLocation.value = hasSavedCoordinates.value
      ? selectedLocation.value
      : null
    return
  }

  searching.value = true
  searchError.value = ''
  resolveRequestId += 1
  resolvingLocationName.value = false
  try {
    const data = await searchActivityLocations(normalizedKeyword, 8)
    results.value = normalizeLocationSearchResults(data)
    selectedLocation.value = results.value[0] ? createPickedLocation(results.value[0]) : null
    if (!results.value.length) {
      searchError.value = '未找到匹配地点，请换个关键词或直接在地图上点击微调'
    }
  } catch (error: unknown) {
    searchError.value = (error as Error).message || '地图搜索失败，请稍后重试'
    results.value = []
    selectedLocation.value = null
  } finally {
    searching.value = false
  }
}

const closeDialog = () => {
  dialogRef.value?.close()
}

const handleDialogClose = () => {
  emit('update:open', false)
}

const applySelection = () => {
  if (!selectedLocation.value) return
  emit('apply', {
    title: selectedLocation.value.title,
    locationLatitude: Number(selectedLocation.value.latitude),
    locationLongitude: Number(selectedLocation.value.longitude),
    isAdjusted: selectedLocation.value.isAdjusted,
  })
  closeDialog()
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      syncSelectionFromProps()
      await nextTick()
      dialogRef.value?.showModal()
      await ensureMap()
      return
    }

    if (dialogRef.value?.open) {
      dialogRef.value.close()
    }
  },
)

watch(
  selectedLocation,
  async (location) => {
    if (!props.open || !location) return
    await ensureMap()
  },
  { deep: true },
)
</script>
