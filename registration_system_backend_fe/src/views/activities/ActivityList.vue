<template>
  <div class="flex flex-col gap-6">
    <section
      class="sticky top-16 z-10 -mx-4 flex flex-col gap-4 bg-base-200 px-4 pb-3 pt-4 lg:-mx-6 lg:px-6"
    >
      <!-- 标题 -->
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold">活动报名</h2>
          <p class="mt-0.5 text-sm text-base-content/60">管理比赛活动，查看和操作球员报名状态</p>
        </div>
        <button class="btn btn-primary gap-2" @click="openCreateModal">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          新建活动
        </button>
      </div>

      <!-- 统计（全库汇总，与列表分页无关） -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
          <div class="stat-title text-xs">活动总数</div>
          <div class="stat-value text-2xl">{{ listCounts.total }}</div>
        </div>
        <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
          <div class="stat-title text-xs">报名中</div>
          <div class="stat-value text-2xl text-info">{{ listCounts.registering }}</div>
        </div>
        <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
          <div class="stat-title text-xs">进行中</div>
          <div class="stat-value text-2xl text-success">{{ listCounts.ongoing }}</div>
        </div>
        <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
          <div class="stat-title text-xs">已结束</div>
          <div class="stat-value text-2xl text-base-content/40">{{ listCounts.ended }}</div>
        </div>
      </div>

      <!-- 筛选 + 分页 -->
      <div class="rounded-xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
        <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(label, val) in {
                '-1': '全部',
                '0': '报名中',
                '1': '进行中',
                '2': '已结束',
                '3': '已取消',
              }"
              :key="val"
              class="btn btn-sm"
              :class="filterStatus === Number(val) ? 'btn-primary' : 'btn-outline'"
              @click="onFilterStatus(Number(val))"
            >
              {{ label }} ({{ filterTabCount(Number(val)) }})
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-3 xl:justify-end">
            <p v-if="listTotal > 0" class="text-sm text-base-content/60">
              第 <strong class="text-base-content">{{ listPage }}</strong> /
              {{ listTotalPages }} 页，共
              <strong class="text-base-content">{{ listTotal }}</strong> 场
            </p>
            <div v-if="listTotal > 0" class="join">
              <button
                type="button"
                class="join-item btn btn-sm"
                :disabled="listPage <= 1 || loading"
                @click="goListPage(listPage - 1)"
              >
                上一页
              </button>
              <button
                type="button"
                class="join-item btn btn-sm"
                :disabled="listPage >= listTotalPages || loading"
                @click="goListPage(listPage + 1)"
              >
                下一页
              </button>
            </div>
            <label class="ml-auto flex items-center gap-2 text-xs text-base-content/60 xl:ml-0">
              <span>每页</span>
              <select
                v-model.number="listPageSize"
                class="select select-bordered select-xs h-8 min-h-0 w-[5.5rem]"
                @change="onListPageSizeChange"
              >
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </section>

    <!-- 加载 -->
    <div v-if="loading" class="flex flex-col gap-3">
      <div v-for="i in 5" :key="i" class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body p-4">
          <div class="flex items-start gap-3">
            <div class="skeleton h-14 w-14 rounded-xl flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="flex items-center gap-2">
                <div class="skeleton h-5 w-32"></div>
                <div class="skeleton h-5 w-14 rounded-full"></div>
              </div>
              <div class="flex gap-3">
                <div class="skeleton h-4 w-28"></div>
                <div class="skeleton h-4 w-32"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="activityItems.length === 0 && listTotal === 0"
      class="flex flex-col items-center py-20 text-base-content/40"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-12 w-12 mb-3"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"
        />
      </svg>
      <p>暂无活动</p>
    </div>

    <!-- 活动列表 -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="activity in activityItems"
        :key="activity.id"
        class="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        @click="goDetail(activity.id)"
      >
        <div class="card-body p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <!-- 日期方块 -->
              <div class="flex-shrink-0 w-14 text-center bg-primary/10 rounded-xl py-1.5">
                <div class="text-xs text-primary/70 font-medium">
                  {{ formatMonth(activity.holding_date) }}
                </div>
                <div class="text-xl font-bold text-primary leading-none">
                  {{ formatDay(activity.holding_date) }}
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-bold text-base truncate">{{ activity.name }}</h3>
                  <span
                    class="badge badge-sm"
                    :class="STATUS_BADGE[activity.status] || 'badge-ghost'"
                  >
                    {{ STATUS_LABEL[activity.status] || activity.status }}
                  </span>
                </div>
                <div class="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-base-content/60">
                  <span class="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                      />
                    </svg>
                    {{ activity.location }}
                  </span>
                  <span class="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
                      />
                    </svg>
                    {{ formatTime(activity.start_time) }} – {{ formatTime(activity.end_time) }}
                  </span>
                  <span v-if="activity.opposing" class="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"
                      />
                    </svg>
                    对阵：{{ activity.opposing }}
                  </span>
                </div>
              </div>
            </div>
            <!-- 操作按钮 -->
            <div class="flex gap-1.5 flex-shrink-0" @click.stop>
              <div class="dropdown dropdown-end">
                <button tabindex="0" class="btn btn-ghost btn-xs btn-square">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                    />
                  </svg>
                </button>
                <ul
                  tabindex="0"
                  class="dropdown-content menu menu-sm bg-base-100 rounded-box z-50 w-40 p-1 shadow-lg border border-base-200"
                >
                  <li><a @click="goDetail(activity.id)">查看详情</a></li>
                  <li><a @click="openEditModal(activity)">编辑</a></li>
                  <li v-for="(label, s) in statusActions(activity.status)" :key="s">
                    <a @click="changeStatus(activity.id, Number(s))">{{ label }}</a>
                  </li>
                  <li><a class="text-error" @click="confirmDelete(activity)">删除</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ 新建/编辑弹窗 ═══ -->
  <dialog ref="formModalRef" class="modal">
    <div class="modal-box max-w-2xl">
      <h3 class="text-lg font-bold mb-4">{{ editTarget ? '编辑活动' : '新建活动' }}</h3>
      <div v-if="formError" class="alert alert-error py-2.5 mb-4 text-sm">{{ formError }}</div>
      <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-semibold">活动名称 <span class="text-error">*</span></span>
            <input
              v-model="form.name"
              type="text"
              required
              class="input input-bordered border-2 h-11"
              placeholder="如：周四友谊赛"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">地点 <span class="text-error">*</span></span>
            <div class="flex gap-2">
              <input
                v-model="form.location"
                type="text"
                required
                class="input input-bordered border-2 h-11 flex-1"
                placeholder="比赛场地"
                @input="clearFormLocationCoordinates"
              />
              <button type="button" class="btn btn-outline h-11 px-4" @click="openLocationModal">
                地图选择
              </button>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">对阵队伍</span>
            <input
              v-model="form.opposing"
              type="text"
              class="input input-bordered border-2 h-11"
              placeholder="对手队名（可选）"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">球服颜色</span>
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
                        @click="selectColor('color', color)"
                      ></button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  :disabled="!form.color"
                  @click="clearColor('color')"
                >
                  清空
                </button>
              </div>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">对手球服颜色</span>
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
                        @click="selectColor('opposing_color', color)"
                      ></button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  :disabled="!form.opposing_color"
                  @click="clearColor('opposing_color')"
                >
                  清空
                </button>
              </div>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">举办日期 <span class="text-error">*</span></span>
            <input
              v-model="form.holding_date"
              type="datetime-local"
              required
              class="input input-bordered border-2 h-11"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold"
              >报名开始时间 <span class="text-error">*</span></span
            >
            <input
              v-model="form.start_time"
              type="datetime-local"
              required
              class="input input-bordered border-2 h-11"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold"
              >报名截止时间 <span class="text-error">*</span></span
            >
            <input
              v-model="form.end_time"
              type="datetime-local"
              required
              class="input input-bordered border-2 h-11"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">几人制</span>
            <select
              v-model="form.match_format"
              class="select select-bordered border-2 h-11"
              @change="onMatchFormatChange(form)"
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
              placeholder="选择几人制后自动计算"
              readonly
            />
          </label>
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-semibold">简介</span>
            <textarea
              v-model="form.description"
              rows="3"
              class="textarea textarea-bordered border-2 resize-none"
              placeholder="活动说明（可选）"
            ></textarea>
          </label>
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="formModalRef?.close()">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
            {{ editTarget ? '保存' : '创建' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <TencentLocationPickerModal
    v-model:open="locationPickerOpen"
    :location-title="form.location"
    :location-latitude="form.location_latitude"
    :location-longitude="form.location_longitude"
    @apply="applySelectedLocation"
  />

  <!-- ═══ 删除确认 ═══ -->
  <dialog ref="deleteModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认删除</h3>
      <p class="py-4 text-base-content/70">
        确定删除活动 <strong>{{ deletingActivity?.name }}</strong
        >？该操作不可撤销，同时会删除所有相关报名记录。
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="deleteModalRef?.close()">取消</button>
        <button class="btn btn-error" :disabled="deleting" @click="handleDelete">
          <span v-if="deleting" class="loading loading-spinner loading-sm"></span>
          确认删除
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/utils/toast'
import TencentLocationPickerModal from '@/components/TencentLocationPickerModal.vue'
import {
  listActivities,
  createActivity,
  updateActivity,
  updateActivityStatus,
  deleteActivities,
  STATUS_LABEL,
  STATUS_BADGE,
  type Activity,
  type ActivityStatusCounts,
  type CreateActivityPayload,
} from '@/services/activity'
import type { AppliedLocationSelection } from '@/views/activities/location-picker.model'

const router = useRouter()
const MATCH_FORMAT_OPTIONS = [5, 6, 7, 8, 11] as const
type MatchFormatOption = (typeof MATCH_FORMAT_OPTIONS)[number]

const activityItems = ref<Activity[]>([])
const listCounts = ref<ActivityStatusCounts>({
  total: 0,
  registering: 0,
  ongoing: 0,
  ended: 0,
  cancelled: 0,
})
const listTotal = ref(0)
const listPage = ref(1)
const listPageSize = ref(20)
const loading = ref(false)
const filterStatus = ref(-1)

const listTotalPages = computed(() => Math.max(1, Math.ceil(listTotal.value / listPageSize.value)))

const filterTabCount = (status: number) => {
  const c = listCounts.value
  if (status === -1) return c.total
  if (status === 0) return c.registering
  if (status === 1) return c.ongoing
  if (status === 2) return c.ended
  if (status === 3) return c.cancelled
  return 0
}

const onFilterStatus = async (status: number) => {
  filterStatus.value = status
  listPage.value = 1
  await fetchList()
}

const onListPageSizeChange = async () => {
  listPage.value = 1
  await fetchList()
}

const goListPage = async (p: number) => {
  const next = Math.min(Math.max(1, p), listTotalPages.value)
  if (next === listPage.value) return
  listPage.value = next
  await fetchList()
}

const goDetail = (id: string) => router.push(`/activities/${id}`)

const formatMonth = (d: string) => new Date(d).toLocaleDateString('zh-CN', { month: 'short' })
const formatDay = (d: string) => new Date(d).getDate().toString().padStart(2, '0')
const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

const statusActions = (status: number): Record<number, string> => {
  const all: Record<number, string> = {
    0: '设为报名中',
    1: '设为进行中',
    2: '设为已结束',
    3: '取消活动',
  }
  const res: Record<number, string> = {}
  for (const [k, v] of Object.entries(all)) {
    if (Number(k) !== status) res[Number(k)] = v
  }
  return res
}

const changeStatus = async (id: string, status: number) => {
  try {
    await updateActivityStatus(id, status)
    await fetchList()
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  }
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await listActivities({
      page: listPage.value,
      page_size: listPageSize.value,
      status: filterStatus.value,
    })
    activityItems.value = res.items
    listTotal.value = res.total
    listCounts.value = res.counts
    listPage.value = res.page
    const maxPage = Math.max(1, Math.ceil(res.total / res.page_size))
    if (res.items.length === 0 && res.total > 0 && res.page > maxPage) {
      listPage.value = maxPage
      await fetchList()
      return
    }
  } finally {
    loading.value = false
  }
}

// ── 新建/编辑 ──
const formModalRef = ref<HTMLDialogElement>()
const editTarget = ref<Activity | null>(null)
const submitting = ref(false)
const formError = ref('')
const form = reactive({
  name: '',
  location: '',
  location_latitude: null as number | null,
  location_longitude: null as number | null,
  opposing: '',
  color: '',
  opposing_color: '',
  holding_date: '',
  start_time: '',
  end_time: '',
  description: '',
  match_format: '' as '' | `${MatchFormatOption}`,
  players_per_team: null as number | null,
})

type ColorField = 'color' | 'opposing_color'
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i
const COMMON_JERSEY_COLORS = [
  '#FFFFFF',
  '#F5F5F5',
  '#D1D5DB',
  '#9CA3AF',
  '#4B5563',
  '#111827',
  '#000000',
  '#7C3AED',
  '#EC4899',
  '#F43F5E',
  '#DC2626',
  '#EA580C',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#16A34A',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
  '#3B82F6',
  '#2563EB',
  '#1D4ED8',
  '#4338CA',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#C026D3',
  '#BE123C',
  '#7F1D1D',
]

const normalizeHexColor = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toUpperCase() : ''
}

