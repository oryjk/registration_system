<template>
  <div class="flex flex-col gap-6">
    <section
      class="sticky top-16 z-10 -mx-4 flex flex-col gap-4 bg-base-200 px-4 pb-4 pt-4 lg:-mx-6 lg:px-6"
    >
      <!-- 标题 + 新建按钮 -->
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold">球员管理</h2>
          <p class="mt-0.5 text-sm text-base-content/60">
            管理通过小程序注册或手动录入的球员，支持查询、编辑、冻结和删除
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
          新建球员
        </button>
      </div>

      <!-- 筛选栏 -->
      <div class="card border border-base-300 bg-base-100 shadow-sm">
        <div class="card-body p-4">
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex min-w-[200px] flex-1 flex-col gap-1">
              <span class="text-xs font-semibold text-base-content/60">搜索球员</span>
              <label class="input input-bordered flex h-10 items-center gap-2 border-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-base-content/40"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                  />
                </svg>
                <input
                  v-model="filters.keyword"
                  type="text"
                  class="grow bg-transparent text-sm outline-none"
                  placeholder="昵称、真实姓名、手机号"
                  @keyup.enter="handleSearch"
                />
              </label>
            </label>

            <label class="flex w-32 flex-col gap-1">
              <span class="text-xs font-semibold text-base-content/60">状态</span>
              <select v-model="filters.status" class="select select-bordered h-10 border-2 text-sm">
                <option :value="undefined">全部</option>
                <option :value="1">正常</option>
                <option :value="0">冻结</option>
              </select>
            </label>

            <label class="flex w-36 flex-col gap-1">
              <span class="text-xs font-semibold text-base-content/60">球队归属</span>
              <select
                v-model="filters.has_team"
                class="select select-bordered h-10 border-2 text-sm"
              >
                <option :value="undefined">全部</option>
                <option :value="true">已加入球队</option>
                <option :value="false">自由球员</option>
              </select>
            </label>

            <div class="flex gap-2">
              <button class="btn btn-primary h-10 min-h-0 px-5" @click="handleSearch">搜索</button>
              <button class="btn btn-ghost h-10 min-h-0 px-4" @click="handleReset">重置</button>
            </div>

            <div class="ml-auto flex items-center gap-2">
              <span class="text-sm text-base-content/50">
                共 <strong class="text-base-content">{{ total }}</strong> 位球员
              </span>
            </div>
          </div>

          <div
            v-if="!loadError && total > 0"
            class="mt-4 rounded-xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm text-base-content/60">
                第 <strong class="text-base-content">{{ currentPage }}</strong> /
                {{ totalPages }} 页，共
                <strong class="text-base-content">{{ total }}</strong> 条记录
              </p>
              <div class="join">
                <button
                  class="join-item btn btn-sm"
                  :disabled="loading || currentPage <= 1"
                  @click="changePage(currentPage - 1)"
                >
                  «
                </button>
                <button
                  v-for="p in pageNumbers"
                  :key="p"
                  class="join-item btn btn-sm"
                  :disabled="loading"
                  :class="p === currentPage ? 'btn-active btn-primary' : ''"
                  @click="changePage(p)"
                >
                  {{ p }}
                </button>
                <button
                  class="join-item btn btn-sm"
                  :disabled="loading || currentPage >= totalPages"
                  @click="changePage(currentPage + 1)"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 列表 -->
    <div class="card relative border border-base-300 bg-base-100 shadow-sm">
      <div v-if="showInitialLoading" class="overflow-x-auto">
        <table class="table min-w-[1180px]">
          <thead>
            <tr>
              <th class="w-10"></th>
              <th>球员信息</th>
              <th>手机号</th>
              <th>所属球队</th>
              <th>最近登录</th>
              <th>注册时间</th>
              <th>状态</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 8" :key="i">
              <td><div class="skeleton h-4 w-4"></div></td>
              <td>
                <div class="flex items-center gap-3">
                  <div class="skeleton h-10 w-10 rounded-full"></div>
                  <div class="space-y-2">
                    <div class="skeleton h-4 w-24"></div>
                    <div class="skeleton h-3 w-12"></div>
                  </div>
                </div>
              </td>
              <td><div class="skeleton h-4 w-28"></div></td>
              <td><div class="skeleton h-5 w-16 rounded-full"></div></td>
              <td><div class="skeleton h-4 w-24"></div></td>
              <td><div class="skeleton h-4 w-24"></div></td>
              <td><div class="skeleton h-5 w-12 rounded-full"></div></td>
              <td class="text-right"><div class="skeleton h-7 w-28 ml-auto"></div></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="loadError" class="flex flex-col items-center justify-center py-16 gap-3">
        <p class="text-base-content/60 text-sm">{{ loadError }}</p>
        <button class="btn btn-sm btn-outline" @click="fetchPlayers">重试</button>
      </div>

      <div
        v-else-if="players.length === 0"
        class="flex flex-col items-center justify-center py-16 gap-3"
      >
        <p class="text-base-content/40 text-sm">暂无球员数据</p>
      </div>

      <div v-else :class="loading ? 'pointer-events-none opacity-70' : ''">
        <!-- 批量操作栏 -->
        <div
          v-if="hasSelectedPlayers"
          class="flex items-center gap-3 p-3 bg-error/5 rounded-xl border border-error/10 m-4"
        >
          <span class="text-sm"
            >已选 <strong>{{ selectedPlayerIds.length }}</strong> 人</span
          >
          <div class="flex-1"></div>
          <button class="btn btn-sm btn-ghost" @click="selectedPlayerIds = []">清空</button>
          <button class="btn btn-sm btn-error btn-outline gap-1" @click="openBatchDeleteModal">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
              />
            </svg>
            批量删除
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="table table-zebra min-w-[1180px]">
            <thead>
              <tr>
                <th class="w-10">
                  <label class="flex justify-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="allPlayersSelected"
                      @change="toggleSelectAllPlayers"
                    />
                  </label>
                </th>
                <th>球员信息</th>
                <th>手机号</th>
                <th>所属球队</th>
                <th class="select-none">
                  <button
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all"
                    :class="
                      isSortActive('latest_login_date')
                        ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                        : 'border-transparent bg-base-200/70 text-base-content/65 hover:border-base-300 hover:bg-base-200 hover:text-base-content'
                    "
                    @click="toggleSort('latest_login_date')"
                  >
                    <span>最近登录</span>
                    <span
                      class="inline-flex h-6 w-6 items-center justify-center rounded-full border transition-all"
                      :class="
                        isSortActive('latest_login_date')
                          ? 'border-primary/30 bg-primary text-primary-content'
                          : 'border-base-300 bg-base-100 text-base-content/45'
                      "
                    >
                      <svg
                        v-if="sortDirectionFor('latest_login_date') === 'asc'"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 18V6" />
                        <path d="m7 11 5-5 5 5" />
                      </svg>
                      <svg
                        v-else-if="sortDirectionFor('latest_login_date') === 'desc'"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 6v12" />
                        <path d="m17 13-5 5-5-5" />
                      </svg>
                      <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="m8 9 4-4 4 4" />
                        <path d="m8 15 4 4 4-4" />
                      </svg>
                    </span>
                  </button>
                </th>
                <th class="select-none">
                  <button
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all"
                    :class="
                      isSortActive('create_time')
                        ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                        : 'border-transparent bg-base-200/70 text-base-content/65 hover:border-base-300 hover:bg-base-200 hover:text-base-content'
                    "
                    @click="toggleSort('create_time')"
                  >
                    <span>注册时间</span>
                    <span
                      class="inline-flex h-6 w-6 items-center justify-center rounded-full border transition-all"
                      :class="
                        isSortActive('create_time')
                          ? 'border-primary/30 bg-primary text-primary-content'
                          : 'border-base-300 bg-base-100 text-base-content/45'
                      "
                    >
                      <svg
                        v-if="sortDirectionFor('create_time') === 'asc'"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 18V6" />
                        <path d="m7 11 5-5 5 5" />
                      </svg>
                      <svg
                        v-else-if="sortDirectionFor('create_time') === 'desc'"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 6v12" />
                        <path d="m17 13-5 5-5-5" />
                      </svg>
                      <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="m8 9 4-4 4 4" />
                        <path d="m8 15 4 4 4-4" />
                      </svg>
                    </span>
                  </button>
                </th>
                <th class="select-none">
                  <button
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all"
                    :class="
                      isSortActive('status')
                        ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                        : 'border-transparent bg-base-200/70 text-base-content/65 hover:border-base-300 hover:bg-base-200 hover:text-base-content'
                    "
                    @click="toggleSort('status')"
                  >
                    <span>状态</span>
                    <span
                      class="inline-flex h-6 w-6 items-center justify-center rounded-full border transition-all"
                      :class="
                        isSortActive('status')
                          ? 'border-primary/30 bg-primary text-primary-content'
                          : 'border-base-300 bg-base-100 text-base-content/45'
                      "
                    >
                      <svg
                        v-if="sortDirectionFor('status') === 'asc'"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 18V6" />
                        <path d="m7 11 5-5 5 5" />
                      </svg>
                      <svg
                        v-else-if="sortDirectionFor('status') === 'desc'"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 6v12" />
                        <path d="m17 13-5 5-5-5" />
                      </svg>
                      <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="m8 9 4-4 4 4" />
                        <path d="m8 15 4 4 4-4" />
                      </svg>
                    </span>
                  </button>
                </th>
                <th class="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="player in players"
                :key="player.id"
                class="hover:bg-base-200/50 transition-colors"
              >
                <td>
                  <label class="flex justify-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="isPlayerSelected(player.id)"
                      @change="toggleSelectPlayer(player.id)"
                    />
                  </label>
                </td>
                <!-- 球员信息 -->
                <td class="min-w-[220px]">
                  <div class="flex items-center gap-3">
                    <div class="avatar">
                      <div
                        class="w-10 rounded-full bg-base-300 overflow-hidden flex items-center justify-center"
                      >
                        <img
                          v-if="player.avatar_url"
                          :src="player.avatar_url"
                          :alt="player.nickname"
                          class="object-cover w-full h-full"
                          @error="($event.target as HTMLImageElement).style.display = 'none'"
                        />
                        <span v-else class="text-sm font-bold text-base-content/60">
                          {{ (player.real_name || player.nickname || '?').charAt(0) }}
                        </span>
                      </div>
                    </div>
                    <div class="min-w-0">
                      <p class="whitespace-nowrap text-sm font-semibold leading-snug">
                        {{ player.real_name || player.nickname || '—' }}
                      </p>
                      <p
                        v-if="
                          player.real_name &&
                          player.nickname &&
                          player.real_name !== player.nickname
                        "
                        class="text-xs text-base-content/50 leading-snug break-all"
                      >
                        @{{ player.nickname }}
                      </p>
                      <p class="text-xs text-base-content/40 leading-snug whitespace-nowrap">
                        ID: {{ player.id }}
                      </p>
                    </div>
                  </div>
                </td>

                <!-- 手机号 -->
                <td class="min-w-[140px]">
                  <span class="whitespace-nowrap text-sm font-mono">{{
                    player.phone_number || '—'
                  }}</span>
                </td>

                <!-- 所属球队 -->
                <td class="min-w-[180px]">
                  <div v-if="player.teams.length > 0" class="flex flex-wrap gap-1 max-w-[220px]">
                    <span
                      v-for="team in player.teams"
                      :key="team.team_id"
                      class="badge badge-sm gap-1"
                      :class="
                        team.role === 'captain'
                          ? 'badge-warning'
                          : team.role === 'leader'
                            ? 'badge-info'
                            : 'badge-ghost'
                      "
                      :title="roleLabel(team.role)"
                    >
                      {{ team.team_name }}
                    </span>
                  </div>
                  <span v-else class="text-xs text-base-content/40">自由球员</span>
                </td>

                <!-- 最近登录 -->
                <td class="min-w-[130px]">
                  <span class="whitespace-nowrap text-xs text-base-content/60">{{
                    formatDate(player.latest_login_date)
                  }}</span>
                </td>

                <!-- 注册时间 -->
                <td class="min-w-[130px]">
                  <span class="whitespace-nowrap text-xs text-base-content/60">{{
                    formatDate(player.create_time)
                  }}</span>
                </td>

                <!-- 状态 -->
                <td class="min-w-[140px]">
                  <div class="flex min-w-[120px] flex-col gap-1">
                    <span
                      class="badge badge-sm"
                      :class="player.status === 1 ? 'badge-success' : 'badge-error'"
                    >
                      {{ player.status === 1 ? '正常' : '冻结' }}
                    </span>
                    <template v-if="player.status === 0 && player.freeze_start_time">
                      <span class="whitespace-nowrap text-xs leading-tight text-base-content/50">
                        {{ formatDate(player.freeze_start_time) }}
                        <template v-if="player.freeze_end_time">
                          ~ {{ formatDate(player.freeze_end_time) }}</template
                        >
                        <template v-else> 起</template>
                      </span>
                    </template>
                  </div>
                </td>

                <!-- 操作 -->
                <td class="min-w-[170px] whitespace-nowrap text-right">
                  <div class="flex flex-nowrap justify-end gap-1">
                    <button class="btn btn-xs btn-outline" @click="openEditModal(player)">
                      编辑
                    </button>
                    <button
                      v-if="player.status === 1"
                      class="btn btn-xs btn-warning btn-outline"
                      @click="openFreezeModal(player)"
                    >
                      冻结
                    </button>
                    <button
                      v-else
                      class="btn btn-xs btn-success btn-outline"
                      @click="confirmUnfreeze(player)"
                    >
                      解冻
                    </button>
                    <button class="btn btn-xs btn-error btn-outline" @click="confirmDelete(player)">
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        v-if="showOverlayLoading"
        class="pointer-events-none absolute inset-0 z-10 flex items-start justify-end bg-base-100/55 p-4 backdrop-blur-[1px]"
      >
        <div
          class="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100/95 px-3 py-1.5 text-sm text-base-content/70 shadow-sm"
        >
          <span class="loading loading-spinner loading-sm text-primary"></span>
          正在刷新排序结果
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ 新建球员 ═══ -->
  <dialog ref="createModalRef" class="modal">
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-bold mb-4">新建球员</h3>
      <div v-if="createError" class="alert alert-error py-2.5 mb-4 text-sm">{{ createError }}</div>
      <form @submit.prevent="handleCreate" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">真实姓名 <span class="text-error">*</span></span>
          <input
            v-model="createForm.real_name"
            type="text"
            required
            class="input input-bordered border-2 h-11"
            placeholder="请输入真实姓名"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">昵称</span>
          <input
            v-model="createForm.nickname"
            type="text"
            class="input input-bordered border-2 h-11"
            placeholder="可选"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">手机号</span>
          <input
            v-model="createForm.phone_number"
            type="tel"
            class="input input-bordered border-2 h-11"
            placeholder="可选"
          />
        </label>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="createModalRef?.close()">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="creating">
            <span v-if="creating" class="loading loading-spinner loading-sm"></span>
            创建
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- ═══ 编辑球员 ═══ -->
  <dialog ref="editModalRef" class="modal">
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-bold mb-4">编辑球员信息</h3>
      <div v-if="editError" class="alert alert-error py-2.5 mb-4 text-sm">{{ editError }}</div>
      <form @submit.prevent="handleEdit" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">真实姓名</span>
          <input
            v-model="editForm.real_name"
            type="text"
            class="input input-bordered border-2 h-11"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">昵称</span>
          <input
            v-model="editForm.nickname"
            type="text"
            class="input input-bordered border-2 h-11"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">手机号</span>
          <input
            v-model="editForm.phone_number"
            type="tel"
            class="input input-bordered border-2 h-11"
          />
        </label>
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

  <!-- ═══ 冻结球员 ═══ -->
  <dialog ref="freezeModalRef" class="modal">
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-bold mb-1">冻结球员</h3>
      <p class="text-sm text-base-content/50 mb-4">
        冻结后球员将无法正常使用小程序功能。设置冻结期间后点击确认。
      </p>
      <div v-if="freezeTarget" class="flex items-center gap-3 p-3 bg-base-200 rounded-xl mb-4">
        <div
          class="w-10 h-10 rounded-full bg-base-300 overflow-hidden flex items-center justify-center flex-shrink-0"
        >
          <img
            v-if="freezeTarget.avatar_url"
            :src="freezeTarget.avatar_url"
            class="w-full h-full object-cover"
          />
          <span v-else class="text-sm font-bold text-base-content/60">{{
            (freezeTarget.real_name || freezeTarget.nickname).charAt(0)
          }}</span>
        </div>
        <div>
          <p class="font-semibold text-sm">{{ freezeTarget.real_name || freezeTarget.nickname }}</p>
          <p class="text-xs text-base-content/50">ID: {{ freezeTarget.id }}</p>
        </div>
      </div>
      <div v-if="freezeError" class="alert alert-error py-2.5 mb-4 text-sm">{{ freezeError }}</div>
      <form @submit.prevent="handleFreeze" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">冻结开始时间 <span class="text-error">*</span></span>
          <input
            v-model="freezeForm.start"
            type="datetime-local"
            required
            class="input input-bordered border-2 h-11"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">
            冻结结束时间
            <span class="text-base-content/40 font-normal ml-1">（可选，不填则长期冻结）</span>
          </span>
          <input
            v-model="freezeForm.end"
            type="datetime-local"
            class="input input-bordered border-2 h-11"
          />
        </label>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="freezeModalRef?.close()">取消</button>
          <button type="submit" class="btn btn-warning" :disabled="freezing">
            <span v-if="freezing" class="loading loading-spinner loading-sm"></span>
            确认冻结
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- ═══ 解冻确认 ═══ -->
  <dialog ref="unfreezeModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认解冻</h3>
      <p class="py-4 text-base-content/70">
        确定解冻球员 <strong>{{ unfreezeTarget?.real_name || unfreezeTarget?.nickname }}</strong
        >？解冻后球员可正常使用小程序功能。
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="unfreezeModalRef?.close()">取消</button>
        <button class="btn btn-success" :disabled="unfreezing" @click="handleUnfreeze">
          <span v-if="unfreezing" class="loading loading-spinner loading-sm"></span>
          确认解冻
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- ═══ 删除确认 ═══ -->
  <dialog ref="deleteModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认删除</h3>
      <p class="py-4 text-base-content/70">
        确定删除球员 <strong>{{ deletingPlayer?.real_name || deletingPlayer?.nickname }}</strong
        >？该操作不可撤销，同时会删除其所有报名记录。
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

  <!-- ═══ 批量删除确认 ═══ -->
  <dialog ref="batchDeleteModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认批量删除</h3>
      <p class="py-4 text-base-content/70">
        确定删除选中的
        <strong>{{ selectedPlayerIds.length }}</strong>
        名球员？该操作不可撤销，同时会删除其所有报名记录。
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="batchDeleteModalRef?.close()">取消</button>
        <button class="btn btn-error" :disabled="batchDeleting" @click="handleBatchDelete">
          <span v-if="batchDeleting" class="loading loading-spinner loading-sm"></span>
          确认删除
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  listPlayers,
  createPlayer,
  updatePlayer,
  freezePlayer,
  unfreezePlayer,
  deletePlayer,
  type Player,
} from '@/services/player'
import { toast } from '@/utils/toast'

