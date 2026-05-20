<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box max-w-2xl">
      <h3 class="text-lg font-bold mb-4">编辑活动</h3>
      <div v-if="editError" class="alert alert-error py-2.5 mb-4 text-sm">{{ editError }}</div>
      <form @submit.prevent="emit('submit')" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-semibold">活动名称</span>
            <input v-model="form.name" type="text" class="input input-bordered border-2 h-11" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">地点</span>
            <div class="flex gap-2">
              <input
                v-model="form.location"
                type="text"
                class="input input-bordered border-2 h-11 flex-1"
                @input="emit('clearLocation')"
              />
              <button type="button" class="btn btn-outline h-11 px-4" @click="emit('openLocation')">
                地图选择
              </button>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">对阵队伍</span>
            <input v-model="form.opposing" type="text" class="input input-bordered border-2 h-11" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">主队球服</span>
            <div
              class="flex items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-2"
            >
              <div class="flex items-center gap-3">
                <span
                  class="h-6 w-6 rounded-md border border-base-300"
                  :style="{ backgroundColor: form.color || 'transparent' }"
                ></span>
                <span
                  class="font-mono text-sm"
                  :class="form.color ? 'text-base-content' : 'text-base-content/40'"
                >
                  {{ form.color || '未设置' }}
                </span>
              </div>
              <div class="ml-auto flex items-center gap-2">
                <div class="dropdown dropdown-end">
                  <button type="button" tabindex="0" class="btn btn-outline btn-xs">选色</button>
                  <div
                    tabindex="0"
                    class="dropdown-content z-50 mt-2 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl"
                  >
                    <div class="grid grid-cols-8 gap-1.5">
                      <button
                        v-for="color in COMMON_JERSEY_COLORS"
                        :key="`home-${color}`"
                        type="button"
                        class="h-6 w-6 rounded-md border transition-transform hover:scale-105"
                        :class="
                          form.color === color
                            ? 'border-base-content ring-2 ring-primary/40'
                            : 'border-base-300/80'
                        "
                        :style="{ backgroundColor: color }"
                        :title="color"
                        @click="setColor('color', color)"
                      ></button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  :disabled="!form.color"
                  @click="setColor('color', '')"
                >
                  清空
                </button>
              </div>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">客队球服</span>
            <div
              class="flex items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 py-2"
            >
              <div class="flex items-center gap-3">
                <span
                  class="h-6 w-6 rounded-md border border-base-300"
                  :style="{ backgroundColor: form.opposing_color || 'transparent' }"
                ></span>
                <span
                  class="font-mono text-sm"
                  :class="form.opposing_color ? 'text-base-content' : 'text-base-content/40'"
                >
                  {{ form.opposing_color || '未设置' }}
                </span>
              </div>
              <div class="ml-auto flex items-center gap-2">
                <div class="dropdown dropdown-end">
                  <button type="button" tabindex="0" class="btn btn-outline btn-xs">选色</button>
                  <div
                    tabindex="0"
                    class="dropdown-content z-50 mt-2 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-xl"
                  >
                    <div class="grid grid-cols-8 gap-1.5">
                      <button
                        v-for="color in COMMON_JERSEY_COLORS"
                        :key="`away-${color}`"
                        type="button"
                        class="h-6 w-6 rounded-md border transition-transform hover:scale-105"
                        :class="
                          form.opposing_color === color
                            ? 'border-base-content ring-2 ring-primary/40'
                            : 'border-base-300/80'
                        "
                        :style="{ backgroundColor: color }"
                        :title="color"
                        @click="setColor('opposing_color', color)"
                      ></button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  :disabled="!form.opposing_color"
                  @click="setColor('opposing_color', '')"
                >
                  清空
                </button>
              </div>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">举办日期</span>
            <input
              v-model="form.holding_date"
              type="datetime-local"
              class="input input-bordered border-2 h-11"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">报名开始</span>
            <input
              v-model="form.start_time"
              type="datetime-local"
              class="input input-bordered border-2 h-11"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">报名截止</span>
            <input
              v-model="form.end_time"
              type="datetime-local"
              class="input input-bordered border-2 h-11"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">几人制</span>
            <select
              v-model="form.match_format"
              class="select select-bordered border-2 h-11"
              @change="emit('matchFormatChange')"
            >
              <option value="">不设置</option>
              <option v-for="option in MATCH_FORMAT_OPTIONS" :key="option" :value="String(option)">
                {{ option }} 人制
              </option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">每队人数上限</span>
            <input
              :value="form.players_per_team ?? ''"
              type="number"
              min="1"
              class="input input-bordered border-2 h-11"
              readonly
            />
          </label>
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-semibold">状态</span>
            <select v-model.number="form.status" class="select select-bordered border-2 h-11">
              <option :value="0">报名中</option>
              <option :value="1">进行中</option>
              <option :value="2">已结束</option>
              <option :value="3">已取消</option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-semibold">简介</span>
            <textarea
              v-model="form.description"
              rows="3"
              class="textarea textarea-bordered border-2 resize-none"
            ></textarea>
          </label>
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="close">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="editing">
            <span v-if="editing" class="loading loading-spinner loading-sm"></span>
            保存
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  COMMON_JERSEY_COLORS,
  MATCH_FORMAT_OPTIONS,
  normalizeHexColor,
  type ActivityColorField,
  type MatchFormatOption,
} from '@/views/activities/activity-detail.model'

export interface ActivityEditFormState {
  name: string
  location: string
  location_latitude: number | null
  location_longitude: number | null
  opposing: string
  color: string
  opposing_color: string
  holding_date: string
  start_time: string
  end_time: string
  description: string
  players_per_team: number | null
  match_format: '' | `${MatchFormatOption}`
  status: number
}

defineProps<{
  editing: boolean
  editError: string
}>()

const form = defineModel<ActivityEditFormState>('form', { required: true })
const emit = defineEmits<{
  clearLocation: []
  openLocation: []
  matchFormatChange: []
  submit: []
}>()

const dialogRef = ref<HTMLDialogElement>()

const setColor = (field: ActivityColorField, color: string) => {
  form.value[field] = normalizeHexColor(color)
}

const showModal = () => dialogRef.value?.showModal()
const close = () => dialogRef.value?.close()

defineExpose({
  showModal,
  close,
})
</script>
