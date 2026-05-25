<template>
  <div class="admin-page">
    <header class="admin-page-header">
      <div>
        <p class="admin-eyebrow">System Control</p>
        <h2 class="admin-title">系统设置</h2>
        <p class="admin-copy">
          管理活动地点搜索、小程序首页装修等基础能力。这里的配置会直接影响管理端和小程序的线上体验。
        </p>
      </div>
      <div class="grid min-w-72 grid-cols-2 gap-3">
        <div class="admin-card px-4 py-3">
          <p class="text-xs font-semibold text-base-content/45">地图服务</p>
          <p class="mt-1 text-base font-bold">{{ currentProviderLabel }}</p>
        </div>
        <div class="admin-card px-4 py-3">
          <p class="text-xs font-semibold text-base-content/45">配置状态</p>
          <p class="mt-1 text-base font-bold" :class="providerReady ? 'text-success' : 'text-warning'">
            {{ providerReady ? '已配置' : '待补全' }}
          </p>
        </div>
      </div>
    </header>

    <div v-if="loadError" class="alert alert-error rounded-xl">
      <span>{{ loadError }}</span>
    </div>
    <div v-else-if="loading" class="admin-card flex h-56 items-center justify-center">
      <span class="loading loading-spinner loading-md"></span>
    </div>

    <template v-else>
      <section class="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div class="admin-panel">
          <div class="admin-panel-header">
            <div>
              <h3 class="admin-section-title">服务商切换</h3>
              <p class="admin-section-copy">选择活动地点搜索的实际执行服务。</p>
            </div>
            <span class="admin-badge">{{ currentProviderLabel }}</span>
          </div>

          <div class="space-y-3">
            <label
              v-for="provider in providerCards"
              :key="provider.value"
              class="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors"
              :class="
                form.selected_provider === provider.value
                  ? 'border-primary/45 bg-primary/5'
                  : 'border-base-300 bg-base-100 hover:border-base-300/80 hover:bg-base-200/45'
              "
            >
              <input
                v-model="form.selected_provider"
                type="radio"
                name="selected_provider"
                class="radio radio-primary mt-0.5"
                :value="provider.value"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-bold">{{ provider.label }}</p>
                  <span class="admin-badge px-2 py-0.5">{{ provider.short }}</span>
                </div>
                <p class="mt-1 text-sm leading-6 text-base-content/60">{{ provider.description }}</p>
                <div class="mt-3 flex items-center justify-between rounded-lg bg-base-200/70 px-3 py-2 text-xs">
                  <span class="text-base-content/55">当前 Key</span>
                  <span
                    class="font-semibold"
                    :class="isProviderConfigured(provider.value) ? 'text-success' : 'text-warning'"
                  >
                    {{ isProviderConfigured(provider.value) ? '已填写' : '未填写' }}
                  </span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div class="space-y-5">
          <section
            v-for="provider in providerCards"
            :key="`${provider.value}-panel`"
            class="admin-panel"
            :class="form.selected_provider === provider.value ? 'border-primary/35' : ''"
          >
            <div class="admin-panel-header">
              <div>
                <h3 class="admin-section-title">{{ provider.label }}配置</h3>
                <p class="admin-section-copy">{{ provider.helper }}</p>
              </div>
              <span class="admin-badge">{{ provider.short }}</span>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="admin-field">
                <span class="admin-label">Key</span>
                <input
                  v-model="form[provider.value].key"
                  type="text"
                  class="input input-bordered h-10"
                  :placeholder="provider.keyPlaceholder"
                />
              </label>
              <label class="admin-field">
                <span class="admin-label">Secret</span>
                <input
                  v-model="form[provider.value].secret"
                  type="password"
                  class="input input-bordered h-10"
                  :placeholder="provider.secretPlaceholder"
                />
              </label>
              <label class="admin-field md:col-span-2">
                <span class="admin-label">Web Service Base URL</span>
                <input
                  v-model="form[provider.value].web_service_base_url"
                  type="text"
                  class="input input-bordered h-10"
                  :placeholder="provider.defaultBaseUrl"
                />
              </label>
            </div>
          </section>
        </div>
      </section>

      <section class="admin-action-bar">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 class="admin-section-title">保存地图设置</h3>
            <p class="admin-section-copy">保存后，活动地点搜索会按当前所选服务商与配置立即生效。</p>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="saveMessage" class="text-sm text-success">{{ saveMessage }}</span>
            <span v-if="saveError" class="text-sm text-error">{{ saveError }}</span>
            <button type="button" class="btn btn-primary px-6" :disabled="saving" @click="handleSave">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              保存地图设置
            </button>
          </div>
        </div>
      </section>

      <MiniAppDecorationPanel
        :banners="heroBanners"
        :disabled="runtimeSaving"
        @add="handleAddHeroBanner"
        @remove="handleRemoveHeroBanner"
        @move="handleMoveHeroBanner"
      />

      <section class="admin-action-bar">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 class="admin-section-title">保存小程序装修</h3>
            <p class="admin-section-copy">只更新首页卡片配置，其它小程序运行参数会保持当前值。</p>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="runtimeSaveMessage" class="text-sm text-success">
              {{ runtimeSaveMessage }}
            </span>
            <span v-if="runtimeSaveError" class="text-sm text-error">{{ runtimeSaveError }}</span>
            <button
              type="button"
              class="btn btn-neutral px-6"
              :disabled="runtimeSaving || !miniAppRuntimeConfig"
              @click="handleSaveMiniAppDecoration"
            >
              <span v-if="runtimeSaving" class="loading loading-spinner loading-sm"></span>
              保存小程序装修
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  getMapSettings,
  getMiniAppRuntimeConfig,
  updateMapSettings,
  updateMiniAppRuntimeConfig,
  type MiniAppRuntimeConfig,
} from '@/services/system'
import MiniAppDecorationPanel from './MiniAppDecorationPanel.vue'
import {
  createDefaultMapSettingsForm,
  normalizeMapSettingsForSubmit,
  type MapProvider,
  type MapSettingsForm,
} from './map-settings.model'
import {
  cloneHeroBannersForForm,
  createDefaultHeroBanner,
  normalizeHeroBannersForSubmit,
  type MiniAppHeroBannerForm,
} from './mini-app-decoration.model'