const PAGE_SIZE = 20

const players = ref<Player[]>([])
const loading = ref(false)
const loadError = ref('')
const total = ref(0)
const currentPage = ref(1)

const filters = reactive<{
  keyword: string
  status: number | undefined
  has_team: boolean | undefined
}>({
  keyword: '',
  status: undefined,
  has_team: undefined,
})
const sortBy = ref<string | undefined>(undefined)
const sortOrder = ref<string | undefined>(undefined)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const showInitialLoading = computed(() => loading.value && players.value.length === 0)
const showOverlayLoading = computed(() => loading.value && players.value.length > 0)
const pageNumbers = computed(() => {
  const pages: number[] = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const formatDate = (d: string) => {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const roleLabel = (role: string) => {
  const map: Record<string, string> = {
    captain: '队长',
    leader: '领队',
    vice_captain: '二场队长',
    member: '队员',
  }
  return map[role] ?? role
}

const fetchPlayers = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listPlayers({
      keyword: filters.keyword || undefined,
      status: filters.status,
      has_team: filters.has_team,
      page: currentPage.value,
      page_size: PAGE_SIZE,
      sort_by: sortBy.value,
      sort_order: sortOrder.value,
    })
    players.value = res.items
    total.value = res.total
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchPlayers()
}
const handleReset = () => {
  Object.assign(filters, { keyword: '', status: undefined, has_team: undefined })
  sortBy.value = undefined
  sortOrder.value = undefined
  currentPage.value = 1
  fetchPlayers()
}

const isSortActive = (field: string) => sortBy.value === field

const sortDirectionFor = (field: string) => (sortBy.value === field ? sortOrder.value : undefined)

const toggleSort = (field: string) => {
  if (sortBy.value === field) {
    if (sortOrder.value === 'desc') {
      sortOrder.value = 'asc'
    } else if (sortOrder.value === 'asc') {
      sortBy.value = undefined
      sortOrder.value = undefined
    } else {
      sortOrder.value = 'desc'
    }
  } else {
    sortBy.value = field
    sortOrder.value = 'desc'
  }
  currentPage.value = 1
  fetchPlayers()
}
const changePage = (page: number) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  fetchPlayers()
}

// ── 新建 ──
const createModalRef = ref<HTMLDialogElement>()
const creating = ref(false)
const createError = ref('')
const createForm = reactive({ real_name: '', nickname: '', phone_number: '' })

const openCreateModal = () => {
  Object.assign(createForm, { real_name: '', nickname: '', phone_number: '' })
  createError.value = ''
  createModalRef.value?.showModal()
}

const handleCreate = async () => {
  creating.value = true
  createError.value = ''
  try {
    await createPlayer({
      real_name: createForm.real_name,
      nickname: createForm.nickname || undefined,
      phone_number: createForm.phone_number || undefined,
    })
    await fetchPlayers()
    createModalRef.value?.close()
  } catch (e: unknown) {
    createError.value = (e as Error).message || '创建失败'
  } finally {
    creating.value = false
  }
}

// ── 编辑 ──
const editModalRef = ref<HTMLDialogElement>()
const editing = ref(false)
const editError = ref('')
const editingPlayer = ref<Player | null>(null)
const editForm = reactive({ real_name: '', nickname: '', phone_number: '' })

const openEditModal = (player: Player) => {
  editingPlayer.value = player
  Object.assign(editForm, {
    real_name: player.real_name,
    nickname: player.nickname,
    phone_number: player.phone_number,
  })
  editError.value = ''
  editModalRef.value?.showModal()
}

const handleEdit = async () => {
  if (!editingPlayer.value) return
  editing.value = true
  editError.value = ''
  try {
    await updatePlayer(editingPlayer.value.id, {
      real_name: editForm.real_name || undefined,
      nickname: editForm.nickname || undefined,
      phone_number: editForm.phone_number || undefined,
    })
    await fetchPlayers()
    editModalRef.value?.close()
  } catch (e: unknown) {
    editError.value = (e as Error).message || '保存失败'
  } finally {
    editing.value = false
  }
}

// ── 冻结 ──
const freezeModalRef = ref<HTMLDialogElement>()
const freezing = ref(false)
const freezeError = ref('')
const freezeTarget = ref<Player | null>(null)
const freezeForm = reactive({ start: '', end: '' })

const openFreezeModal = (player: Player) => {
  freezeTarget.value = player
  const now = new Date()
  freezeForm.start = now.toISOString().slice(0, 16)
  freezeForm.end = ''
  freezeError.value = ''
  freezeModalRef.value?.showModal()
}

const handleFreeze = async () => {
  if (!freezeTarget.value || !freezeForm.start) return
  freezing.value = true
  freezeError.value = ''
  try {
    await freezePlayer(freezeTarget.value.id, {
      freeze_start_time: freezeForm.start + ':00',
      freeze_end_time: freezeForm.end ? freezeForm.end + ':00' : undefined,
    })
    await fetchPlayers()
    freezeModalRef.value?.close()
  } catch (e: unknown) {
    freezeError.value = (e as Error).message || '冻结失败'
  } finally {
    freezing.value = false
  }
}

// ── 解冻 ──
const unfreezeModalRef = ref<HTMLDialogElement>()
const unfreezing = ref(false)
const unfreezeTarget = ref<Player | null>(null)

const confirmUnfreeze = (player: Player) => {
  unfreezeTarget.value = player
  unfreezeModalRef.value?.showModal()
}

const handleUnfreeze = async () => {
  if (!unfreezeTarget.value) return
  unfreezing.value = true
  try {
    await unfreezePlayer(unfreezeTarget.value.id)
    await fetchPlayers()
    unfreezeModalRef.value?.close()
  } catch (e: unknown) {
    toast.error((e as Error).message || '解冻失败')
  } finally {
    unfreezing.value = false
  }
}

// ── 删除 ──
const deleteModalRef = ref<HTMLDialogElement>()
const deleting = ref(false)
const deletingPlayer = ref<Player | null>(null)

const confirmDelete = (player: Player) => {
  deletingPlayer.value = player
  deleteModalRef.value?.showModal()
}

const handleDelete = async () => {
  if (!deletingPlayer.value) return
  deleting.value = true
  try {
    await deletePlayer(deletingPlayer.value.id)
    await fetchPlayers()
    deleteModalRef.value?.close()
  } catch (e: unknown) {
    toast.error((e as Error).message || '删除失败')
  } finally {
    deleting.value = false
  }
}

// ── 批量删除 ──
const selectedPlayerIds = ref<number[]>([])
const hasSelectedPlayers = computed(() => selectedPlayerIds.value.length > 0)

const isPlayerSelected = (id: number) => selectedPlayerIds.value.includes(id)

const toggleSelectPlayer = (id: number) => {
  const idx = selectedPlayerIds.value.indexOf(id)
  if (idx === -1) selectedPlayerIds.value.push(id)
  else selectedPlayerIds.value.splice(idx, 1)
}

const allPlayersSelected = computed(() => {
  if (players.value.length === 0) return false
  return players.value.every((p) => selectedPlayerIds.value.includes(p.id))
})

const toggleSelectAllPlayers = () => {
  if (allPlayersSelected.value) {
    players.value.forEach((p) => {
      const idx = selectedPlayerIds.value.indexOf(p.id)
      if (idx !== -1) selectedPlayerIds.value.splice(idx, 1)
    })
  } else {
    players.value.forEach((p) => {
      if (!selectedPlayerIds.value.includes(p.id)) selectedPlayerIds.value.push(p.id)
    })
  }
}

const batchDeleteModalRef = ref<HTMLDialogElement>()
const batchDeleting = ref(false)

const openBatchDeleteModal = () => {
  batchDeleteModalRef.value?.showModal()
}

const handleBatchDelete = async () => {
  if (selectedPlayerIds.value.length === 0) return
  batchDeleting.value = true
  let successCount = 0
  const errors: string[] = []

  for (const id of selectedPlayerIds.value) {
    try {
      await deletePlayer(id)
      successCount++
    } catch (e: unknown) {
      errors.push(`ID ${id}: ${(e as Error).message}`)
    }
  }

  await fetchPlayers()
  selectedPlayerIds.value = []
  batchDeleteModalRef.value?.close()
  batchDeleting.value = false

  if (errors.length > 0) {
    toast.warning(`${successCount} 人删除成功，${errors.length} 人失败：${errors.join('；')}`)
  }
}

onMounted(fetchPlayers)
</script>