const playersPerTeamFromMatchFormat = (matchFormat: MatchFormatOption) => matchFormat * 2 - 1

const inferMatchFormat = (
  playersPerTeam: number | null | undefined,
): '' | `${MatchFormatOption}` => {
  if (playersPerTeam == null) return ''
  const matched = MATCH_FORMAT_OPTIONS.find(
    (option) => playersPerTeamFromMatchFormat(option) === playersPerTeam,
  )
  return matched ? (String(matched) as `${MatchFormatOption}`) : ''
}

const onMatchFormatChange = (target: {
  match_format: '' | `${MatchFormatOption}`
  players_per_team: number | null
}) => {
  target.players_per_team = target.match_format
    ? playersPerTeamFromMatchFormat(Number(target.match_format) as MatchFormatOption)
    : null
}

const selectColor = (field: ColorField, color: string) => {
  form[field] = normalizeHexColor(color)
}

const clearColor = (field: ColorField) => {
  form[field] = ''
}

const locationPickerOpen = ref(false)

const clearFormLocationCoordinates = () => {
  form.location_latitude = null
  form.location_longitude = null
}

const openLocationModal = () => {
  locationPickerOpen.value = true
}

const applySelectedLocation = (selection: AppliedLocationSelection) => {
  form.location = selection.title
  form.location_latitude = selection.locationLatitude
  form.location_longitude = selection.locationLongitude
  locationPickerOpen.value = false
}

