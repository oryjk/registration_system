<template>
  <div v-if="loading" class="flex flex-col gap-6">
    <div class="flex items-center gap-2">
      <div class="skeleton h-4 w-16"></div>
      <div class="skeleton h-4 w-4"></div>
      <div class="skeleton h-5 w-32"></div>
    </div>
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5 space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <div class="skeleton h-7 w-40"></div>
              <div class="skeleton h-6 w-14 rounded-full"></div>
            </div>
            <div class="flex gap-3">
              <div class="skeleton h-4 w-36"></div>
              <div class="skeleton h-4 w-28"></div>
            </div>
          </div>
          <div class="skeleton h-9 w-16"></div>
        </div>
        <div class="flex flex-wrap gap-4 pt-4 border-t border-base-200">
          <div class="skeleton h-5 w-16"></div>
          <div class="skeleton h-5 w-16"></div>
          <div class="skeleton h-5 w-16"></div>
          <div class="skeleton h-5 w-16"></div>
        </div>
      </div>
    </div>
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5 space-y-4">
        <div class="skeleton h-5 w-24"></div>
        <div class="space-y-3">
          <div v-for="i in 5" :key="i" class="flex items-center gap-4">
            <div class="skeleton h-10 w-10 rounded-full flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-24"></div>
              <div class="skeleton h-3 w-32"></div>
            </div>
            <div class="skeleton h-6 w-14 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="loadError" class="alert alert-error">
    <span>{{ loadError }}</span>
    <button class="btn btn-sm btn-ghost" @click="fetchAll">重试</button>
  </div>

  <div v-else-if="activity" class="flex flex-col gap-6">
    <!-- 面包屑 -->
    <div class="flex items-center gap-2 text-sm text-base-content/50">
      <RouterLink to="/activities" class="hover:text-primary transition-colors"
        >活动报名</RouterLink
      >
      <span>/</span>
      <span class="text-base-content font-medium">{{ activity.name }}</span>
    </div>

    <!-- 活动基本信息 -->
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-xl font-bold">{{ activity.name }}</h2>
              <span class="badge" :class="STATUS_BADGE[activity.status] || 'badge-ghost'">
                {{ STATUS_LABEL[activity.status] || activity.status }}
              </span>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-base-content/60">
              <span class="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"
                  />
                </svg>
                {{ formatDateTime(activity.holding_date) }}
              </span>
              <span class="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                  />
                </svg>
                {{ activity.location }}
              </span>
              <span v-if="activity.opposing" class="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"
                  />
                </svg>
                对阵：{{ activity.opposing }}
              </span>
              <span class="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
                  />
                </svg>
                报名时段：{{ formatTime(activity.start_time) }} –
                {{ formatTime(activity.end_time) }}
              </span>
            </div>
            <p v-if="activity.description" class="mt-2 text-sm text-base-content/60">
              {{ activity.description }}
            </p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button class="btn btn-sm btn-outline gap-1" @click="openEditModal">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                />
              </svg>
              编辑
            </button>
          </div>
        </div>

        <!-- 报名统计 -->
        <div class="flex flex-wrap gap-4 mt-4 pt-4 border-t border-base-200">
          <div class="flex items-center gap-1.5 text-sm">
            <span class="badge badge-success badge-sm">参加</span>
            <strong>{{ regCounts.attending }}</strong> 人
          </div>
          <div class="flex items-center gap-1.5 text-sm">
            <span class="badge badge-warning badge-sm">请假</span>
            <strong>{{ regCounts.leave }}</strong> 人
          </div>
          <div class="flex items-center gap-1.5 text-sm">
            <span class="badge badge-error badge-sm">迟到</span>
            <strong>{{ regCounts.absent }}</strong> 人
          </div>
          <div class="flex items-center gap-1.5 text-sm">
            <span class="badge badge-ghost badge-sm">未表态</span>
            <strong>{{ regCounts.unknown }}</strong> 人
          </div>
          <div class="flex items-center gap-1.5 text-sm ml-auto text-base-content/50">
            共 <strong class="text-base-content">{{ regCounts.total }}</strong> 条报名记录
            <span v-if="activity.players_per_team"
              >（上限 {{ activity.players_per_team }} 人/队）</span
            >
          </div>
        </div>

        <div
          v-if="registrationProgress"
          class="mt-4 rounded-2xl border border-base-300 bg-base-200/50 p-4"
        >
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">报名人数进度</p>
              <p class="mt-1 text-xs text-base-content/55">
                参加 {{ regCounts.attending }} 人，{{ registrationProgress.matchFormat }} 人制达标点
                {{ registrationProgress.requiredCount }} 人， 每队上限
                {{ registrationProgress.upperLimit }} 人
              </p>
            </div>
            <div class="text-right">
              <p
                class="text-2xl font-black tabular-nums"
                :class="registrationProgress.reachedRequirement ? 'text-success' : 'text-error'"
              >
                {{ registrationProgress.displayPercent }}%
              </p>
              <p class="text-xs text-base-content/55">
                {{ registrationProgress.reachedRequirement ? '已达到人制要求' : '未达到人制要求' }}
              </p>
            </div>
          </div>

          <div class="mt-4">
            <div class="relative h-3 overflow-hidden rounded-full bg-base-300/90">
              <div
                class="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                :class="registrationProgress.reachedRequirement ? 'bg-success' : 'bg-error'"
                :style="{ width: `${registrationProgress.fillWidth}%` }"
              ></div>
              <div
                class="absolute top-1/2 z-10 h-5 w-5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-base-100 shadow-sm"
                :style="{ left: `${registrationProgress.requiredMarker}%` }"
                :title="`${registrationProgress.matchFormat} 人制达标点`"
              ></div>
              <div
                class="absolute top-1/2 right-0 z-10 h-5 w-5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-white bg-base-100 shadow-sm"
                title="人数上限"
              ></div>
            </div>
            <div class="relative mt-2 h-10 text-[11px] font-medium text-base-content/60">
              <div
                class="absolute top-0 -translate-x-1/2 text-center"
                :style="{ left: `${registrationProgress.requiredMarker}%` }"
              >
                <p>{{ registrationProgress.requiredCount }} 人</p>
                <p>{{ registrationProgress.matchFormat }} 人制</p>
              </div>
              <div class="absolute top-0 right-0 translate-x-1/2 text-center">
                <p>{{ registrationProgress.upperLimit }} 人</p>
                <p>上限</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="font-bold text-base">到场签到</h3>
            <p class="mt-1 text-sm text-base-content/55">按球队维度展示本场定位签到配置</p>
          </div>
          <span class="badge badge-outline">{{ activity.team_checkin_configs.length }} 条配置</span>
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div
            v-for="teamId in activityCheckinTeamIds"
            :key="teamId"
            class="rounded-2xl border border-base-300 bg-base-200/40 p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold">{{ checkinTeamLabel(teamId) }}</p>
                <p class="mt-1 text-xs text-base-content/50 font-mono">{{ teamId }}</p>
              </div>
              <span
                class="badge"
                :class="teamCheckinConfig(teamId)?.enabled ? 'badge-success' : 'badge-ghost'"
              >
                {{ teamCheckinConfig(teamId)?.enabled ? '已启用' : '未启用' }}
              </span>
            </div>

            <template v-if="teamCheckinConfig(teamId)">
              <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p class="text-base-content/50">签到半径</p>
                  <p class="mt-1 font-semibold">
                    {{ teamCheckinConfig(teamId)?.radius_meters }} 米
                  </p>
                </div>
                <div>
                  <p class="text-base-content/50">开放窗口</p>
                  <p class="mt-1 font-semibold">
                    提前 {{ teamCheckinConfig(teamId)?.open_minutes_before }} 分钟 / 延后
                    {{ teamCheckinConfig(teamId)?.close_minutes_after }} 分钟
                  </p>
                </div>
                <div class="col-span-2">
                  <p class="text-base-content/50">实际时间</p>
                  <p class="mt-1 font-semibold">
                    {{ formatDateTime(teamCheckinConfig(teamId)?.checkin_open_at || '') }} -
                    {{ formatDateTime(teamCheckinConfig(teamId)?.checkin_close_at || '') }}
                  </p>
                </div>
              </div>
            </template>
            <p v-else class="mt-4 text-sm text-base-content/55">该队本场还没有开启签到。</p>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 class="font-bold text-base">赛后费用结算</h3>
            <p class="mt-1 text-sm text-base-content/55">
              仅管理员手动触发。系统会按本场“参加”名单自动 AA 并扣费。
            </p>
          </div>
          <span
            class="badge"
            :class="settlementSummary?.settled ? 'badge-success' : 'badge-ghost'"
          >
            {{ settlementSummary?.settled ? '已结算' : '未结算' }}
          </span>
        </div>

        <div v-if="settlementError" class="alert alert-error mt-4 py-2 text-sm">
          {{ settlementError }}
        </div>

        <div v-if="settlementLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>

        <div v-else class="mt-4 grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <div class="rounded-2xl border border-base-300 bg-base-200/40 p-4">
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <p class="text-sm text-base-content/50">参加人数</p>
                <p class="mt-1 text-2xl font-black tabular-nums">
                  {{ settlementSummary?.attending_user_count ?? 0 }}
                </p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">已扣费人数</p>
                <p class="mt-1 text-2xl font-black tabular-nums">
                  {{ settlementSummary?.settled_user_count ?? 0 }}
                </p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">当前有效批次</p>
                <p class="mt-1 text-lg font-bold">
                  {{ settlementSummary?.current_batch_no ? `第 ${settlementSummary.current_batch_no} 批` : '—' }}
                </p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">结算状态</p>
                <p class="mt-1 text-lg font-bold">
                  {{ settlementSummary?.settled ? '已完成' : '待处理' }}
                </p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">结算总金额</p>
                <p class="mt-1 text-lg font-bold">
                  {{ formatCurrency(settlementSummary?.total_amount) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">人均费用</p>
                <p class="mt-1 text-lg font-bold">
                  {{ formatCurrency(settlementSummary?.aa_fee) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">结算时间</p>
                <p class="mt-1 text-sm font-semibold">
                  {{ settlementSummary?.settled_at ? formatDateTime(settlementSummary.settled_at) : '—' }}
                </p>
              </div>
            </div>

            <div class="mt-4 rounded-xl border border-dashed border-base-300 bg-base-100/70 p-3">
              <p class="text-sm text-base-content/50">结算说明</p>
              <p class="mt-1 text-sm">
                {{ settlementSummary?.description || '未填写说明，默认按本场比赛费用结算。' }}
              </p>
            </div>
          </div>

          <form class="rounded-2xl border border-base-300 bg-base-200/40 p-4" @submit.prevent="handleSettlement">
            <div class="flex items-center justify-between gap-3">
              <h4 class="font-semibold">手动触发结算</h4>
              <span class="text-xs text-base-content/50">
                {{ activity?.status === 2 ? '活动已结束，可执行结算' : '仅已结束活动可结算' }}
              </span>
            </div>

            <label class="mt-4 flex flex-col gap-1.5">
              <span class="text-sm font-semibold">总金额</span>
              <input
                v-model="settlementForm.total_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="例如 240"
                class="input input-bordered border-2 h-11"
                :disabled="settlementSubmitting"
              />
            </label>

            <label class="mt-4 flex flex-col gap-1.5">
              <span class="text-sm font-semibold">结算说明</span>
              <textarea
                v-model="settlementForm.description"
                rows="3"
                class="textarea textarea-bordered border-2 resize-none"
                placeholder="例如：场地费 + 裁判费"
                :disabled="settlementSubmitting"
              ></textarea>
            </label>

            <div class="mt-4 rounded-xl bg-base-100/80 px-3 py-2 text-sm text-base-content/60">
              <p>预计参与扣费人数：{{ settlementSummary?.attending_user_count ?? 0 }} 人</p>
              <p class="mt-1">
                预计人均：{{ settlementPreviewFee }}
              </p>
              <p v-if="settlementSummary?.settled" class="mt-1 text-warning">
                再次提交会先冲正当前有效批次，再生成新的结算批次。
              </p>
            </div>

            <div class="mt-4 flex justify-end">
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="!canSubmitSettlement || settlementSubmitting"
              >
                <span v-if="settlementSubmitting" class="loading loading-spinner loading-sm"></span>
                {{ settlementSummary?.settled ? '按新金额重结算' : '执行本场结算' }}
              </button>
            </div>
          </form>
        </div>

        <div
          v-if="settlementSummary?.history?.length"
          class="mt-4 overflow-x-auto rounded-2xl border border-base-300"
        >
          <table class="table table-sm min-w-[760px]">
            <thead>
              <tr>
                <th>批次</th>
                <th>动作</th>
                <th>总金额</th>
                <th>人均</th>
                <th>人数</th>
                <th>说明</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="batch in settlementSummary.history" :key="batch.batch_no">
                <td class="font-semibold">第 {{ batch.batch_no }} 批</td>
                <td>
                  <span
                    class="badge badge-sm"
                    :class="batch.operation_type === 'settle' ? 'badge-primary' : 'badge-warning'"
                  >
                    {{ batchLabel(batch) }}
                  </span>
                </td>
                <td class="font-mono">{{ formatCurrency(batch.total_amount) }}</td>
                <td class="font-mono">{{ formatCurrency(batch.aa_fee) }}</td>
                <td>{{ batch.user_count }}</td>
                <td class="max-w-[20rem] whitespace-normal text-sm">{{ batch.description }}</td>
                <td class="text-xs text-base-content/60">{{ formatDateTime(batch.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 报名列表 -->
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5">
        <section
          class="sticky top-16 z-10 -mx-5 mb-4 flex flex-col gap-4 bg-base-100 px-5 pb-4 pt-5"
        >
          <div class="flex items-center justify-between gap-4">
            <h3 class="font-bold text-base">报名记录</h3>
            <button class="btn btn-primary btn-sm gap-1" @click="openRegisterModal">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              手动报名
            </button>
          </div>

          <div
            v-if="hasSelectedRegs"
            class="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10"
          >
            <span class="text-sm"
              >已选 <strong>{{ selectedRegIds.length }}</strong> 人</span
            >
            <div class="flex-1"></div>
            <button class="btn btn-sm btn-ghost" @click="selectedRegIds = []">清空</button>
            <button class="btn btn-sm btn-primary gap-1" @click="openBatchStandModal">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h2v5zm0 4h-2v-2h2v2z"
                />
              </svg>
              批量修改状态
            </button>
          </div>

          <div class="rounded-xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
            <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="(label, val) in {
                    '-1': '全部',
                    '1': '参加',
                    '2': '请假',
                    '3': '迟到',
                    '0': '未表态',
                  }"
                  :key="val"
                  class="btn btn-xs"
                  :class="regFilter === Number(val) ? 'btn-primary' : 'btn-outline'"
                  @click="onRegFilter(Number(val))"
                >
                  {{ label }} ({{ filterTabCount(Number(val)) }})
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-3 xl:justify-end">
                <p v-if="regTotal > 0" class="text-sm text-base-content/60">
                  第 <strong class="text-base-content">{{ regPage }}</strong> /
                  {{ regTotalPages }} 页，共
                  <strong class="text-base-content">{{ regTotal }}</strong> 条
                </p>
                <div v-if="regTotal > 0" class="join">
                  <button
                    type="button"
                    class="join-item btn btn-sm"
                    :disabled="regPage <= 1 || regLoading"
                    @click="goRegPage(regPage - 1)"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    class="join-item btn btn-sm"
                    :disabled="regPage >= regTotalPages || regLoading"
                    @click="goRegPage(regPage + 1)"
                  >
                    下一页
                  </button>
                </div>
                <label class="ml-auto flex items-center gap-2 text-xs text-base-content/60 xl:ml-0">
                  <span>每页</span>
                  <select
                    v-model.number="regPageSize"
                    class="select select-bordered select-xs h-8 min-h-0 w-[5.5rem]"
                    @change="onPageSizeChange"
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

        <div v-if="regLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>

        <div
          v-else-if="regItems.length === 0"
          class="text-center text-base-content/40 py-8 text-sm"
        >
          暂无报名记录
        </div>

        <div v-else class="overflow-x-auto">
          <table class="table table-zebra table-sm min-w-[880px]">
            <thead>
              <tr>
                <th class="w-10">
                  <label class="flex justify-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="allPageSelected"
                      @change="toggleSelectAll"
                    />
                  </label>
                </th>
                <th class="min-w-[14rem]">球员</th>
                <th class="min-w-[9rem]">手机号</th>
                <th class="min-w-[6rem]">状态</th>
                <th class="min-w-[10rem]">签到</th>
                <th class="min-w-[6rem]">报名次数</th>
                <th class="min-w-[8rem]">操作时间</th>
                <th class="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="reg in regItems" :key="reg.user_id">
                <td>
                  <label class="flex justify-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="isRegSelected(reg.user_id)"
                      @change="toggleSelectReg(reg.user_id)"
                    />
                  </label>
                </td>
                <td>
                  <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
                      <img
                        v-if="reg.avatar_url"
                        :src="reg.avatar_url"
                        class="w-full h-full object-cover"
                        @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                      />
                      <div v-else class="w-full h-full flex items-center justify-center">
                        <span class="text-sm font-bold">{{
                          (reg.real_name || reg.nickname || '?').charAt(0)
                        }}</span>
                      </div>
                    </div>
                    <div>
                      <p class="font-semibold text-sm leading-none">
                        {{ reg.real_name || reg.nickname }}
                      </p>
                      <p
                        v-if="reg.real_name && reg.nickname !== reg.real_name"
                        class="text-xs text-base-content/50 mt-0.5"
                      >
                        @{{ reg.nickname }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap text-sm font-mono text-base-content/60">
                  {{ reg.phone_number || '—' }}
                </td>
                <td>
                  <span
                    class="badge badge-sm min-w-[3.75rem] justify-center whitespace-nowrap"
                    :class="STAND_BADGE[reg.stand] || 'badge-ghost'"
                  >
                    {{ reg.stand_label }}
                  </span>
                </td>
                <td class="whitespace-nowrap text-xs text-base-content/60">
                  <template v-if="reg.checked_in_at">
                    <span class="badge badge-success badge-sm">已签到</span>
                    <span class="ml-2">{{ formatDateTime(reg.checked_in_at) }}</span>
                    <span v-if="reg.checkin_distance_meters != null" class="ml-2">
                      · {{ reg.checkin_distance_meters }} 米
                    </span>
                  </template>
                  <span v-else>未签到</span>
                </td>
                <td class="whitespace-nowrap text-sm">{{ reg.registration_count }}</td>
                <td class="whitespace-nowrap text-xs text-base-content/50">
                  {{ formatDateTime(reg.operation_time) }}
                </td>
                <td class="text-right">
                  <div class="flex flex-nowrap gap-1 justify-end">
                    <div class="dropdown dropdown-end">
                      <button tabindex="0" class="btn btn-xs btn-outline whitespace-nowrap">
                        更改状态
                      </button>
                      <ul
                        tabindex="0"
                        class="dropdown-content menu menu-sm bg-base-100 rounded-box z-50 w-28 p-1 shadow-lg border border-base-200"
                      >
                        <li v-if="reg.stand !== 1">
                          <a @click="changeRegStatus(reg.user_id, 1)">参加</a>
                        </li>
                        <li v-if="reg.stand !== 2">
                          <a @click="changeRegStatus(reg.user_id, 2)">请假</a>
                        </li>
                        <li v-if="reg.stand !== 3">
                          <a @click="changeRegStatus(reg.user_id, 3)">迟到</a>
                        </li>
                      </ul>
                    </div>
                    <button
                      class="btn btn-xs btn-error btn-outline whitespace-nowrap"
                      @click="confirmCancel(reg)"
                    >
                      取消报名
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ 编辑活动弹窗 ═══ -->
  <dialog ref="editModalRef" class="modal">
    <div class="modal-box max-w-2xl">
      <h3 class="text-lg font-bold mb-4">编辑活动</h3>
      <div v-if="editError" class="alert alert-error py-2.5 mb-4 text-sm">{{ editError }}</div>
      <form @submit.prevent="handleEdit" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-semibold">活动名称</span>
            <input v-model="editForm.name" type="text" class="input input-bordered border-2 h-11" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">地点</span>
            <div class="flex gap-2">
              <input
                v-model="editForm.location"
                type="text"
                class="input input-bordered border-2 h-11 flex-1"
                @input="clearEditLocationCoordinates"
              />
              <button
                type="button"
                class="btn btn-outline h-11 px-4"
                @click="openEditLocationModal"
              >
                地图选择
              </button>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">对阵队伍</span>
            <input
              v-model="editForm.opposing"
              type="text"
              class="input input-bordered border-2 h-11"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">举办日期</span>
            <input
              v-model="editForm.holding_date"
              type="datetime-local"
              class="input input-bordered border-2 h-11"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">报名开始</span>
            <input
              v-model="editForm.start_time"
              type="datetime-local"
              class="input input-bordered border-2 h-11"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">报名截止</span>
            <input
              v-model="editForm.end_time"
              type="datetime-local"
              class="input input-bordered border-2 h-11"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">几人制</span>
            <select
              v-model="editForm.match_format"
              class="select select-bordered border-2 h-11"
              @change="onEditMatchFormatChange"
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
              :value="editForm.players_per_team ?? ''"
              type="number"
              min="1"
              class="input input-bordered border-2 h-11"
              readonly
            />
          </label>
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-semibold">状态</span>
            <select v-model.number="editForm.status" class="select select-bordered border-2 h-11">
              <option :value="0">报名中</option>
              <option :value="1">进行中</option>
              <option :value="2">已结束</option>
              <option :value="3">已取消</option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-semibold">简介</span>
            <textarea
              v-model="editForm.description"
              rows="3"
              class="textarea textarea-bordered border-2 resize-none"
            ></textarea>
          </label>
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="editModalRef?.close()">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="editing">
            <span v-if="editing" class="loading loading-spinner loading-sm"></span>
            保存
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <TencentLocationPickerModal
    v-model:open="editLocationPickerOpen"
    :location-title="editForm.location"
    :location-latitude="editForm.location_latitude"
    :location-longitude="editForm.location_longitude"
    @apply="applyEditSelectedLocation"
  />

  <!-- ═══ 手动报名弹窗 ═══ -->
  <dialog ref="registerModalRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-1">手动报名</h3>
      <p class="text-sm text-base-content/50 mb-4">搜索球员，设置报名状态后提交</p>

      <div class="flex gap-2 mb-4">
        <label class="input input-bordered border-2 flex items-center gap-2 flex-1 h-11">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-base-content/40"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
            />
          </svg>
          <input
            v-model="regSearchKw"
            type="text"
            class="grow bg-transparent outline-none text-sm"
            placeholder="搜索昵称或真实姓名..."
            @input="onRegSearch"
          />
          <span v-if="regSearching" class="loading loading-spinner loading-xs"></span>
        </label>
      </div>

      <div
        v-if="regSearchResults.length > 0"
        class="max-h-52 overflow-y-auto flex flex-col gap-1 border border-base-200 rounded-xl p-2 mb-4"
      >
        <div
          v-for="player in regSearchResults"
          :key="player.id"
          class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
          :class="
            regTarget?.id === player.id ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-base-200'
          "
          @click="regTarget = player"
        >
          <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
            <img
              v-if="player.avatar_url"
              :src="player.avatar_url"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <span class="text-sm font-bold text-base-content/60">{{
                (player.real_name || player.nickname).charAt(0)
              }}</span>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold leading-none">
              {{ player.real_name || player.nickname }}
            </p>
            <p
              v-if="player.nickname !== player.real_name"
              class="text-xs text-base-content/50 mt-0.5"
            >
              @{{ player.nickname }}
            </p>
          </div>
          <svg
            v-if="regTarget?.id === player.id"
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-primary"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
      </div>
      <div
        v-else-if="regSearchKw && !regSearching"
        class="text-center text-sm text-base-content/40 py-4 border border-dashed border-base-300 rounded-xl mb-4"
      >
        未找到匹配球员
      </div>

      <div v-if="regTarget" class="flex items-center gap-3 p-3 bg-base-200 rounded-xl mb-4">
        <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
          <img
            v-if="regTarget.avatar_url"
            :src="regTarget.avatar_url"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="text-sm font-bold">{{
              (regTarget.real_name || regTarget.nickname).charAt(0)
            }}</span>
          </div>
        </div>
        <div class="flex-1">
          <p class="text-sm font-semibold">{{ regTarget.real_name || regTarget.nickname }}</p>
        </div>
        <select v-model.number="regStand" class="select select-bordered select-sm h-9 w-28">
          <option :value="1">参加</option>
          <option :value="2">请假</option>
          <option :value="3">迟到</option>
        </select>
      </div>

      <div v-if="regError" class="alert alert-error py-2 text-sm mb-3">{{ regError }}</div>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" @click="registerModalRef?.close()">取消</button>
        <button
          class="btn btn-primary"
          :disabled="!regTarget || registering"
          @click="handleRegister"
        >
          <span v-if="registering" class="loading loading-spinner loading-sm"></span>
          确认报名
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- ═══ 批量修改报名状态弹窗 ═══ -->
  <dialog ref="batchStandModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">批量修改报名状态</h3>
      <p class="py-4 text-base-content/70">
        已选 <strong>{{ selectedRegIds.length }}</strong> 人，将统一设置为：
      </p>
      <div class="flex flex-col gap-2 mb-6">
        <label
          class="flex items-center gap-3 p-3 rounded-xl border border-base-300 cursor-pointer hover:bg-base-200"
          :class="batchStandValue === 1 ? 'bg-primary/10 border-primary' : ''"
        >
          <input
            type="radio"
            name="batchStand"
            :value="1"
            v-model.number="batchStandValue"
            class="radio radio-primary"
          />
          <span class="badge badge-success badge-sm">参加</span>
        </label>
        <label
          class="flex items-center gap-3 p-3 rounded-xl border border-base-300 cursor-pointer hover:bg-base-200"
          :class="batchStandValue === 2 ? 'bg-primary/10 border-primary' : ''"
        >
          <input
            type="radio"
            name="batchStand"
            :value="2"
            v-model.number="batchStandValue"
            class="radio radio-primary"
          />
          <span class="badge badge-warning badge-sm">请假</span>
        </label>
        <label
          class="flex items-center gap-3 p-3 rounded-xl border border-base-300 cursor-pointer hover:bg-base-200"
          :class="batchStandValue === 3 ? 'bg-primary/10 border-primary' : ''"
        >
          <input
            type="radio"
            name="batchStand"
            :value="3"
            v-model.number="batchStandValue"
            class="radio radio-primary"
          />
          <span class="badge badge-error badge-sm">迟到</span>
        </label>
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="batchStandModalRef?.close()">取消</button>
        <button
          class="btn btn-primary"
          :disabled="batchStandSubmitting"
          @click="handleBatchUpdateStand"
        >
          <span v-if="batchStandSubmitting" class="loading loading-spinner loading-sm"></span>
          确认修改
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- ═══ 取消报名确认 ═══ -->
  <dialog ref="cancelModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认取消报名</h3>
      <p class="py-4 text-base-content/70">
        确定取消
        <strong>{{ cancelTarget ? cancelTarget.real_name || cancelTarget.nickname : '' }}</strong>
        的报名记录？
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="cancelModalRef?.close()">不取消</button>
        <button class="btn btn-error" :disabled="cancelling" @click="handleCancel">
          <span v-if="cancelling" class="loading loading-spinner loading-sm"></span>
          确认取消报名
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from '@/utils/toast'
import TencentLocationPickerModal from '@/components/TencentLocationPickerModal.vue'
import {
  getActivitySettlement,
  settleActivityExpense,
  type ActivitySettlementSummary,
} from '@/services/billing'
import {
  getActivity,
  updateActivity,
  updateActivityStatus,
  listRegistrations,
  adminRegister,
  cancelRegistration,
  batchUpdateStand,
  STATUS_LABEL,
  STATUS_BADGE,
  STAND_BADGE,
  type Activity,
  type RegistrationWithInfo,
  type RegistrationStandCounts,
} from '@/services/activity'
import { listPlayers, type Player } from '@/services/player'
import type { AppliedLocationSelection } from '@/views/activities/location-picker.model'

const route = useRoute()
const activityId = computed(() => route.params.id as string)
const MATCH_FORMAT_OPTIONS = [5, 6, 7, 8, 11] as const
type MatchFormatOption = (typeof MATCH_FORMAT_OPTIONS)[number]

const activity = ref<Activity | null>(null)
const regItems = ref<RegistrationWithInfo[]>([])
const regCounts = ref<RegistrationStandCounts>({
  total: 0,
  unknown: 0,
  attending: 0,
  leave: 0,
  absent: 0,
})
const regTotal = ref(0)
const regPage = ref(1)
const regPageSize = ref(20)
const loading = ref(false)
const regLoading = ref(false)
const loadError = ref('')
const regFilter = ref(-1)
const selectedRegIds = ref<number[]>([])
const settlementSummary = ref<ActivitySettlementSummary | null>(null)
const settlementLoading = ref(false)
const settlementSubmitting = ref(false)
const settlementError = ref('')
const hasSelectedRegs = computed(() => selectedRegIds.value.length > 0)
const settlementForm = reactive({
  total_amount: '',
  description: '赛后 AA 扣费',
})

const toggleSelectReg = (userId: number) => {
  const idx = selectedRegIds.value.indexOf(userId)
  if (idx === -1) selectedRegIds.value.push(userId)
  else selectedRegIds.value.splice(idx, 1)
}

const isRegSelected = (userId: number) => selectedRegIds.value.includes(userId)

const allPageSelected = computed(() => {
  if (regItems.value.length === 0) return false
  return regItems.value.every((r) => selectedRegIds.value.includes(r.user_id))
})

const toggleSelectAll = () => {
  if (allPageSelected.value) {
    regItems.value.forEach((r) => {
      const idx = selectedRegIds.value.indexOf(r.user_id)
      if (idx !== -1) selectedRegIds.value.splice(idx, 1)
    })
  } else {
    regItems.value.forEach((r) => {
      if (!selectedRegIds.value.includes(r.user_id)) selectedRegIds.value.push(r.user_id)
    })
  }
}

const regTotalPages = computed(() => Math.max(1, Math.ceil(regTotal.value / regPageSize.value)))

const filterTabCount = (stand: number) => {
  const c = regCounts.value
  if (stand === -1) return c.total
  if (stand === 0) return c.unknown
  if (stand === 1) return c.attending
  if (stand === 2) return c.leave
  if (stand === 3) return c.absent
  return 0
}

const onRegFilter = async (stand: number) => {
  regFilter.value = stand
  regPage.value = 1
  await fetchRegistrations()
}

const onPageSizeChange = async () => {
  regPage.value = 1
  await fetchRegistrations()
}

const goRegPage = async (p: number) => {
  const next = Math.min(Math.max(1, p), regTotalPages.value)
  if (next === regPage.value) return
  regPage.value = next
  await fetchRegistrations()
}

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const formatTime = (d: string) =>
  new Date(d).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const formatCurrency = (value?: string | null) => {
  if (!value) return '—'
  const amount = Number(value)
  if (Number.isNaN(amount)) return value
  return `¥${amount.toFixed(2)}`
}

const batchLabel = (batch: ActivitySettlementSummary['history'][number]) => {
  if (batch.operation_type === 'settle') return '结算'
  if (batch.operation_type === 'reverse') {
    return batch.reversal_of_batch_no ? `冲正第 ${batch.reversal_of_batch_no} 批` : '冲正'
  }
  return batch.operation_type
}

const activityCheckinTeamIds = computed(() =>
  [activity.value?.home_team_id, activity.value?.away_team_id].filter(
    (teamId): teamId is string => !!teamId,
  ),
)

const teamCheckinConfig = (teamId: string) =>
  activity.value?.team_checkin_configs.find((item) => item.team_id === teamId) ?? null

const checkinTeamLabel = (teamId: string) => {
  if (teamId === activity.value?.home_team_id) return '主队签到'
  if (teamId === activity.value?.away_team_id) return '客队签到'
  return '球队签到'
}

const registrationProgress = computed(() => {
  const upperLimit = activity.value?.players_per_team ?? null
  if (!upperLimit || upperLimit < 1) return null

  const matchedFormat = MATCH_FORMAT_OPTIONS.find(
    (option) => playersPerTeamFromMatchFormat(option) === upperLimit,
  )
  if (!matchedFormat) return null

  const requiredCount = matchedFormat
  const attendingCount = regCounts.value.attending
  const extraCapacity = Math.max(upperLimit - requiredCount, 0)
  const reachedRequirement = attendingCount >= requiredCount

  const displayPercent = reachedRequirement
    ? extraCapacity === 0
      ? 100
      : Math.round(100 + (Math.max(attendingCount - requiredCount, 0) / extraCapacity) * 100)
    : Math.round((attendingCount / requiredCount) * 100)

  return {
    matchFormat: matchedFormat,
    upperLimit,
    requiredCount,
    reachedRequirement,
    displayPercent: Math.max(0, displayPercent),
    fillWidth: Math.min((attendingCount / upperLimit) * 100, 100),
    requiredMarker: Number(((requiredCount / upperLimit) * 100).toFixed(2)),
  }
})

const settlementAmountValue = computed(() => Number(settlementForm.total_amount))

const settlementPreviewFee = computed(() => {
  const attendingCount = settlementSummary.value?.attending_user_count ?? 0
  const amount = settlementAmountValue.value
  if (attendingCount <= 0 || !Number.isFinite(amount) || amount <= 0) {
    return '待输入总金额后自动计算'
  }
  return `¥${(amount / attendingCount).toFixed(2)} / 人`
})

const canSubmitSettlement = computed(() => {
  if (activity.value?.status !== 2) return false
  if ((settlementSummary.value?.attending_user_count ?? 0) <= 0) return false
  return Number.isFinite(settlementAmountValue.value) && settlementAmountValue.value > 0
})

const fetchActivity = async () => {
  const res = await getActivity(activityId.value)
  activity.value = res
}

const fetchSettlementSummary = async () => {
  settlementLoading.value = true
  settlementError.value = ''
  try {
    const res = await getActivitySettlement(activityId.value)
    settlementSummary.value = res
    if (!settlementForm.total_amount && res.total_amount) {
      settlementForm.total_amount = res.total_amount
    }
    if ((!settlementForm.description || settlementForm.description === '赛后 AA 扣费') && res.description) {
      settlementForm.description = res.description
    }
  } catch (e: unknown) {
    settlementError.value = (e as Error).message || '结算信息加载失败'
  } finally {
    settlementLoading.value = false
  }
}

const fetchRegistrations = async () => {
  regLoading.value = true
  try {
    const res = await listRegistrations(activityId.value, {
      page: regPage.value,
      page_size: regPageSize.value,
      stand: regFilter.value,
    })
    regItems.value = res.items
    regTotal.value = res.total
    regCounts.value = res.counts
    regPage.value = res.page
    selectedRegIds.value = []
    const maxPage = Math.max(1, Math.ceil(res.total / res.page_size))
    if (res.items.length === 0 && res.total > 0 && res.page > maxPage) {
      regPage.value = maxPage
      await fetchRegistrations()
      return
    }
  } finally {
    regLoading.value = false
  }
}

const fetchAll = async () => {
  loading.value = true
  loadError.value = ''
  try {
    await Promise.all([fetchActivity(), fetchRegistrations(), fetchSettlementSummary()])
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ── 更改报名状态 ──
const changeRegStatus = async (userId: number, stand: number) => {
  try {
    await adminRegister(activityId.value, userId, stand)
    await fetchRegistrations()
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  }
}

// ── 编辑活动 ──
const editModalRef = ref<HTMLDialogElement>()
const editLocationPickerOpen = ref(false)
const editing = ref(false)
const editError = ref('')
const editForm = reactive({
  name: '',
  location: '',
  location_latitude: null as number | null,
  location_longitude: null as number | null,
  opposing: '',
  holding_date: '',
  start_time: '',
  end_time: '',
  description: '',
  players_per_team: null as number | null,
  match_format: '' as '' | `${MatchFormatOption}`,
  status: 0,
})

const toLocal = (iso: string) => (iso ? iso.slice(0, 16) : '')

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

const onEditMatchFormatChange = () => {
  editForm.players_per_team = editForm.match_format
    ? playersPerTeamFromMatchFormat(Number(editForm.match_format) as MatchFormatOption)
    : null
}

const clearEditLocationCoordinates = () => {
  editForm.location_latitude = null
  editForm.location_longitude = null
}

const openEditModal = () => {
  if (!activity.value) return
  const a = activity.value
  Object.assign(editForm, {
    name: a.name,
    location: a.location,
    location_latitude: a.location_latitude,
    location_longitude: a.location_longitude,
    opposing: a.opposing || '',
    holding_date: toLocal(a.holding_date),
    start_time: toLocal(a.start_time),
    end_time: toLocal(a.end_time),
    description: a.description || '',
    players_per_team: a.players_per_team ?? null,
    match_format: inferMatchFormat(a.players_per_team),
    status: a.status,
  })
  editError.value = ''
  editModalRef.value?.showModal()
}

const openEditLocationModal = () => {
  editLocationPickerOpen.value = true
}

const applyEditSelectedLocation = (selection: AppliedLocationSelection) => {
  editForm.location = selection.title
  editForm.location_latitude = selection.locationLatitude
  editForm.location_longitude = selection.locationLongitude
  editLocationPickerOpen.value = false
}

const handleEdit = async () => {
  editing.value = true
  editError.value = ''
  try {
    await updateActivity(activityId.value, {
      name: editForm.name || undefined,
      location: editForm.location || undefined,
      location_latitude: editForm.location_latitude,
      location_longitude: editForm.location_longitude,
      opposing: editForm.opposing || null,
      holding_date: editForm.holding_date ? editForm.holding_date + ':00' : undefined,
      start_time: editForm.start_time ? editForm.start_time + ':00' : undefined,
      end_time: editForm.end_time ? editForm.end_time + ':00' : undefined,
      description: editForm.description || null,
      players_per_team: editForm.players_per_team ?? null,
    })
    if (activity.value && editForm.status !== activity.value.status) {
      await updateActivityStatus(activityId.value, editForm.status)
    }
    await fetchAll()
    editModalRef.value?.close()
  } catch (e: unknown) {
    editError.value = (e as Error).message || '保存失败'
  } finally {
    editing.value = false
  }
}

// ── 手动报名 ──
const registerModalRef = ref<HTMLDialogElement>()
const regSearchKw = ref('')
const regSearchResults = ref<Player[]>([])
const regSearching = ref(false)
const regTarget = ref<Player | null>(null)
const regStand = ref(1)
const regError = ref('')
const registering = ref(false)
let regSearchTimer: ReturnType<typeof setTimeout>

const onRegSearch = () => {
  clearTimeout(regSearchTimer)
  if (!regSearchKw.value.trim()) {
    regSearchResults.value = []
    return
  }
  regSearchTimer = setTimeout(async () => {
    regSearching.value = true
    try {
      const res = await listPlayers({ keyword: regSearchKw.value.trim(), page: 1, page_size: 20 })
      regSearchResults.value = res.items
    } catch {
      regSearchResults.value = []
    } finally {
      regSearching.value = false
    }
  }, 300)
}

const openRegisterModal = () => {
  regSearchKw.value = ''
  regSearchResults.value = []
  regTarget.value = null
  regStand.value = 1
  regError.value = ''
  registerModalRef.value?.showModal()
}

const handleRegister = async () => {
  if (!regTarget.value) return
  registering.value = true
  regError.value = ''
  try {
    await adminRegister(activityId.value, regTarget.value.id, regStand.value)
    await fetchRegistrations()
    registerModalRef.value?.close()
  } catch (e: unknown) {
    regError.value = (e as Error).message || '报名失败'
  } finally {
    registering.value = false
  }
}

// ── 取消报名 ──
const cancelModalRef = ref<HTMLDialogElement>()
const cancelTarget = ref<RegistrationWithInfo | null>(null)
const cancelling = ref(false)

const confirmCancel = (reg: RegistrationWithInfo) => {
  cancelTarget.value = reg
  cancelModalRef.value?.showModal()
}

const handleCancel = async () => {
  if (!cancelTarget.value) return
  cancelling.value = true
  try {
    await cancelRegistration(activityId.value, cancelTarget.value.user_id)
    await fetchRegistrations()
    cancelModalRef.value?.close()
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  } finally {
    cancelling.value = false
  }
}

// ── 批量修改报名状态 ──
const batchStandModalRef = ref<HTMLDialogElement>()
const batchStandValue = ref<number>(1)
const batchStandSubmitting = ref(false)

const openBatchStandModal = () => {
  batchStandValue.value = 1
  batchStandSubmitting.value = false
  batchStandModalRef.value?.showModal()
}

const handleBatchUpdateStand = async () => {
  if (selectedRegIds.value.length === 0) return
  batchStandSubmitting.value = true
  try {
    await batchUpdateStand(activityId.value, selectedRegIds.value, batchStandValue.value)
    await fetchRegistrations()
    batchStandModalRef.value?.close()
  } catch (e: unknown) {
    toast.error((e as Error).message || '批量修改失败')
  } finally {
    batchStandSubmitting.value = false
  }
}

const handleSettlement = async () => {
  if (!canSubmitSettlement.value) return

  settlementSubmitting.value = true
  settlementError.value = ''
  try {
    const res = await settleActivityExpense(activityId.value, {
      total_amount: settlementAmountValue.value,
      description: settlementForm.description.trim() || undefined,
    })
    settlementSummary.value = res
    settlementForm.total_amount = res.total_amount ?? settlementForm.total_amount
    settlementForm.description = res.description ?? settlementForm.description
    toast.success(res.current_batch_no ? `当前有效结算批次已更新为第 ${res.current_batch_no} 批` : '本场比赛费用已完成结算')
  } catch (e: unknown) {
    settlementError.value = (e as Error).message || '结算失败'
  } finally {
    settlementSubmitting.value = false
  }
}

onMounted(fetchAll)
</script>
