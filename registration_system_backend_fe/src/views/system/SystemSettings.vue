<template>
  <div class="space-y-6">
    <section class="overflow-hidden rounded-[28px] border border-base-300 bg-base-100 shadow-sm">
      <div class="relative overflow-hidden px-6 py-6 lg:px-8">
        <div
          class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_36%)]"
        ></div>
        <div class="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.32em] text-base-content/45">
              Map Control
            </p>
            <div>
              <h2 class="text-2xl font-black tracking-tight">地图服务设置</h2>
              <p class="mt-1 max-w-2xl text-sm text-base-content/65">
                统一控制活动地点搜索使用的服务商与密钥配置。默认使用腾讯地图，切换后活动创建弹窗会立即按当前服务商执行搜索。
              </p>
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div
              class="rounded-2xl border border-base-300/80 bg-base-100/80 px-4 py-3 backdrop-blur"
            >
              <p class="text-xs uppercase tracking-[0.24em] text-base-content/40">当前服务商</p>
              <p class="mt-2 text-lg font-bold">{{ currentProviderLabel }}</p>
            </div>
            <div
              class="rounded-2xl border border-base-300/80 bg-base-100/80 px-4 py-3 backdrop-blur"
            >
              <p class="text-xs uppercase tracking-[0.24em] text-base-content/40">配置状态</p>
              <p
                class="mt-2 text-lg font-bold"
                :class="providerReady ? 'text-success' : 'text-warning'"
              >
                {{ providerReady ? '已配置' : '待补全' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div v-if="loadError" class="alert alert-error">
      <span>{{ loadError }}</span>
    </div>
    <div
      v-else-if="loading"
      class="flex h-56 items-center justify-center rounded-[24px] border border-dashed border-base-300 bg-base-100"
    >
      <span class="loading loading-spinner loading-md"></span>
    </div>

    <template v-else>
      <section class="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <div class="rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-sm">
          <div class="mb-5 flex items-center justify-between">
            <div>
              <h3 class="text-lg font-bold">服务商切换</h3>
              <p class="mt-1 text-sm text-base-content/55">选择活动地点搜索的实际执行服务</p>
            </div>
            <span class="badge badge-neutral badge-outline">{{ currentProviderLabel }}</span>
          </div>

          <div class="space-y-4">
            <label
              v-for="provider in providerCards"
              :key="provider.value"
              class="flex cursor-pointer items-start gap-4 rounded-[22px] border p-4 transition-all hover:-translate-y-0.5"
              :class="
                form.selected_provider === provider.value
                  ? provider.activeClass
                  : 'border-base-300 bg-base-100'
              "
            >
              <input
                v-model="form.selected_provider"
                type="radio"
                name="selected_provider"
                class="radio radio-primary mt-1"
                :value="provider.value"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="text-base font-bold">{{ provider.label }}</p>
                  <span class="badge badge-outline badge-sm">{{ provider.short }}</span>
                </div>
                <p class="mt-1 text-sm text-base-content/60">{{ provider.description }}</p>
                <div
                  class="mt-3 flex items-center justify-between rounded-2xl bg-base-200/70 px-3 py-2 text-xs"
                >
                  <span>当前 Key</span>
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

        <div class="space-y-6">
          <section
            v-for="provider in providerCards"
            :key="`${provider.value}-panel`"
            class="rounded-[28px] border bg-base-100 p-5 shadow-sm"
            :class="
              form.selected_provider === provider.value ? provider.panelClass : 'border-base-300'
            "
          >
            <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 class="text-lg font-bold">{{ provider.label }}配置</h3>
                <p class="mt-1 text-sm text-base-content/55">{{ provider.helper }}</p>
              </div>
              <span class="badge badge-outline">{{ provider.short }}</span>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-semibold">Key</span>
                <input
                  v-model="form[provider.value].key"
                  type="text"
                  class="input input-bordered border-2 h-11"
                  :placeholder="provider.keyPlaceholder"
                />
              </label>
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-semibold">Secret</span>
                <input
                  v-model="form[provider.value].secret"
                  type="password"
                  class="input input-bordered border-2 h-11"
                  :placeholder="provider.secretPlaceholder"
                />
              </label>
              <label class="flex flex-col gap-1.5 md:col-span-2">
                <span class="text-sm font-semibold">Web Service Base URL</span>
                <input
                  v-model="form[provider.value].web_service_base_url"
                  type="text"
                  class="input input-bordered border-2 h-11"
                  :placeholder="provider.defaultBaseUrl"
                />
              </label>
            </div>
          </section>
        </div>
      </section>

      <section class="rounded-[28px] border border-base-300 bg-base-100 p-5 shadow-sm">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 class="text-lg font-bold">保存设置</h3>
            <p class="mt-1 text-sm text-base-content/55">
              保存后，活动地点搜索会按当前所选服务商与配置立即生效；无需重启前端。
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="saveMessage" class="text-sm text-success">{{ saveMessage }}</span>
            <span v-if="saveError" class="text-sm text-error">{{ saveError }}</span>
            <button
              type="button"
              class="btn btn-primary px-6"
              :disabled="saving"
              @click="handleSave"
            >
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              保存地图设置
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { getMapSettings, updateMapSettings } from '@/services/system'
import {
  createDefaultMapSettingsForm,
  normalizeMapSettingsForSubmit,
  type MapProvider,
  type MapSettingsForm,
} from './map-settings.model'

type ProviderCard = {
  value: MapProvider
  label: string
  short: string
  description: string
  helper: string
  keyPlaceholder: string
  secretPlaceholder: string
  defaultBaseUrl: string
  activeClass: string
  panelClass: string
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
    activeClass: 'border-info/50 bg-info/5 shadow-sm',
    panelClass: 'border-info/40 bg-[linear-gradient(180deg,rgba(14,165,233,0.06),transparent)]',
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
    activeClass: 'border-success/50 bg-success/5 shadow-sm',
    panelClass: 'border-success/40 bg-[linear-gradient(180deg,rgba(34,197,94,0.06),transparent)]',
  },
]

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const saveMessage = ref('')

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
    const data = await getMapSettings()
    syncForm(normalizeMapSettingsForSubmit(data))
  } catch (error: unknown) {
    loadError.value = (error as Error).message || '加载地图设置失败'
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

onMounted(loadSettings)
</script>