const toLocal = (iso: string) => {
  if (!iso) return ''
  return iso.slice(0, 16)
}

const openCreateModal = () => {
  editTarget.value = null
  Object.assign(form, {
    name: '',
    location: '',
    location_latitude: null,
    location_longitude: null,
    opposing: '',
    color: '',
    opposing_color: '',
    holding_date: '',
    start_time: '',
    end_time: '',
    description: '',
    match_format: '',
    players_per_team: null,
  })
  formError.value = ''
  formModalRef.value?.showModal()
}

const openEditModal = (activity: Activity) => {
  editTarget.value = activity
  Object.assign(form, {
    name: activity.name,
    location: activity.location,
    location_latitude: activity.location_latitude,
    location_longitude: activity.location_longitude,
    opposing: activity.opposing || '',
    color: normalizeHexColor(activity.color || ''),
    opposing_color: normalizeHexColor(activity.opposing_color || ''),
    holding_date: toLocal(activity.holding_date),
    start_time: toLocal(activity.start_time),
    end_time: toLocal(activity.end_time),
    description: activity.description || '',
    match_format: inferMatchFormat(activity.players_per_team),
    players_per_team: activity.players_per_team ?? null,
  })
  formError.value = ''
  formModalRef.value?.showModal()
}

const handleSubmit = async () => {
  submitting.value = true
  formError.value = ''
  try {
    const payload: CreateActivityPayload = {
      name: form.name,
      location: form.location,
      location_latitude: form.location_latitude ?? undefined,
      location_longitude: form.location_longitude ?? undefined,
      holding_date: form.holding_date ? form.holding_date + ':00' : '',
      start_time: form.start_time ? form.start_time + ':00' : '',
      end_time: form.end_time ? form.end_time + ':00' : '',
      opposing: form.opposing || undefined,
      color: form.color || undefined,
      opposing_color: form.opposing_color || undefined,
      description: form.description || undefined,
      players_per_team: form.players_per_team ?? undefined,
    }
    if (editTarget.value) {
      await updateActivity(editTarget.value.id, payload)
    } else {
      await createActivity(payload)
    }
    await fetchList()
    formModalRef.value?.close()
  } catch (e: unknown) {
    formError.value = (e as Error).message || '操作失败'
  } finally {
    submitting.value = false
  }
}

// ── 删除 ──
const deleteModalRef = ref<HTMLDialogElement>()
const deletingActivity = ref<Activity | null>(null)
const deleting = ref(false)

const confirmDelete = (activity: Activity) => {
  deletingActivity.value = activity
  deleteModalRef.value?.showModal()
}

const handleDelete = async () => {
  if (!deletingActivity.value) return
  deleting.value = true
  try {
    await deleteActivities([deletingActivity.value.id])
    await fetchList()
    deleteModalRef.value?.close()
  } catch (e: unknown) {
    toast.error((e as Error).message || '删除失败')
  } finally {
    deleting.value = false
  }
}

onMounted(fetchList)
</script>