type ProviderCard = {
  value: MapProvider
  label: string
  short: string
  description: string
  helper: string
  keyPlaceholder: string
  secretPlaceholder: string
  defaultBaseUrl: string
}

const providerCards: ProviderCard[] = [
  {
    value: 'tencent',
    label: '腾讯地图',
    short: 'QQ Map',
    description: '适合作为默认供应商，当前系统默认优先使用腾讯地图。',
    helper: '腾讯地图 WebService 通常需要同时配置 Key 与 Secret。',
    keyPlaceholder: '填写腾讯地图 Key',
    secretPlaceholder: '填写腾讯地图 Secret',
    defaultBaseUrl: 'https://apis.map.qq.com',
  },
  {
    value: 'amap',
    label: '高德地图',
    short: 'AMap',
    description: '适合作为备用供应商，切换后地点搜索将直接走高德接口。',
    helper: '高德地图通常至少需要填写 Key，Secret 可按控制台配置补充。',
    keyPlaceholder: '填写高德地图 Key',
    secretPlaceholder: '填写高德地图 Secret（可选）',
    defaultBaseUrl: 'https://restapi.amap.com',
  },
]

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const saveMessage = ref('')
const runtimeSaving = ref(false)
const runtimeSaveError = ref('')
const runtimeSaveMessage = ref('')
const miniAppRuntimeConfig = ref<MiniAppRuntimeConfig | null>(null)
const heroBanners = ref<MiniAppHeroBannerForm[]>([])

const form = reactive<MapSettingsForm>(createDefaultMapSettingsForm())

const syncForm = (value: MapSettingsForm) => {
  form.selected_provider = value.selected_provider
  form.tencent.key = value.tencent.key
  form.tencent.secret = value.tencent.secret
  form.tencent.web_service_base_url = value.tencent.web_service_base_url
  form.amap.key = value.amap.key
  form.amap.secret = value.amap.secret
  form.amap.web_service_base_url = value.amap.web_service_base_url
}

const providerLabelMap: Record<MapProvider, string> = {
  tencent: '腾讯地图',
  amap: '高德地图',
}

const currentProviderLabel = computed(() => providerLabelMap[form.selected_provider])
const providerReady = computed(() => isProviderConfigured(form.selected_provider))

const isProviderConfigured = (provider: MapProvider) => {
  if (provider === 'tencent') {
    return Boolean(form.tencent.key.trim() && form.tencent.secret.trim())
  }
  return Boolean(form.amap.key.trim())
}

const loadSettings = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [mapSettings, runtimeConfig] = await Promise.all([
      getMapSettings(),
      getMiniAppRuntimeConfig(),
    ])
    syncForm(normalizeMapSettingsForSubmit(mapSettings))
    miniAppRuntimeConfig.value = runtimeConfig
    heroBanners.value = cloneHeroBannersForForm(runtimeConfig.home.hero_banners)
  } catch (error: unknown) {
    loadError.value = (error as Error).message || '加载系统设置失败'
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  saveError.value = ''
  saveMessage.value = ''
  try {
    const payload = normalizeMapSettingsForSubmit(structuredClone(form))
    const data = await updateMapSettings(payload)
    syncForm(data)
    saveMessage.value = '地图设置已保存'
  } catch (error: unknown) {
    saveError.value = (error as Error).message || '保存地图设置失败'
  } finally {
    saving.value = false
  }
}

const handleAddHeroBanner = () => {
  heroBanners.value.push(createDefaultHeroBanner(heroBanners.value.length + 1))
}

const handleRemoveHeroBanner = (index: number) => {
  if (heroBanners.value.length <= 1) return
  heroBanners.value.splice(index, 1)
}

const handleMoveHeroBanner = (index: number, direction: -1 | 1) => {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= heroBanners.value.length) return
  const [item] = heroBanners.value.splice(index, 1)
  if (!item) return
  heroBanners.value.splice(targetIndex, 0, item)
  heroBanners.value.forEach((banner, bannerIndex) => {
    banner.sort_order = bannerIndex + 1
  })
}

const handleSaveMiniAppDecoration = async () => {
  if (!miniAppRuntimeConfig.value) return
  runtimeSaving.value = true
  runtimeSaveError.value = ''
  runtimeSaveMessage.value = ''
  try {
    const normalizedBanners = normalizeHeroBannersForSubmit(heroBanners.value)
    const payload: MiniAppRuntimeConfig = {
      ...miniAppRuntimeConfig.value,
      home: {
        ...miniAppRuntimeConfig.value.home,
        hero_banners: normalizedBanners,
      },
    }
    const data = await updateMiniAppRuntimeConfig(payload)
    miniAppRuntimeConfig.value = data
    heroBanners.value = cloneHeroBannersForForm(data.home.hero_banners)
    runtimeSaveMessage.value = '小程序装修已保存'
  } catch (error: unknown) {
    runtimeSaveError.value = (error as Error).message || '保存小程序装修失败'
  } finally {
    runtimeSaving.value = false
  }
}

onMounted(loadSettings)
</script>
