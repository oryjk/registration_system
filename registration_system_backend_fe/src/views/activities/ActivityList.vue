<template>
  <div class="flex flex-col gap-6">
    <section
      class="sticky top-16 z-10 -mx-4 flex flex-col gap-4 bg-base-200 px-4 pb-3 pt-4 lg:-mx-6 lg:px-6"
    >
      <!-- 标题 -->
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold">比赛报名</h2>
          <p class="mt-0.5 text-sm text-base-content/60">
            查看有球队参与的比赛，管理每支球队内部球员报名状态
          </p>
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
          新建比赛
        </button>
      </div>

      <!-- 统计（全库汇总，与列表分页无关） -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
          <div class="stat-title text-xs">比赛总数</div>
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
      <p>暂无比赛</p>
    </div>

    <!-- 比赛列表 -->
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
                    比赛：{{ formatDateTime(activity.holding_date) }}
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
                  <span v-if="activity.team_registration_count" class="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"
                      />
                    </svg>
                    球队报名：{{ activity.team_registration_count }} 人
                  </span>
                </div>
                <div
                  class="mt-2 grid grid-cols-1 gap-2 text-xs text-base-content/60 md:grid-cols-2 xl:grid-cols-4"
                >
                  <div class="rounded-lg bg-base-200/70 px-3 py-2">
                    <p class="text-base-content/45">开始报名</p>
                    <p class="mt-0.5 font-medium text-base-content">
                      {{ formatDateTime(activity.start_time) }}
                    </p>
                  </div>
                  <div class="rounded-lg bg-base-200/70 px-3 py-2">
                    <p class="text-base-content/45">结束报名</p>
                    <p class="mt-0.5 font-medium text-base-content">
                      {{ formatDateTime(activity.end_time) }}
                    </p>
                  </div>
                  <div
                    class="rounded-lg px-3 py-2"
                    :class="
                      isRegistrationClosed(activity.end_time)
                        ? 'bg-base-200/70'
                        : 'bg-warning/10 text-warning'
                    "
                  >
                    <p class="text-current/70">结束报名倒计时</p>
                    <p class="mt-0.5 font-semibold tabular-nums">
                      {{ formatRegistrationCountdown(activity.end_time) }}
                    </p>
                  </div>
                  <div
                    class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-base-200/70 px-3 py-2"
                  >
                    <span class="flex items-center gap-1.5">
                      <span
                        class="h-3.5 w-3.5 rounded-full border border-base-300"
                        :style="{ backgroundColor: jerseyColorValue(activity.color) }"
                      ></span>
                      主队 {{ jerseyColorLabel(activity.color) }}
                    </span>
                    <span class="flex items-center gap-1.5">
                      <span
                        class="h-3.5 w-3.5 rounded-full border border-base-300"
                        :style="{ backgroundColor: jerseyColorValue(activity.opposing_color) }"
                      ></span>
                      客队 {{ jerseyColorLabel(activity.opposing_color) }}
                    </span>
                  </div>
                </div>
                <div
                  class="activity-registration-preview mt-3 rounded-xl border border-base-300/70 bg-base-200/40 px-3 py-2"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p class="text-sm font-bold text-base-content">当前报名情况</p>
                      <p class="mt-0.5 text-xs text-base-content/50">
                        共 {{ activity.registration_preview.counts.total }} 人 ·
                        参加 {{ activity.registration_preview.counts.attending }} ·
                        请假 {{ activity.registration_preview.counts.leave }} ·
                        未表态 {{ activity.registration_preview.counts.unknown }}
                      </p>
                    </div>
                    <span
                      class="badge badge-sm"
                      :class="
                        activity.registration_preview.counts.attending > 0
                          ? 'badge-success badge-outline'
                          : 'badge-ghost'
                      "
                    >
                      已报名 {{ activity.registration_preview.counts.attending }}
                    </span>
                  </div>

                  <div
                    v-if="activity.registration_preview.counts.total > 0"
                    class="mt-2 space-y-1.5"
                  >
                    <div
                      v-for="group in registrationPreviewGroups(activity)"
                      :key="group.stand"
                      class="flex min-h-9 items-start gap-3 rounded-lg bg-base-100/80 px-2.5 py-1.5"
                    >
                      <div class="flex w-16 flex-shrink-0 items-baseline justify-between gap-1 pt-1">
                        <span class="text-xs font-semibold text-base-content/70">
                          {{ group.label }}
                        </span>
                        <span class="text-xs tabular-nums text-base-content/45">
                          {{ group.total }}
                        </span>
                      </div>
                      <div v-if="group.members.length > 0" class="flex min-w-0 flex-1 flex-wrap gap-1.5">
                        <div
                          v-for="member in group.members"
                          :key="`${activity.id}-${group.stand}-${member.user_id}`"
                          class="flex min-w-0 max-w-[9rem] items-center gap-1.5 rounded-full border border-base-300/70 bg-base-100 py-0.5 pl-0.5 pr-2"
                        >
                          <div
                            class="activity-preview-avatar h-6 w-6 flex-shrink-0 overflow-hidden rounded-full bg-base-300"
                          >
                            <img
                              v-if="member.avatar_url"
                              :src="member.avatar_url"
                              class="h-full w-full object-cover"
                              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                            />
                            <div
                              v-else
                              class="flex h-full w-full items-center justify-center text-xs font-bold"
                            >
                              {{ previewMemberName(member).charAt(0) || '?' }}
                            </div>
                          </div>
                          <span class="truncate text-xs font-medium text-base-content/80">
                            {{ previewMemberName(member) }}
                          </span>
                        </div>
                        <span
                          v-if="group.total > group.members.length"
                          class="inline-flex h-7 items-center rounded-full bg-base-300/70 px-2.5 text-xs font-semibold text-base-content/60"
                        >
                          +{{ group.total - group.members.length }}
                        </span>
                      </div>
                      <p v-else class="pt-1 text-xs text-base-content/35">暂无队员</p>
                    </div>
                  </div>
                  <p v-else class="mt-3 text-xs text-base-content/40">暂无队员报名状态。</p>
                </div>
              </div>
            </div>
            <div
              class="activity-row-actions flex w-32 flex-shrink-0 flex-col items-stretch gap-2"
              @click.stop
            >
              <button type="button" class="btn btn-xs btn-outline" @click="goDetail(activity.id)">
                查看
              </button>
              <button type="button" class="btn btn-xs btn-outline" @click="openEditModal(activity)">
                编辑
              </button>
              <template v-if="activity.status === 0">
                <button
                  type="button"
                  class="btn btn-xs btn-success btn-outline"
                  @click="changeStatus(activity.id, 2)"
                >
                  设为已结束
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-warning btn-outline"
                  @click="changeStatus(activity.id, 3)"
                >
                  设为已取消
                </button>
              </template>
              <button
                type="button"
                class="btn btn-xs btn-error btn-outline"
                @click="confirmDelete(activity)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ 新建/编辑弹窗 ═══ -->
  <dialog ref="formModalRef" class="modal">
    <div class="modal-box max-w-3xl">
      <h3 class="text-lg font-bold mb-4">{{ editTarget ? '编辑比赛' : '新建比赛' }}</h3>
      <div v-if="formError" class="alert alert-error py-2.5 mb-4 text-sm">{{ formError }}</div>
      <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-semibold">比赛名称 <span class="text-error">*</span></span>
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
            <span class="text-sm font-semibold">主队 <span class="text-error">*</span></span>
            <select
              v-model="form.home_team_id"
              required
              class="select select-bordered border-2 h-11"
            >
              <option :value="null" disabled>请选择主队</option>
              <option v-for="team in teamOptions" :key="team.id" :value="team.id">
                {{ team.name }}
              </option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">客队</span>
            <select v-model="form.away_team_id" class="select select-bordered border-2 h-11">
              <option :value="null">不设置</option>
              <option v-for="team in teamOptions" :key="team.id" :value="team.id">
                {{ team.name }}
              </option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">比赛类型</span>
            <select v-model="form.match_kind" class="select select-bordered border-2 h-11">
              <option value="external">外部对阵</option>
              <option value="internal">队内训练</option>
            </select>
          </label>
          <div class="activity-jersey-color-row grid gap-4 sm:col-span-2 sm:grid-cols-2">
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
          </div>
          <fieldset
            class="sm:col-span-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm"
          >
            <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <legend class="text-base font-bold text-base-content">比赛与报名时间</legend>
                <p class="mt-1 text-xs text-base-content/55">
                  先确定比赛开始时间，再在同一区块内选择报名开放和截止时间。
                </p>
              </div>
              <span class="badge badge-primary badge-outline mt-1 w-fit">时间必填</span>
            </div>
            <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.7fr]">
              <label
                class="flex flex-col gap-2 rounded-2xl border border-base-300 bg-base-100 p-3"
              >
                <span class="text-sm font-semibold"
                  >比赛开始时间 <span class="text-error">*</span></span
                >
                <input
                  v-model="form.holding_date"
                  type="datetime-local"
                  required
                  class="input input-bordered input-lg h-14 border-2 text-base font-semibold"
                />
              </label>
              <div class="rounded-2xl border border-base-300 bg-base-100 p-3">
                <div class="mb-2 flex items-center justify-between gap-3">
                  <span class="text-sm font-semibold"
                    >报名时间范围 <span class="text-error">*</span></span
                  >
                  <span class="text-xs text-base-content/50">开始和截止联动选择</span>
                </div>
                <div class="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
                  <label class="flex flex-col gap-1.5">
                    <span class="text-xs font-medium text-base-content/60">报名开始</span>
                    <input
                      v-model="form.start_time"
                      type="datetime-local"
                      required
                      :max="form.end_time || undefined"
                      class="input input-bordered input-lg h-14 border-2 text-base font-semibold"
                      @change="onRegistrationStartChange"
                    />
                  </label>
                  <div class="hidden pb-4 text-base-content/35 md:block">至</div>
                  <label class="flex flex-col gap-1.5">
                    <span class="text-xs font-medium text-base-content/60">报名截止</span>
                    <input
                      v-model="form.end_time"
                      type="datetime-local"
                      required
                      :min="form.start_time || undefined"
                      :max="form.holding_date || undefined"
                      class="input input-bordered input-lg h-14 border-2 text-base font-semibold"
                      @change="onRegistrationEndChange"
                    />
                  </label>
                </div>
                <p class="mt-2 text-xs text-base-content/50">
                  {{ registrationTimeHint }}
                </p>
              </div>
            </div>
          </fieldset>
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
              v-model.number="form.team_capacity_limit"
              type="number"
              min="1"
              class="input input-bordered border-2 h-11"
              placeholder="选择几人制后自动计算"
            />
          </label>
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-sm font-semibold">简介</span>
            <textarea
              v-model="form.description"
              rows="3"
              class="textarea textarea-bordered border-2 resize-none"
              placeholder="比赛说明（可选）"
            ></textarea>
          </label>
          <fieldset class="sm:col-span-2 rounded-xl border border-base-300 bg-base-200/40 p-4">
            <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <legend class="text-sm font-semibold">球队签到配置</legend>
                <p class="mt-1 text-xs text-base-content/50">
                  对已选择的主客队生成签到规则，创建后也可在详情页继续调整。
                </p>
              </div>
              <label class="flex cursor-pointer items-center gap-2 text-sm">
                <span>启用签到</span>
                <input
                  v-model="form.checkin_enabled"
                  type="checkbox"
                  class="toggle toggle-primary toggle-sm"
                />
              </label>
            </div>
            <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label class="flex flex-col gap-1.5">
                <span class="text-xs font-medium text-base-content/60">签到半径（米）</span>
                <input
                  v-model.number="form.checkin_radius_meters"
                  type="number"
                  min="20"
                  max="1000"
                  class="input input-bordered h-10"
                  :disabled="!form.checkin_enabled"
                />
              </label>
              <label class="flex flex-col gap-1.5">
                <span class="text-xs font-medium text-base-content/60">提前开放（分钟）</span>
                <input
                  v-model.number="form.checkin_open_minutes_before"
                  type="number"
                  min="0"
                  max="1440"
                  class="input input-bordered h-10"
                  :disabled="!form.checkin_enabled"
                />
              </label>
              <label class="flex flex-col gap-1.5">
                <span class="text-xs font-medium text-base-content/60">延后关闭（分钟）</span>
                <input
                  v-model.number="form.checkin_close_minutes_after"
                  type="number"
                  min="0"
                  max="1440"
                  class="input input-bordered h-10"
                  :disabled="!form.checkin_enabled"
                />
              </label>
            </div>
          </fieldset>
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
        确定删除比赛 <strong>{{ deletingActivity?.name }}</strong
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
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
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
  type ActivityRegistrationPreviewMember,
  type ActivityStatusCounts,
  type CreateActivityPayload,
} from '@/services/activity'
import { adminListTeams, type TeamSummary } from '@/services/team'
import type { AppliedLocationSelection } from '@/views/activities/location-picker.model'
import {
  COMMON_JERSEY_COLORS,
  normalizeTeamCapacityLimit,
  normalizeHexColor,
  shouldRefreshDefaultTeamCapacityLimit,
  type ActivityColorField,
} from '@/views/activities/activity-detail.model'

