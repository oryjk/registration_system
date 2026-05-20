<template>
  <dialog class="modal" :class="{ 'modal-open': open }">
    <div class="modal-box w-full max-w-3xl">
      <h3 class="text-lg font-bold">
        {{ mode === 'create' ? '创建散人报名' : `编辑${challenge?.kind === 'individual' ? '散人报名' : '约队'}` }}
      </h3>
      <div class="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <label v-if="mode === 'create'" class="form-control md:col-span-2">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">发布用户 ID</span>
          </div>
          <input v-model.number="form.host_user_id" type="number" min="1" class="input input-bordered h-11 w-full" :disabled="saving" />
          <div class="label py-1">
            <span class="label-text-alt text-base-content/50">使用场馆用户或允许发布散人报名的用户 ID 作为发布方。</span>
          </div>
        </label>
        <label class="form-control md:col-span-2">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">标题</span>
          </div>
          <input v-model.trim="form.title" class="input input-bordered h-11 w-full" :disabled="saving" />
        </label>
        <label class="form-control">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">比赛日期</span>
          </div>
          <input v-model="form.holding_date" type="datetime-local" class="input input-bordered h-11 w-full" :disabled="saving" />
        </label>
        <label class="form-control">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">开始时间</span>
          </div>
          <input v-model="form.start_time" type="datetime-local" class="input input-bordered h-11 w-full" :disabled="saving" />
        </label>
        <label class="form-control">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">结束时间</span>
          </div>
          <input v-model="form.end_time" type="datetime-local" class="input input-bordered h-11 w-full" :disabled="saving" />
        </label>
        <label class="form-control">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">人数规格</span>
          </div>
          <input v-model.number="form.players_per_team" type="number" min="1" class="input input-bordered h-11 w-full" :disabled="saving" />
        </label>
        <label class="form-control md:col-span-2">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">场地</span>
          </div>
          <input v-model.trim="form.location" class="input input-bordered h-11 w-full" :disabled="saving" />
        </label>
        <label class="form-control">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">纬度</span>
          </div>
          <input v-model="form.location_latitude" type="number" step="0.000001" class="input input-bordered h-11 w-full" :disabled="saving" />
        </label>
        <label class="form-control">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">经度</span>
          </div>
          <input v-model="form.location_longitude" type="number" step="0.000001" class="input input-bordered h-11 w-full" :disabled="saving" />
        </label>
        <label class="form-control">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">人均费用</span>
          </div>
          <input v-model.trim="form.fee_per_person" type="number" step="0.01" min="0" class="input input-bordered h-11 w-full" :disabled="saving" />
        </label>
        <label class="form-control md:col-span-2">
          <div class="label py-1">
            <span class="label-text text-xs text-base-content/60">备注</span>
          </div>
          <textarea v-model.trim="form.note" class="textarea textarea-bordered min-h-24 w-full" :disabled="saving"></textarea>
        </label>
      </div>
      <p v-if="visibleError" class="mt-3 text-sm text-error">{{ visibleError }}</p>
      <div class="modal-action">
        <button class="btn btn-ghost" :disabled="saving" @click="emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="handleSubmit">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button>关闭</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Challenge, UpdateChallengePayload } from '@/services/challenge'

const props = defineProps<{
  open: boolean
  challenge: Challenge | null
  saving: boolean
  error?: string
  mode?: 'create' | 'edit'
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: UpdateChallengePayload & { host_user_id?: number }]
}>()

const localError = ref('')
const form = reactive({
  title: '',
  holding_date: '',
  start_time: '',
  end_time: '',
  location: '',
  location_latitude: '',
  location_longitude: '',
  players_per_team: 8,
  fee_per_person: '',
  note: '',
  host_user_id: null as number | null,
})

const visibleError = computed(() => localError.value || props.error || '')

watch(
  () => [props.open, props.challenge] as const,
  () => {
    if (!props.open || !props.challenge) return
    const challenge = props.challenge
    localError.value = ''
    Object.assign(form, {
      title: challenge.title,
      holding_date: toDateTimeInputValue(challenge.holding_date),
      start_time: toDateTimeInputValue(challenge.start_time),
      end_time: toDateTimeInputValue(challenge.end_time),
      location: challenge.location,
      location_latitude: challenge.location_latitude?.toString() ?? '',
      location_longitude: challenge.location_longitude?.toString() ?? '',
      players_per_team: challenge.players_per_team,
      fee_per_person: challenge.fee_per_person ?? '',
      note: challenge.note ?? '',
      host_user_id: null,
    })
  },
  { immediate: true },
)

watch(
  () => props.open,
  () => {
    if (!props.open || props.challenge || props.mode !== 'create') return
    localError.value = ''
    Object.assign(form, {
      title: '',
      holding_date: '',
      start_time: '',
      end_time: '',
      location: '',
      location_latitude: '',
      location_longitude: '',
      players_per_team: 8,
      fee_per_person: '',
      note: '',
      host_user_id: null,
    })
  },
  { immediate: true },
)

function toDateTimeInputValue(value: string) {
  if (!value) return ''
  return value.replace(' ', 'T').slice(0, 16)
}

function toApiDateTime(value: string) {
  return value.length === 16 ? `${value}:00` : value
}

function optionalNumber(value: string) {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validateForm() {
  if (props.mode === 'create' && (!form.host_user_id || form.host_user_id <= 0)) {
    return '发布用户 ID 必须大于 0'
  }
  if (!form.title) return '标题不能为空'
  if (!form.location) return '场地不能为空'
  if (form.players_per_team <= 0) return '人数规格必须大于 0'
  if (new Date(form.end_time).getTime() <= new Date(form.start_time).getTime()) {
    return '结束时间必须晚于开始时间'
  }
  return ''
}

function handleSubmit() {
  const message = validateForm()
  if (message) {
    localError.value = message
    return
  }
  localError.value = ''
  emit('submit', {
    title: form.title,
    holding_date: toApiDateTime(form.holding_date),
    start_time: toApiDateTime(form.start_time),
    end_time: toApiDateTime(form.end_time),
    location: form.location,
    location_latitude: optionalNumber(form.location_latitude),
    location_longitude: optionalNumber(form.location_longitude),
    players_per_team: form.players_per_team,
    fee_per_person: form.fee_per_person || null,
    note: form.note || null,
    host_user_id: form.host_user_id ?? undefined,
  })
}
</script>
