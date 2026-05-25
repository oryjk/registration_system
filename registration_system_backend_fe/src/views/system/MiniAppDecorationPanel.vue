<template>
  <section class="admin-panel">
    <div class="admin-panel-header">
      <div>
        <p class="admin-eyebrow">Mini App Decoration</p>
        <h3 class="admin-section-title mt-2">小程序首页装修</h3>
        <p class="admin-section-copy max-w-2xl">
          配置首页“约球开踢”位置的卡片内容。启用多条后，小程序会在该位置轮播展示。
        </p>
      </div>
      <button type="button" class="btn btn-neutral" :disabled="disabled" @click="$emit('add')">
        新增卡片
      </button>
    </div>

    <div class="space-y-4">
      <article
        v-for="(banner, index) in banners"
        :key="index"
        class="grid gap-4 rounded-xl border border-base-300 bg-base-200/35 p-4 xl:grid-cols-[minmax(0,1fr)_260px]"
      >
        <div class="grid gap-4 md:grid-cols-2">
          <label class="admin-field">
            <span class="admin-label">主标题</span>
            <input
              v-model="banner.title"
              type="text"
              maxlength="20"
              class="input input-bordered h-10"
              placeholder="约球开踢"
              :disabled="disabled"
            />
          </label>
          <label class="admin-field">
            <span class="admin-label">按钮文字</span>
            <input
              v-model="banner.button_text"
              type="text"
              maxlength="10"
              class="input input-bordered h-10"
              placeholder="去看看"
              :disabled="disabled"
            />
          </label>
          <label class="admin-field md:col-span-2">
            <span class="admin-label">副标题</span>
            <input
              v-model="banner.subtitle"
              type="text"
              maxlength="30"
              class="input input-bordered h-10"
              placeholder="组队 · 报名 · 上场"
              :disabled="disabled"
            />
          </label>
          <label class="admin-field md:col-span-2">
            <span class="admin-label">图片地址</span>
            <div class="flex flex-col gap-2 sm:flex-row">
              <input
                v-model="banner.image_url"
                type="url"
                maxlength="512"
                class="input input-bordered h-10 flex-1"
                placeholder="https://..."
                :disabled="disabled"
              />
              <label
                class="btn btn-outline h-10"
                :class="{ 'btn-disabled': disabled || uploadingIndex === index }"
              >
                <span v-if="uploadingIndex === index" class="loading loading-spinner loading-sm"></span>
                {{ uploadingIndex === index ? '上传中' : '上传图片' }}
                <input
                  type="file"
                  class="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  :disabled="disabled || uploadingIndex === index"
                  @change="handleFileChange(index, $event)"
                />
              </label>
            </div>
            <span v-if="uploadError && uploadErrorIndex === index" class="text-xs text-error">
              {{ uploadError }}
            </span>
          </label>
          <div class="flex flex-wrap items-center gap-3 md:col-span-2">
            <label class="flex items-center gap-2 rounded-full border border-base-300 bg-base-100 px-3 py-2 text-sm">
              <input v-model="banner.enabled" type="checkbox" class="toggle toggle-success" />
              启用
            </label>
            <label class="flex items-center gap-2 rounded-full border border-base-300 bg-base-100 px-3 py-2 text-sm">
              排序
              <input
                v-model.number="banner.sort_order"
                type="number"
                class="input input-bordered h-8 w-20"
                :disabled="disabled"
              />
            </label>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="disabled || index === 0"
              @click="$emit('move', index, -1)"
            >
              上移
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="disabled || index === banners.length - 1"
              @click="$emit('move', index, 1)"
            >
              下移
            </button>
            <button
              type="button"
              class="btn btn-error btn-outline btn-sm ml-auto"
              :disabled="disabled || banners.length <= 1"
              @click="$emit('remove', index)"
            >
              删除
            </button>
          </div>
        </div>

        <div class="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm">
          <div
            class="relative flex min-h-44 flex-col justify-between overflow-hidden p-5 text-white"
            :class="banner.image_url.trim() ? 'bg-neutral' : 'bg-[#172018]'"
          >
            <img
              v-if="banner.image_url.trim()"
              :src="banner.image_url.trim()"
              alt=""
              class="absolute inset-0 h-full w-full object-cover"
            />
            <div class="absolute inset-0 bg-gradient-to-br from-black/70 via-black/35 to-black/10"></div>
            <div class="relative">
              <p class="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                首页卡片 {{ index + 1 }}
              </p>
              <h4 class="mt-3 text-2xl font-black leading-tight">
                {{ banner.title.trim() || '约球开踢' }}
              </h4>
              <p class="mt-2 text-sm font-semibold text-white/75">
                {{ banner.subtitle.trim() || '组队 · 报名 · 上场' }}
              </p>
            </div>
            <div class="relative mt-5 flex items-center justify-between">
              <span
                class="rounded-full px-3 py-1 text-xs font-bold"
                :class="banner.enabled ? 'bg-lime-300 text-neutral' : 'bg-white/20 text-white/70'"
              >
                {{ banner.enabled ? '已启用' : '已停用' }}
              </span>
              <span class="rounded-full bg-white px-4 py-2 text-sm font-black text-neutral">
                {{ banner.button_text.trim() || '去看看' }}
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { uploadMiniAppDecorationImage } from '@/services/system'
import type { MiniAppHeroBannerForm } from './mini-app-decoration.model'

const props = defineProps<{
  banners: MiniAppHeroBannerForm[]
  disabled?: boolean
}>()

defineEmits<{
  add: []
  remove: [index: number]
  move: [index: number, direction: -1 | 1]
}>()

const uploadingIndex = ref<number | null>(null)
const uploadErrorIndex = ref<number | null>(null)
const uploadError = ref('')

const handleFileChange = async (index: number, event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  uploadError.value = ''
  uploadErrorIndex.value = null
  uploadingIndex.value = index
  try {
    const result = await uploadMiniAppDecorationImage(file)
    const banner = props.banners[index]
    if (banner) {
      banner.image_url = result.image_url
    }
  } catch (error: unknown) {
    uploadErrorIndex.value = index
    uploadError.value = (error as Error).message || '上传图片失败'
  } finally {
    uploadingIndex.value = null
  }
}
</script>