const router = useRouter()
const route = useRoute()
const MATCH_FORMAT_OPTIONS = [5, 6, 7, 8, 11] as const
type MatchFormatOption = (typeof MATCH_FORMAT_OPTIONS)[number]
const DEFAULT_TEAM_CAPACITY_MULTIPLIER = 2
const DEFAULT_ACTIVITY_STATUS_FILTER = 0
const DEFAULT_LIST_PAGE = 1
const DEFAULT_LIST_PAGE_SIZE = 20
const ACTIVITY_STATUS_FILTERS = [-1, 0, 1, 2, 3] as const
const LIST_PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const activityItems = ref<Activity[]>([])
const teamOptions = ref<TeamSummary[]>([])
const listCounts = ref<ActivityStatusCounts>({
  total: 0,
  registering: 0,
  ongoing: 0,
  ended: 0,
  cancelled: 0,
})
const listTotal = ref(0)
const listPage = ref(DEFAULT_LIST_PAGE)
const listPageSize = ref(DEFAULT_LIST_PAGE_SIZE)
const loading = ref(false)
const filterStatus = ref(DEFAULT_ACTIVITY_STATUS_FILTER)
const nowTick = ref(Date.now())
let countdownTimer: ReturnType<typeof setInterval> | null = null

const listTotalPages = computed(() => Math.max(1, Math.ceil(listTotal.value / listPageSize.value)))

const routeQueryValue = (value: unknown) => (Array.isArray(value) ? value[0] : value)

const parseRouteInt = (value: unknown, fallback: number) => {
  const parsed = Number.parseInt(String(routeQueryValue(value) ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeRouteStatus = (value: unknown) => {
  const parsed = parseRouteInt(value, DEFAULT_ACTIVITY_STATUS_FILTER)
  return ACTIVITY_STATUS_FILTERS.includes(parsed as (typeof ACTIVITY_STATUS_FILTERS)[number])
    ? parsed
    : DEFAULT_ACTIVITY_STATUS_FILTER
}

const normalizeRoutePage = (value: unknown) => Math.max(1, parseRouteInt(value, DEFAULT_LIST_PAGE))

const normalizeRoutePageSize = (value: unknown) => {
  const parsed = parseRouteInt(value, DEFAULT_LIST_PAGE_SIZE)
  return LIST_PAGE_SIZE_OPTIONS.includes(parsed as (typeof LIST_PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : DEFAULT_LIST_PAGE_SIZE
}

const listRouteQuery = (): LocationQueryRaw => ({
  ...route.query,
  status: String(filterStatus.value),
  page: String(listPage.value),
  page_size: String(listPageSize.value),
})

const isSameListRouteQuery = () =>
  routeQueryValue(route.query.status) === String(filterStatus.value) &&
  routeQueryValue(route.query.page) === String(listPage.value) &&
  routeQueryValue(route.query.page_size) === String(listPageSize.value)

const applyListRouteQuery = () => {
  filterStatus.value = normalizeRouteStatus(route.query.status)
  listPage.value = normalizeRoutePage(route.query.page)
  listPageSize.value = normalizeRoutePageSize(route.query.page_size)
}

const syncListStateToRoute = async () => {
  if (isSameListRouteQuery()) return
  await router.replace({ query: listRouteQuery() })
}

const filterTabCount = (status: number) => {
  const c = listCounts.value
  if (status === -1) return c.total
  if (status === 0) return c.registering
  if (status === 1) return c.ongoing
  if (status === 2) return c.ended
  if (status === 3) return c.cancelled
  return 0
}

const previewMemberName = (member: ActivityRegistrationPreviewMember) =>
  member.real_name || member.nickname || `用户 ${member.user_id}`

const previewMembersByStand = (activity: Activity, stand: number) =>
  activity.registration_preview.members.filter((member) => member.stand === stand)

const registrationPreviewGroups = (activity: Activity) => [
  {
    stand: 1,
    label: '已报名',
    total: activity.registration_preview.counts.attending,
    members: previewMembersByStand(activity, 1),
  },
  {
    stand: 2,
    label: '请假',
    total: activity.registration_preview.counts.leave,
    members: previewMembersByStand(activity, 2),
  },
  {
    stand: 0,
    label: '未表态',
    total: activity.registration_preview.counts.unknown,
    members: previewMembersByStand(activity, 0),
  },
]

const onFilterStatus = async (status: number) => {
  filterStatus.value = status
  listPage.value = 1
  await syncListStateToRoute()
  await fetchList()
}

const onListPageSizeChange = async () => {
  listPage.value = 1
  await syncListStateToRoute()
  await fetchList()
}

const goListPage = async (p: number) => {
  const next = Math.min(Math.max(1, p), listTotalPages.value)
  if (next === listPage.value) return
  listPage.value = next
  await syncListStateToRoute()
  await fetchList()
}

const goDetail = (id: string) => router.push(`/activities/${id}`)

const formatMonth = (d: string) => new Date(d).toLocaleDateString('zh-CN', { month: 'short' })
const formatDay = (d: string) => new Date(d).getDate().toString().padStart(2, '0')
const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const isRegistrationClosed = (endTime: string) => new Date(endTime).getTime() <= nowTick.value

const formatRegistrationCountdown = (endTime: string) => {
  const distance = new Date(endTime).getTime() - nowTick.value
  if (distance <= 0) return '已截止'

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const days = Math.floor(distance / day)
  const hours = Math.floor((distance % day) / hour)
  const minutes = Math.floor((distance % hour) / minute)

  if (days > 0) return `${days}天 ${hours}小时`
  if (hours > 0) return `${hours}小时 ${minutes}分钟`
  return `${Math.max(minutes, 1)}分钟`
}

const jerseyColorValue = (color: string | null) => color || 'transparent'

const jerseyColorLabel = (color: string | null) => color || '未设置'

const registrationTimeHint = computed(() => {
  if (!form.start_time || !form.end_time) return '报名开始和截止时间需要一起填写。'
  const start = new Date(form.start_time).getTime()
  const end = new Date(form.end_time).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '请选择有效的报名时间范围。'
  if (end <= start) return '报名截止时间必须晚于报名开始时间。'
  if (form.holding_date && end > new Date(form.holding_date).getTime()) {
    return '报名截止时间不能晚于比赛开始时间。'
  }
  return '报名窗口已设置，创建后会按该时间开放和截止报名。'
})

const onRegistrationStartChange = () => {
  if (form.start_time && form.end_time && form.end_time < form.start_time) {
    form.end_time = form.start_time
  }
}

const onRegistrationEndChange = () => {
  if (form.start_time && form.end_time && form.end_time < form.start_time) {
    form.start_time = form.end_time
  }
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
      registration_scope: 'team',
    })
    activityItems.value = res.items
    listTotal.value = res.total
    listCounts.value = res.counts
    listPage.value = res.page
    const maxPage = Math.max(1, Math.ceil(res.total / res.page_size))
    if (res.items.length === 0 && res.total > 0 && res.page > maxPage) {
      listPage.value = maxPage
      await syncListStateToRoute()
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
  home_team_id: null as number | null,
  away_team_id: null as number | null,
  match_kind: 'external' as 'external' | 'internal',
  color: '',
  opposing_color: '',
  holding_date: '',
  start_time: '',
  end_time: '',
  description: '',
  match_format: '' as '' | `${MatchFormatOption}`,
  players_per_team: null as number | null,
  team_capacity_limit: null as number | null,
  checkin_enabled: false,
  checkin_radius_meters: 150,
  checkin_open_minutes_before: 60,
  checkin_close_minutes_after: 30,
})

const inferMatchFormat = (
  playersPerTeam: number | null | undefined,
): '' | `${MatchFormatOption}` => {
  if (playersPerTeam == null) return ''
  return MATCH_FORMAT_OPTIONS.includes(playersPerTeam as MatchFormatOption)
    ? (String(playersPerTeam) as `${MatchFormatOption}`)
    : ''
}

const onMatchFormatChange = (target: {
  match_format: '' | `${MatchFormatOption}`
  players_per_team: number | null
  team_capacity_limit: number | string | null
}) => {
  const shouldRefreshLimit = shouldRefreshDefaultTeamCapacityLimit(
    target.team_capacity_limit,
    target.players_per_team,
  )

  if (!target.match_format) {
    target.players_per_team = null
    target.team_capacity_limit = null
    return
  }

  target.players_per_team = Number(target.match_format)
  if (shouldRefreshLimit) {
    target.team_capacity_limit = target.players_per_team * DEFAULT_TEAM_CAPACITY_MULTIPLIER
  }
}

const selectColor = (field: ActivityColorField, color: string) => {
  form[field] = normalizeHexColor(color)
}

const clearColor = (field: ActivityColorField) => {
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
    home_team_id: null,
    away_team_id: null,
    match_kind: 'external',
    color: '',
    opposing_color: '',
    holding_date: '',
    start_time: '',
    end_time: '',
    description: '',
    match_format: '',
    players_per_team: null,
    team_capacity_limit: null,
    checkin_enabled: false,
    checkin_radius_meters: 150,
    checkin_open_minutes_before: 60,
    checkin_close_minutes_after: 30,
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
    home_team_id: activity.home_team_id,
    away_team_id: activity.away_team_id,
    match_kind: activity.match_kind || 'external',
    color: normalizeHexColor(activity.color || ''),
    opposing_color: normalizeHexColor(activity.opposing_color || ''),
    holding_date: toLocal(activity.holding_date),
    start_time: toLocal(activity.start_time),
    end_time: toLocal(activity.end_time),
    description: activity.description || '',
    match_format: inferMatchFormat(activity.players_per_team),
    players_per_team: activity.players_per_team ?? null,
    team_capacity_limit:
      activity.team_capacity_limit ??
      (activity.players_per_team == null
        ? null
        : activity.players_per_team * DEFAULT_TEAM_CAPACITY_MULTIPLIER),
    checkin_enabled: activity.team_checkin_configs.some((item) => item.enabled),
    checkin_radius_meters: activity.team_checkin_configs[0]?.radius_meters ?? 150,
    checkin_open_minutes_before: activity.team_checkin_configs[0]?.open_minutes_before ?? 60,
    checkin_close_minutes_after: activity.team_checkin_configs[0]?.close_minutes_after ?? 30,
  })
  formError.value = ''
  formModalRef.value?.showModal()
}

const handleSubmit = async () => {
  submitting.value = true
  formError.value = ''
  try {
    if (
      form.home_team_id !== null &&
      form.away_team_id !== null &&
      form.home_team_id === form.away_team_id
    ) {
      formError.value = '主队和客队不能选择同一支球队'
      return
    }
    if (form.home_team_id === null) {
      formError.value = '请选择主队，比赛报名列表只展示已关联球队的比赛'
      return
    }
    if (form.start_time && form.end_time && form.end_time <= form.start_time) {
      formError.value = '报名截止时间必须晚于报名开始时间'
      return
    }
    if (form.holding_date && form.end_time && form.end_time > form.holding_date) {
      formError.value = '报名截止时间不能晚于比赛开始时间'
      return
    }
    const selectedTeamIds = [form.home_team_id, form.away_team_id].filter(
      (teamId, index, teamIds): teamId is number =>
        typeof teamId === 'number' && teamIds.indexOf(teamId) === index,
    )
    const payload: CreateActivityPayload = {
      name: form.name,
      location: form.location,
      location_latitude: form.location_latitude ?? undefined,
      location_longitude: form.location_longitude ?? undefined,
      holding_date: form.holding_date ? form.holding_date + ':00' : '',
      start_time: form.start_time ? form.start_time + ':00' : '',
      end_time: form.end_time ? form.end_time + ':00' : '',
      opposing: form.opposing || undefined,
      home_team_id: form.home_team_id ?? undefined,
      away_team_id: form.away_team_id ?? undefined,
      match_kind: form.match_kind,
      color: form.color || undefined,
      opposing_color: form.opposing_color || undefined,
      description: form.description || undefined,
      players_per_team: form.players_per_team ?? undefined,
      team_capacity_limit: normalizeTeamCapacityLimit(form.team_capacity_limit) ?? undefined,
    }
    if (!editTarget.value && selectedTeamIds.length > 0) {
      payload.team_checkin_configs = selectedTeamIds.map((teamId) => ({
        team_id: teamId,
        enabled: form.checkin_enabled,
        radius_meters: form.checkin_radius_meters,
        open_minutes_before: form.checkin_open_minutes_before,
        close_minutes_after: form.checkin_close_minutes_after,
      }))
    }
    if (editTarget.value) {
      await updateActivity(editTarget.value.id, {
        ...payload,
        opposing: form.opposing || null,
        home_team_id: form.home_team_id,
        away_team_id: form.away_team_id,
        color: form.color || null,
        opposing_color: form.opposing_color || null,
        description: form.description || null,
        players_per_team: form.players_per_team ?? null,
        team_capacity_limit: normalizeTeamCapacityLimit(form.team_capacity_limit),
      })
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

onMounted(() => {
  applyListRouteQuery()
  void syncListStateToRoute()
  countdownTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 60 * 1000)
  adminListTeams(true)
    .then((teams) => {
      teamOptions.value = teams
    })
    .catch((e: unknown) => {
      toast.error((e as Error).message || '球队列表加载失败')
    })
  fetchList()
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})
</script>
