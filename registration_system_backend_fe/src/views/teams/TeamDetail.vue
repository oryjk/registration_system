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
          <div class="flex items-center gap-4">
            <div class="skeleton h-16 w-16 rounded-xl"></div>
            <div class="space-y-2">
              <div class="skeleton h-6 w-36"></div>
              <div class="skeleton h-4 w-48"></div>
            </div>
          </div>
          <div class="skeleton h-9 w-16"></div>
        </div>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-4 border-t border-base-200">
          <div v-for="i in 4" :key="i" class="space-y-2">
            <div class="skeleton h-3 w-14"></div>
            <div class="skeleton h-5 w-12"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5 space-y-4">
        <div class="skeleton h-5 w-24"></div>
        <div class="space-y-3">
          <div v-for="i in 6" :key="i" class="flex items-center gap-4">
            <div class="skeleton h-10 w-10 rounded-full flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-20"></div>
              <div class="skeleton h-3 w-16"></div>
            </div>
            <div class="skeleton h-6 w-12 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="loadError" class="alert alert-error">
    <span>{{ loadError }}</span>
    <button class="btn btn-sm btn-ghost" @click="fetchDetail">重试</button>
  </div>

  <div v-else-if="detail" class="flex flex-col gap-6">
    <!-- 面包屑 -->
    <div class="flex items-center gap-2 text-sm text-base-content/50">
      <RouterLink to="/teams" class="hover:text-primary transition-colors">球队管理</RouterLink>
      <span>/</span>
      <span class="text-base-content font-medium">{{ detail.team.name }}</span>
    </div>

    <!-- 球队基本信息卡片 -->
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <div v-if="detail.team.logo_url" class="avatar">
              <div class="w-16 rounded-xl"><img :src="detail.team.logo_url" /></div>
            </div>
            <div
              v-else
              class="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-9 w-9 text-primary"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                />
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-xl font-bold">{{ detail.team.name }}</h2>
                <span
                  class="badge"
                  :class="detail.team.status === 1 ? 'badge-success' : 'badge-error'"
                >
                  {{ detail.team.status === 1 ? '正常' : '已解散' }}
                </span>
              </div>
              <p class="text-sm text-base-content/60 mt-1">
                {{ detail.team.description || '暂无简介' }}
              </p>
              <p class="text-xs text-base-content/40 mt-1 font-mono">ID: {{ detail.team.id }}</p>
            </div>
          </div>
          <button class="btn btn-sm btn-outline gap-1 flex-shrink-0" @click="openEditModal">
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

        <!-- 统计 -->
        <div class="flex flex-wrap gap-4 mt-4 pt-4 border-t border-base-200">
          <div class="flex items-center gap-2 text-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"
              />
            </svg>
            <span
              ><strong>{{ detail.member_count }}</strong> 名成员</span
            >
          </div>
          <!-- 队长 -->
          <div class="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-warning"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
              />
            </svg>
            <span class="text-sm">队长：</span>
            <template v-if="captainMember">
              <div class="avatar placeholder">
                <div class="w-6 h-6 rounded-full bg-warning text-warning-content overflow-hidden">
                  <img
                    v-if="captainMember.avatar_url"
                    :src="captainMember.avatar_url"
                    class="w-full h-full object-cover"
                  />
                  <span v-else class="text-xs font-bold">{{
                    (captainMember.real_name || captainMember.nickname).charAt(0)
                  }}</span>
                </div>
              </div>
              <span class="text-sm font-medium">{{
                captainMember.real_name || captainMember.nickname
              }}</span>
            </template>
            <span v-else class="text-sm text-warning">未设置</span>
            <button class="btn btn-xs btn-ghost" @click="openSetCaptainModal">更换</button>
          </div>
          <!-- 领队 -->
          <div class="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
            <span class="text-sm">领队：</span>
            <template v-if="leaderMember">
              <div class="avatar placeholder">
                <div class="w-6 h-6 rounded-full bg-primary text-primary-content overflow-hidden">
                  <img
                    v-if="leaderMember.avatar_url"
                    :src="leaderMember.avatar_url"
                    class="w-full h-full object-cover"
                  />
                  <span v-else class="text-xs font-bold">{{
                    (leaderMember.real_name || leaderMember.nickname).charAt(0)
                  }}</span>
                </div>
              </div>
              <span class="text-sm font-medium">{{
                leaderMember.real_name || leaderMember.nickname
              }}</span>
            </template>
            <span v-else class="text-sm text-base-content/40">未设置</span>
            <button class="btn btn-xs btn-ghost" @click="openSetLeaderModal">更换</button>
          </div>
          <!-- 二场队长 -->
          <div class="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-secondary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
              />
            </svg>
            <span class="text-sm">二场队长：</span>
            <template v-if="viceCaptainMember">
              <div class="avatar placeholder">
                <div
                  class="w-6 h-6 rounded-full bg-secondary text-secondary-content overflow-hidden"
                >
                  <img
                    v-if="viceCaptainMember.avatar_url"
                    :src="viceCaptainMember.avatar_url"
                    class="w-full h-full object-cover"
                  />
                  <span v-else class="text-xs font-bold">{{
                    (viceCaptainMember.real_name || viceCaptainMember.nickname).charAt(0)
                  }}</span>
                </div>
              </div>
              <span class="text-sm font-medium">{{
                viceCaptainMember.real_name || viceCaptainMember.nickname
              }}</span>
            </template>
            <span v-else class="text-sm text-base-content/40">未设置</span>
            <button class="btn btn-xs btn-ghost" @click="openSetViceCaptainModal">更换</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="font-bold text-base">球队信用</h3>
            <p class="text-xs text-base-content/50 mt-0.5">
              赛后互评、会员修复和后台罚扣都会写入信用流水。
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge" :class="detail.team.is_vip ? 'badge-warning' : 'badge-ghost'">
              {{ detail.team.is_vip ? '会员中' : '普通队' }}
            </span>
            <span class="badge badge-outline">{{ detail.team.trust_label }}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div class="rounded-2xl bg-base-200 p-4">
            <div class="text-xs text-base-content/50">当前信用</div>
            <div class="text-3xl font-black mt-1">{{ detail.team.credit_score }}</div>
          </div>
          <div class="rounded-2xl bg-base-200 p-4">
            <div class="text-xs text-base-content/50">信用标签</div>
            <div class="text-base font-semibold mt-1">{{ detail.team.trust_label }}</div>
          </div>
          <div class="rounded-2xl bg-base-200 p-4">
            <div class="text-xs text-base-content/50">会员到期</div>
            <div class="text-base font-semibold mt-1">{{ formatDateTime(detail.team.vip_until) }}</div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mt-4">
          <button
            class="btn btn-sm btn-outline btn-error"
            :disabled="applyingCreditPenalty"
            @click="handleCreditPenalty(5)"
          >
            罚扣 5 分
          </button>
          <button
            class="btn btn-sm btn-outline btn-error"
            :disabled="applyingCreditPenalty"
            @click="handleCreditPenalty(10)"
          >
            罚扣 10 分
          </button>
          <button
            class="btn btn-sm btn-outline btn-error"
            :disabled="applyingCreditPenalty"
            @click="handleCreditPenalty(20)"
          >
            罚扣 20 分
          </button>
        </div>

        <div class="overflow-x-auto mt-4">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>变化</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!creditTransactions.length">
                <td colspan="4" class="text-center text-base-content/50 py-4">暂无信用流水</td>
              </tr>
              <tr v-for="item in creditTransactions" :key="item.id">
                <td class="whitespace-nowrap">{{ formatDateTime(item.created_at) }}</td>
                <td>{{ transactionTypeLabel(item.transaction_type) }}</td>
                <td>
                  <span :class="item.delta >= 0 ? 'text-success font-semibold' : 'text-error font-semibold'">
                    {{ item.delta >= 0 ? `+${item.delta}` : item.delta }}
                  </span>
                  <span class="text-xs text-base-content/50 ml-2">
                    {{ item.score_before }} → {{ item.score_after }}
                  </span>
                </td>
                <td>{{ item.note || '系统记录' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 球队管理员（超级管理员专用） -->
    <div v-if="isSuperAdmin" class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-bold text-base">后台管理员</h3>
            <p class="text-xs text-base-content/50 mt-0.5">分配后，该管理员可登录后台管理此球队</p>
          </div>
          <button class="btn btn-sm btn-primary gap-1" @click="openAssignAdminModal">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            分配管理员
          </button>
        </div>

        <div
          v-if="!detail?.assigned_admins?.length"
          class="flex items-center gap-2 text-sm text-base-content/40 py-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
            />
          </svg>
          暂未分配管理员
        </div>

        <div v-else class="flex flex-wrap gap-2">
          <div
            v-for="admin in detail.assigned_admins"
            :key="admin.admin_id"
            class="flex items-center gap-2 px-3 py-2 bg-base-200 rounded-xl"
          >
            <div
              class="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0"
            >
              <span class="text-xs font-bold text-primary">{{
                (admin.nickname || admin.username).charAt(0).toUpperCase()
              }}</span>
            </div>
            <div class="leading-none">
              <p class="text-sm font-semibold">{{ admin.nickname || admin.username }}</p>
              <p class="text-xs text-base-content/50">@{{ admin.username }}</p>
            </div>
            <button
              class="btn btn-ghost btn-xs btn-square text-error ml-1"
              @click="handleUnassignAdmin(admin.admin_id)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 成员列表 -->
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-base">队员列表（{{ detail.member_count }}）</h3>
          <button class="btn btn-primary btn-sm gap-1" @click="openBatchAddModal">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            添加队员
          </button>
        </div>

        <div
          v-if="hasSelectedMembers"
          class="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10 mb-4"
        >
          <span class="text-sm"
            >已选 <strong>{{ selectedMemberIds.length }}</strong> 人</span
          >
          <div class="flex-1"></div>
          <button class="btn btn-sm btn-ghost" @click="selectedMemberIds = []">清空</button>
          <button class="btn btn-sm btn-error btn-outline gap-1" @click="openBatchRemoveModal">
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
            批量移除
          </button>
          <button class="btn btn-sm btn-warning btn-outline gap-1" @click="handleBatchFreeze">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
              />
            </svg>
            批量冻结
          </button>
          <button class="btn btn-sm btn-success btn-outline gap-1" @click="handleBatchUnfreeze">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            批量解冻
          </button>
        </div>

        <div
          v-if="detail.members.length === 0"
          class="flex flex-col items-center py-10 text-base-content/40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-10 w-10"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"
            />
          </svg>
          <p class="mt-2 text-sm">暂无队员</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <th class="w-10">
                  <label class="flex justify-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="allMembersSelected"
                      @change="toggleSelectAllMembers"
                    />
                  </label>
                </th>
                <th>球员</th>
                <th>手机号</th>
                <th>角色</th>
                <th>号码</th>
                <th>加入时间</th>
                <th class="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in detail.members" :key="member.user_id">
                <td>
                  <label class="flex justify-center">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="isMemberSelected(member.user_id)"
                      @change="toggleSelectMember(member.user_id)"
                    />
                  </label>
                </td>
                <td>
                  <div class="flex items-center gap-2.5">
                    <div
                      class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
                      :class="member.avatar_url ? '' : roleColors[member.role] || 'bg-base-300'"
                    >
                      <img
                        v-if="member.avatar_url"
                        :src="member.avatar_url"
                        class="w-full h-full object-cover"
                        @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                      />
                      <div v-else class="w-full h-full flex items-center justify-center">
                        <span class="text-sm font-bold">{{
                          (member.real_name || member.nickname || '?').charAt(0)
                        }}</span>
                      </div>
                    </div>
                    <div>
                      <p class="font-semibold text-sm leading-none">
                        {{ member.real_name || member.nickname }}
                      </p>
                      <p
                        v-if="member.real_name && member.nickname !== member.real_name"
                        class="text-xs text-base-content/50 mt-0.5"
                      >
                        @{{ member.nickname }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="text-sm font-mono text-base-content/60">
                  {{ member.phone_number || '—' }}
                </td>
                <td>
                  <span
                    class="badge badge-sm"
                    :class="roleBadgeClass[member.role] || 'badge-ghost'"
                  >
                    {{ member.role_label }}
                  </span>
                </td>
                <td class="text-sm">
                  {{ member.jersey_number ? '#' + member.jersey_number : '—' }}
                </td>
                <td class="text-xs text-base-content/50">{{ formatDate(member.joined_at) }}</td>
                <td class="text-right">
                  <div class="flex gap-1 justify-end">
                    <button class="btn btn-xs btn-outline" @click="openSetRoleModal(member)">
                      设置角色
                    </button>
                    <button
                      class="btn btn-xs btn-error btn-outline"
                      @click="confirmRemoveMember(member)"
                    >
                      移除
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

  <!-- ═══════════════════════════════════════════════════════
       批量添加队员弹窗
  ═══════════════════════════════════════════════════════ -->
  <dialog ref="batchAddModalRef" class="modal">
    <div class="modal-box max-w-2xl w-full">
      <h3 class="text-lg font-bold mb-1">批量添加队员</h3>
      <p class="text-sm text-base-content/50 mb-4">
        搜索球员后选择，可以同时选择多人，最后一次性提交
      </p>

      <!-- 搜索框 -->
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
            v-model="batchSearchKeyword"
            type="text"
            class="grow bg-transparent outline-none text-sm"
            placeholder="搜索昵称或真实姓名..."
            @input="onBatchSearch"
          />
          <span v-if="batchSearching" class="loading loading-spinner loading-xs"></span>
        </label>
      </div>

      <!-- 搜索结果 -->
      <div v-if="batchSearchResults.length > 0" class="mb-4">
        <p class="text-xs text-base-content/40 mb-2">搜索结果（点击添加到选择列表）</p>
        <div
          class="flex flex-col gap-1 max-h-52 overflow-y-auto border border-base-200 rounded-xl p-2"
        >
          <div
            v-for="player in batchSearchResults"
            :key="player.id"
            class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 cursor-pointer transition-colors"
            :class="{
              'opacity-40 pointer-events-none':
                isAlreadySelected(player.id) || isAlreadyMember(player.id),
            }"
            @click="selectPlayer(player)"
          >
            <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
              <img
                v-if="player.avatar_url"
                :src="player.avatar_url"
                class="w-full h-full object-cover"
                @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
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
            <div class="flex items-center gap-2 flex-shrink-0">
              <span v-if="player.team_count > 0" class="badge badge-xs badge-ghost">
                已在 {{ player.team_count }} 支队
              </span>
              <span v-if="isAlreadyMember(player.id)" class="badge badge-xs badge-warning"
                >已在本队</span
              >
              <span v-else-if="isAlreadySelected(player.id)" class="badge badge-xs badge-success"
                >已选</span
              >
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-primary"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="batchSearchKeyword && !batchSearching"
        class="mb-4 text-center text-sm text-base-content/40 py-4 border border-dashed border-base-300 rounded-xl"
      >
        未找到匹配的球员
      </div>

      <!-- 已选列表 -->
      <div v-if="selectedPlayers.length > 0" class="mb-4">
        <p class="text-xs text-base-content/40 mb-2">已选中 {{ selectedPlayers.length }} 名球员</p>
        <div class="flex flex-col gap-2 max-h-52 overflow-y-auto">
          <div
            v-for="(item, idx) in selectedPlayers"
            :key="item.player.id"
            class="flex items-center gap-3 p-2.5 bg-base-200/60 rounded-xl"
          >
            <!-- 头像 -->
            <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
              <img
                v-if="item.player.avatar_url"
                :src="item.player.avatar_url"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <span class="text-sm font-bold text-base-content/60">{{
                  (item.player.real_name || item.player.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <!-- 名字 -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold leading-none truncate">
                {{ item.player.real_name || item.player.nickname }}
              </p>
              <p
                v-if="item.player.nickname !== item.player.real_name"
                class="text-xs text-base-content/40 truncate"
              >
                @{{ item.player.nickname }}
              </p>
            </div>
            <!-- 角色选择 -->
            <select v-model="item.role" class="select select-bordered select-xs h-8 w-28 text-xs">
              <option value="member">队员</option>
              <option value="captain">队长</option>
              <option value="leader">领队</option>
              <option value="vice_captain">二场队长</option>
            </select>
            <!-- 号码输入 -->
            <input
              v-model="item.jersey_number"
              type="text"
              placeholder="号码"
              class="input input-bordered input-xs h-8 w-16 text-xs text-center"
            />
            <!-- 移除 -->
            <button class="btn btn-ghost btn-xs btn-square text-error" @click="removeSelected(idx)">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="batchAddError" class="alert alert-error py-2 text-sm mb-3">
        {{ batchAddError }}
      </div>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" @click="batchAddModalRef?.close()">取消</button>
        <button
          class="btn btn-primary"
          :disabled="selectedPlayers.length === 0 || batchAdding"
          @click="handleBatchAdd"
        >
          <span v-if="batchAdding" class="loading loading-spinner loading-sm"></span>
          {{ batchAdding ? '添加中...' : `确认添加 ${selectedPlayers.length} 名队员` }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- ═══════════════════════════════════════════════════════
       设置队长弹窗（带搜索）
  ═══════════════════════════════════════════════════════ -->
  <dialog ref="setCaptainModalRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-1">设置队长</h3>
      <p class="text-sm text-base-content/50 mb-4">搜索并选择队长，也可以从现有队员中选择</p>

      <!-- 搜索框 -->
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
            v-model="captainSearchKeyword"
            type="text"
            class="grow bg-transparent outline-none text-sm"
            placeholder="搜索昵称或真实姓名..."
            @input="onCaptainSearch"
          />
          <span v-if="captainSearching" class="loading loading-spinner loading-xs"></span>
        </label>
      </div>

      <!-- 搜索结果 / 现有队员（若未搜索） -->
      <div
        class="max-h-72 overflow-y-auto flex flex-col gap-1 border border-base-200 rounded-xl p-2 mb-4"
      >
        <template v-if="captainSearchKeyword">
          <div
            v-if="captainSearchResults.length === 0 && !captainSearching"
            class="text-center text-sm text-base-content/40 py-6"
          >
            未找到匹配球员
          </div>
          <div
            v-for="player in captainSearchResults"
            :key="player.id"
            class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
            :class="
              selectedCaptain?.id === player.id
                ? 'bg-primary/10 ring-1 ring-primary'
                : 'hover:bg-base-200'
            "
            @click="selectedCaptain = player"
          >
            <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
              <img
                v-if="player.avatar_url"
                :src="player.avatar_url"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <span class="font-bold text-base-content/60">{{
                  (player.real_name || player.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm leading-none">
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
              v-if="selectedCaptain?.id === player.id"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        </template>
        <!-- 无搜索时显示现有队员 -->
        <template v-else>
          <p class="text-xs text-base-content/40 px-1 pb-1">从现有队员中选择</p>
          <div
            v-for="member in detail?.members ?? []"
            :key="member.user_id"
            class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
            :class="
              selectedCaptain?.id === member.user_id
                ? 'bg-primary/10 ring-1 ring-primary'
                : 'hover:bg-base-200'
            "
            @click="
              selectedCaptain = {
                id: member.user_id,
                nickname: member.nickname,
                real_name: member.real_name,
                avatar_url: member.avatar_url,
                phone_number: member.phone_number,
                status: 1,
                status_label: '',
                create_time: '',
                latest_login_date: '',
                freeze_start_time: null,
                freeze_end_time: null,
                teams: [],
                team_count: 0,
              }
            "
          >
            <div
              class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
              :class="member.avatar_url ? '' : roleBgClass[member.role] || 'bg-base-300'"
            >
              <img
                v-if="member.avatar_url"
                :src="member.avatar_url"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <span class="font-bold text-base-content/60">{{
                  (member.real_name || member.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="font-semibold text-sm leading-none">
                  {{ member.real_name || member.nickname }}
                </p>
                <span
                  class="badge badge-xs"
                  :class="roleBadgeClass[member.role] || 'badge-ghost'"
                  >{{ member.role_label }}</span
                >
              </div>
              <p
                v-if="member.nickname !== member.real_name"
                class="text-xs text-base-content/50 mt-0.5"
              >
                @{{ member.nickname }}
              </p>
            </div>
            <svg
              v-if="selectedCaptain?.id === member.user_id"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        </template>
      </div>

      <!-- 当前选中预览 -->
      <div
        v-if="selectedCaptain"
        class="flex items-center gap-3 p-3 bg-warning/10 rounded-xl border border-warning/30 mb-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 text-warning flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
          />
        </svg>
        <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
          <img
            v-if="selectedCaptain.avatar_url"
            :src="selectedCaptain.avatar_url"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="text-xs font-bold">{{
              (selectedCaptain.real_name || selectedCaptain.nickname).charAt(0)
            }}</span>
          </div>
        </div>
        <div>
          <p class="text-sm font-semibold">
            将设置
            <strong>{{ selectedCaptain.real_name || selectedCaptain.nickname }}</strong> 为队长
          </p>
          <p class="text-xs text-base-content/50">如果此人不在队中，将自动加入队伍</p>
        </div>
      </div>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" @click="setCaptainModalRef?.close()">
          取消
        </button>
        <button
          class="btn btn-warning"
          :disabled="!selectedCaptain || settingCaptain"
          @click="handleSetCaptain"
        >
          <span v-if="settingCaptain" class="loading loading-spinner loading-sm"></span>
          确认设置队长
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- ═══════════════════════════════════════════════════════
       设置领队弹窗（带搜索）
  ═══════════════════════════════════════════════════════ -->
  <dialog ref="setLeaderModalRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-1">设置领队</h3>
      <p class="text-sm text-base-content/50 mb-4">搜索并选择领队，也可以从现有队员中选择</p>

      <!-- 搜索框 -->
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
            v-model="leaderSearchKeyword"
            type="text"
            class="grow bg-transparent outline-none text-sm"
            placeholder="搜索昵称或真实姓名..."
            @input="onLeaderSearch"
          />
          <span v-if="leaderSearching" class="loading loading-spinner loading-xs"></span>
        </label>
      </div>

      <!-- 搜索结果 / 现有队员（若未搜索） -->
      <div
        class="max-h-72 overflow-y-auto flex flex-col gap-1 border border-base-200 rounded-xl p-2 mb-4"
      >
        <template v-if="leaderSearchKeyword">
          <div
            v-if="leaderSearchResults.length === 0 && !leaderSearching"
            class="text-center text-sm text-base-content/40 py-6"
          >
            未找到匹配球员
          </div>
          <div
            v-for="player in leaderSearchResults"
            :key="player.id"
            class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
            :class="
              selectedLeader?.id === player.id
                ? 'bg-primary/10 ring-1 ring-primary'
                : 'hover:bg-base-200'
            "
            @click="selectedLeader = player"
          >
            <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
              <img
                v-if="player.avatar_url"
                :src="player.avatar_url"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <span class="font-bold text-base-content/60">{{
                  (player.real_name || player.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm leading-none">
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
              v-if="selectedLeader?.id === player.id"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        </template>
        <!-- 无搜索时显示现有队员 -->
        <template v-else>
          <p class="text-xs text-base-content/40 px-1 pb-1">从现有队员中选择</p>
          <div
            v-for="member in detail?.members ?? []"
            :key="member.user_id"
            class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
            :class="
              selectedLeader?.id === member.user_id
                ? 'bg-primary/10 ring-1 ring-primary'
                : 'hover:bg-base-200'
            "
            @click="
              selectedLeader = {
                id: member.user_id,
                nickname: member.nickname,
                real_name: member.real_name,
                avatar_url: member.avatar_url,
                phone_number: member.phone_number,
                status: 1,
                status_label: '',
                create_time: '',
                latest_login_date: '',
                freeze_start_time: null,
                freeze_end_time: null,
                teams: [],
                team_count: 0,
              }
            "
          >
            <div
              class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
              :class="member.avatar_url ? '' : roleBgClass[member.role] || 'bg-base-300'"
            >
              <img
                v-if="member.avatar_url"
                :src="member.avatar_url"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <span class="font-bold text-base-content/60">{{
                  (member.real_name || member.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="font-semibold text-sm leading-none">
                  {{ member.real_name || member.nickname }}
                </p>
                <span
                  class="badge badge-xs"
                  :class="roleBadgeClass[member.role] || 'badge-ghost'"
                  >{{ member.role_label }}</span
                >
              </div>
              <p
                v-if="member.nickname !== member.real_name"
                class="text-xs text-base-content/50 mt-0.5"
              >
                @{{ member.nickname }}
              </p>
            </div>
            <svg
              v-if="selectedLeader?.id === member.user_id"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        </template>
      </div>

      <!-- 当前选中预览 -->
      <div
        v-if="selectedLeader"
        class="flex items-center gap-3 p-3 bg-primary/10 rounded-xl border border-primary/30 mb-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 text-primary flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
        </svg>
        <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
          <img
            v-if="selectedLeader.avatar_url"
            :src="selectedLeader.avatar_url"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="text-xs font-bold">{{
              (selectedLeader.real_name || selectedLeader.nickname).charAt(0)
            }}</span>
          </div>
        </div>
        <div>
          <p class="text-sm font-semibold">
            将设置 <strong>{{ selectedLeader.real_name || selectedLeader.nickname }}</strong> 为领队
          </p>
          <p class="text-xs text-base-content/50">如果此人不在队中，将自动加入队伍</p>
        </div>
      </div>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" @click="setLeaderModalRef?.close()">
          取消
        </button>
        <button
          class="btn btn-primary"
          :disabled="!selectedLeader || settingLeader"
          @click="handleSetLeader"
        >
          <span v-if="settingLeader" class="loading loading-spinner loading-sm"></span>
          确认设置领队
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- ═══════════════════════════════════════════════════════
       设置二场队长弹窗（带搜索）
  ═══════════════════════════════════════════════════════ -->
  <dialog ref="setViceCaptainModalRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-1">设置二场队长</h3>
      <p class="text-sm text-base-content/50 mb-4">搜索并选择二场队长，也可以从现有队员中选择</p>

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
            v-model="viceCaptainSearchKeyword"
            type="text"
            class="grow bg-transparent outline-none text-sm"
            placeholder="搜索昵称或真实姓名..."
            @input="onViceCaptainSearch"
          />
          <span v-if="viceCaptainSearching" class="loading loading-spinner loading-xs"></span>
        </label>
      </div>

      <div
        class="max-h-72 overflow-y-auto flex flex-col gap-1 border border-base-200 rounded-xl p-2 mb-4"
      >
        <template v-if="viceCaptainSearchKeyword">
          <div
            v-if="viceCaptainSearchResults.length === 0 && !viceCaptainSearching"
            class="text-center text-sm text-base-content/40 py-6"
          >
            未找到匹配球员
          </div>
          <div
            v-for="player in viceCaptainSearchResults"
            :key="player.id"
            class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
            :class="
              selectedViceCaptain?.id === player.id
                ? 'bg-secondary/10 ring-1 ring-secondary'
                : 'hover:bg-base-200'
            "
            @click="selectedViceCaptain = player"
          >
            <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
              <img
                v-if="player.avatar_url"
                :src="player.avatar_url"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <span class="font-bold text-base-content/60">{{
                  (player.real_name || player.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm leading-none">
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
              v-if="selectedViceCaptain?.id === player.id"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-secondary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        </template>
        <template v-else>
          <p class="text-xs text-base-content/40 px-1 pb-1">从现有队员中选择</p>
          <div
            v-for="member in detail?.members ?? []"
            :key="member.user_id"
            class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
            :class="
              selectedViceCaptain?.id === member.user_id
                ? 'bg-secondary/10 ring-1 ring-secondary'
                : 'hover:bg-base-200'
            "
            @click="
              selectedViceCaptain = {
                id: member.user_id,
                nickname: member.nickname,
                real_name: member.real_name,
                avatar_url: member.avatar_url,
                phone_number: member.phone_number,
                status: 1,
                status_label: '',
                create_time: '',
                latest_login_date: '',
                freeze_start_time: null,
                freeze_end_time: null,
                teams: [],
                team_count: 0,
              }
            "
          >
            <div
              class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
              :class="member.avatar_url ? '' : roleBgClass[member.role] || 'bg-base-300'"
            >
              <img
                v-if="member.avatar_url"
                :src="member.avatar_url"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <span class="font-bold text-base-content/60">{{
                  (member.real_name || member.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="font-semibold text-sm leading-none">
                  {{ member.real_name || member.nickname }}
                </p>
                <span
                  class="badge badge-xs"
                  :class="roleBadgeClass[member.role] || 'badge-ghost'"
                  >{{ member.role_label }}</span
                >
              </div>
              <p
                v-if="member.nickname !== member.real_name"
                class="text-xs text-base-content/50 mt-0.5"
              >
                @{{ member.nickname }}
              </p>
            </div>
            <svg
              v-if="selectedViceCaptain?.id === member.user_id"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-secondary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        </template>
      </div>

      <div
        v-if="selectedViceCaptain"
        class="flex items-center gap-3 p-3 bg-secondary/10 rounded-xl border border-secondary/30 mb-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 text-secondary flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
          />
        </svg>
        <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
          <img
            v-if="selectedViceCaptain.avatar_url"
            :src="selectedViceCaptain.avatar_url"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="text-xs font-bold">{{
              (selectedViceCaptain.real_name || selectedViceCaptain.nickname).charAt(0)
            }}</span>
          </div>
        </div>
        <div>
          <p class="text-sm font-semibold">
            将设置
            <strong>{{ selectedViceCaptain.real_name || selectedViceCaptain.nickname }}</strong>
            为二场队长
          </p>
          <p class="text-xs text-base-content/50">如果此人不在队中，将自动加入队伍</p>
        </div>
      </div>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" @click="setViceCaptainModalRef?.close()">
          取消
        </button>
        <button
          class="btn btn-secondary"
          :disabled="!selectedViceCaptain || settingViceCaptain"
          @click="handleSetViceCaptain"
        >
          <span v-if="settingViceCaptain" class="loading loading-spinner loading-sm"></span>
          确认设置二场队长
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- ═══════════════════════════════════════════════════════
       编辑球队弹窗
  ═══════════════════════════════════════════════════════ -->
  <dialog ref="editModalRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-4">编辑球队信息</h3>
      <div v-if="editError" class="alert alert-error py-2.5 mb-4 text-sm">{{ editError }}</div>
      <form @submit.prevent="handleEdit" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">球队名称</span>
          <input v-model="editForm.name" type="text" class="input input-bordered border-2 h-11" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">简介</span>
          <textarea
            v-model="editForm.description"
            rows="3"
            class="textarea textarea-bordered border-2 resize-none"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">队徽 URL</span>
          <input
            v-model="editForm.logo_url"
            type="url"
            class="input input-bordered border-2 h-11"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">状态</span>
          <select v-model.number="editForm.status" class="select select-bordered border-2 h-11">
            <option :value="1">正常</option>
            <option :value="0">解散</option>
          </select>
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

  <!-- 设置角色弹窗 -->
  <dialog ref="setRoleModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold mb-1">设置角色</h3>
      <div v-if="setRoleTarget" class="flex items-center gap-3 p-3 bg-base-200 rounded-xl mb-4">
        <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
          <img
            v-if="setRoleTarget.avatar_url"
            :src="setRoleTarget.avatar_url"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="font-bold">{{
              (setRoleTarget.real_name || setRoleTarget.nickname).charAt(0)
            }}</span>
          </div>
        </div>
        <div>
          <p class="font-semibold">{{ setRoleTarget.real_name || setRoleTarget.nickname }}</p>
          <p
            v-if="setRoleTarget.nickname !== setRoleTarget.real_name"
            class="text-xs text-base-content/50"
          >
            @{{ setRoleTarget.nickname }}
          </p>
        </div>
      </div>
      <form @submit.prevent="handleSetRole" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">角色</span>
          <select v-model="setRoleForm.role" class="select select-bordered border-2 h-11">
            <option value="member">队员</option>
            <option value="captain">队长</option>
            <option value="leader">领队</option>
            <option value="vice_captain">二场队长</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">号码</span>
          <input
            v-model="setRoleForm.jersey_number"
            type="text"
            placeholder="球衣号码（可选）"
            class="input input-bordered border-2 h-11"
          />
        </label>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="setRoleModalRef?.close()">
            取消
          </button>
          <button type="submit" class="btn btn-primary" :disabled="settingRole">
            <span v-if="settingRole" class="loading loading-spinner loading-sm"></span>
            保存
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- 移除成员确认 -->
  <dialog ref="removeMemberModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认移除</h3>
      <p class="py-4 text-base-content/70">
        确定要将
        <strong>{{
          removingMember ? removingMember.real_name || removingMember.nickname : ''
        }}</strong>
        从球队移除吗？
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="removeMemberModalRef?.close()">取消</button>
        <button class="btn btn-error" :disabled="removingMemberLoading" @click="handleRemoveMember">
          <span v-if="removingMemberLoading" class="loading loading-spinner loading-sm"></span>
          确认移除
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- 批量移除确认 -->
  <dialog ref="batchRemoveModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认批量移除</h3>
      <p class="py-4 text-base-content/70">
        确定要将选中的 <strong>{{ selectedMemberIds.length }}</strong> 名队员从球队移除吗？
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="batchRemoveModalRef?.close()">取消</button>
        <button class="btn btn-error" :disabled="batchRemoving" @click="handleBatchRemove">
          <span v-if="batchRemoving" class="loading loading-spinner loading-sm"></span>
          确认移除
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- ═══════════════════════════════════════════════════════
       分配球队管理员弹窗（超级管理员专用）
  ═══════════════════════════════════════════════════════ -->
  <dialog ref="assignAdminModalRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-1">分配球队管理员</h3>
      <p class="text-sm text-base-content/50 mb-4">
        选择一名管理员负责管理该球队，被分配后可登录后台查看和管理此球队
      </p>

      <div v-if="allAdmins.length === 0" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <div
        v-else
        class="max-h-72 overflow-y-auto flex flex-col gap-1 border border-base-200 rounded-xl p-2 mb-4"
      >
        <div
          v-for="admin in availableAdmins"
          :key="admin.id"
          class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
          :class="
            selectedAdminToAssign?.id === admin.id
              ? 'bg-primary/10 ring-1 ring-primary'
              : 'hover:bg-base-200'
          "
          @click="selectedAdminToAssign = admin"
        >
          <div
            class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
          >
            <span class="text-sm font-bold text-primary">{{
              (admin.nickname || admin.username).charAt(0).toUpperCase()
            }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold leading-none">{{ admin.nickname || admin.username }}</p>
            <p class="text-xs text-base-content/50 mt-0.5">@{{ admin.username }}</p>
          </div>
          <svg
            v-if="selectedAdminToAssign?.id === admin.id"
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-primary"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
        <div
          v-if="availableAdmins.length === 0"
          class="text-center text-sm text-base-content/40 py-6"
        >
          所有管理员均已被分配
        </div>
      </div>

      <div v-if="assignAdminError" class="alert alert-error py-2 text-sm mb-3">
        {{ assignAdminError }}
      </div>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" @click="assignAdminModalRef?.close()">
          取消
        </button>
        <button
          class="btn btn-primary"
          :disabled="!selectedAdminToAssign || assigningAdmin"
          @click="handleAssignAdmin"
        >
          <span v-if="assigningAdmin" class="loading loading-spinner loading-sm"></span>
          确认分配
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from '@/utils/toast'
import {
  applyTeamCreditPenalty,
  getTeamAdminDetail,
  getTeamCreditTransactions,
  updateTeam,
  addMember,
  updateMember,
  removeMember,
  batchRemoveMembers,
  batchUpdateMemberStatus,
  assignAdmin,
  unassignAdmin,
  type TeamDetailForAdmin,
  type TeamCreditTransaction,
  type TeamMemberWithInfo,
} from '@/services/team'
import { listPlayers, type Player } from '@/services/player'
import { listAdmins, type AdminUser } from '@/services/auth'
import { useAdminStore } from '@/stores/admin'

const route = useRoute()
const teamId = computed(() => route.params.id as string)

const adminStore = useAdminStore()
const isSuperAdmin = computed(() => adminStore.isSuperAdmin)

const detail = ref<TeamDetailForAdmin | null>(null)
const creditTransactions = ref<TeamCreditTransaction[]>([])
const loading = ref(false)
const loadError = ref('')
const applyingCreditPenalty = ref(false)

const captainMember = computed(
  () => detail.value?.members.find((m) => m.role === 'captain') ?? null,
)
const leaderMember = computed(() => detail.value?.members.find((m) => m.role === 'leader') ?? null)
const viceCaptainMember = computed(
  () => detail.value?.members.find((m) => m.role === 'vice_captain') ?? null,
)
const currentMemberIds = computed(() => new Set(detail.value?.members.map((m) => m.user_id) ?? []))

const roleColors: Record<string, string> = {
  captain: 'bg-warning text-warning-content',
  leader: 'bg-primary text-primary-content',
  vice_captain: 'bg-secondary text-secondary-content',
}
const roleBgClass: Record<string, string> = {
  captain: 'bg-warning text-warning-content',
  leader: 'bg-primary text-primary-content',
  vice_captain: 'bg-secondary text-secondary-content',
  member: 'bg-base-300',
}
const roleBadgeClass: Record<string, string> = {
  captain: 'badge-warning',
  leader: 'badge-primary',
  vice_captain: 'badge-secondary',
  member: 'badge-ghost',
}

const selectedMemberIds = ref<number[]>([])
const hasSelectedMembers = computed(() => selectedMemberIds.value.length > 0)

const isMemberSelected = (userId: number) => selectedMemberIds.value.includes(userId)

const toggleSelectMember = (userId: number) => {
  const idx = selectedMemberIds.value.indexOf(userId)
  if (idx === -1) selectedMemberIds.value.push(userId)
  else selectedMemberIds.value.splice(idx, 1)
}

const allMembersSelected = computed(() => {
  if (!detail.value || detail.value.members.length === 0) return false
  return detail.value.members.every((m) => selectedMemberIds.value.includes(m.user_id))
})

const toggleSelectAllMembers = () => {
  const members = detail.value?.members ?? []
  if (allMembersSelected.value) {
    members.forEach((m) => {
      const idx = selectedMemberIds.value.indexOf(m.user_id)
      if (idx !== -1) selectedMemberIds.value.splice(idx, 1)
    })
  } else {
    members.forEach((m) => {
      if (!selectedMemberIds.value.includes(m.user_id)) selectedMemberIds.value.push(m.user_id)
    })
  }
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })

const formatDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '未开通'

const transactionTypeLabel = (type: string) => {
  switch (type) {
    case 'match_review':
      return '赛后互评'
    case 'membership_recharge':
      return '会员充值'
    case 'manual_penalty':
      return '后台罚扣'
    default:
      return '信用变动'
  }
}

const fetchDetail = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [teamDetail, transactions] = await Promise.all([
      getTeamAdminDetail(teamId.value),
      getTeamCreditTransactions(teamId.value, 8),
    ])
    detail.value = teamDetail
    creditTransactions.value = transactions
    selectedMemberIds.value = []
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

const handleCreditPenalty = async (points: number) => {
  if (!detail.value || applyingCreditPenalty.value) return
  const reason = window.prompt(`请输入扣减 ${points} 分的原因`, '临时放鸽子')
  if (!reason || !reason.trim()) return

  applyingCreditPenalty.value = true
  try {
    await applyTeamCreditPenalty(teamId.value, points, reason.trim())
    await fetchDetail()
  } catch (e: unknown) {
    toast.error((e as Error).message || '信用罚扣失败')
  } finally {
    applyingCreditPenalty.value = false
  }
}

// ─────────────── 批量添加 ───────────────
const batchAddModalRef = ref<HTMLDialogElement>()
const batchSearchKeyword = ref('')
const batchSearchResults = ref<Player[]>([])
const batchSearching = ref(false)
const batchAdding = ref(false)
const batchAddError = ref('')
let batchSearchTimer: ReturnType<typeof setTimeout>

interface SelectedItem {
  player: Player
  role: string
  jersey_number: string
}
const selectedPlayers = ref<SelectedItem[]>([])

const isAlreadyMember = (id: number) => currentMemberIds.value.has(id)
const isAlreadySelected = (id: number) => selectedPlayers.value.some((s) => s.player.id === id)

const onBatchSearch = () => {
  clearTimeout(batchSearchTimer)
  if (!batchSearchKeyword.value.trim()) {
    batchSearchResults.value = []
    return
  }
  batchSearchTimer = setTimeout(async () => {
    batchSearching.value = true
    try {
      const res = await listPlayers({
        keyword: batchSearchKeyword.value.trim(),
        page: 1,
        page_size: 20,
      })
      batchSearchResults.value = res.items
    } catch {
      batchSearchResults.value = []
    } finally {
      batchSearching.value = false
    }
  }, 300)
}

const selectPlayer = (player: Player) => {
  if (isAlreadySelected(player.id) || isAlreadyMember(player.id)) return
  selectedPlayers.value.push({ player, role: 'member', jersey_number: '' })
}

const removeSelected = (idx: number) => selectedPlayers.value.splice(idx, 1)

const openBatchAddModal = () => {
  batchSearchKeyword.value = ''
  batchSearchResults.value = []
  selectedPlayers.value = []
  batchAddError.value = ''
  batchAddModalRef.value?.showModal()
}

const handleBatchAdd = async () => {
  if (selectedPlayers.value.length === 0) return
  batchAdding.value = true
  batchAddError.value = ''
  let successCount = 0
  const errors: string[] = []
  let captainId: number | undefined

  for (const item of selectedPlayers.value) {
    try {
      await addMember(teamId.value, {
        user_id: item.player.id,
        role: item.role,
        jersey_number: item.jersey_number || undefined,
      })
      if (item.role === 'captain') {
        captainId = item.player.id
      }
      successCount++
    } catch (e: unknown) {
      errors.push(`${item.player.real_name || item.player.nickname}: ${(e as Error).message}`)
    }
  }

  if (captainId !== undefined) {
    await updateTeam(teamId.value, { captain_id: captainId })
  }

  await fetchDetail()

  if (errors.length > 0) {
    batchAddError.value = `${successCount} 人添加成功，${errors.length} 人失败：${errors.join('；')}`
  } else {
    batchAddModalRef.value?.close()
  }
  batchAdding.value = false
}

// ─────────────── 设置队长 ───────────────
const setCaptainModalRef = ref<HTMLDialogElement>()
const captainSearchKeyword = ref('')
const captainSearchResults = ref<Player[]>([])
const captainSearching = ref(false)
const settingCaptain = ref(false)
const selectedCaptain = ref<Player | null>(null)
let captainSearchTimer: ReturnType<typeof setTimeout>

const onCaptainSearch = () => {
  clearTimeout(captainSearchTimer)
  if (!captainSearchKeyword.value.trim()) {
    captainSearchResults.value = []
    return
  }
  captainSearchTimer = setTimeout(async () => {
    captainSearching.value = true
    try {
      const res = await listPlayers({
        keyword: captainSearchKeyword.value.trim(),
        page: 1,
        page_size: 20,
      })
      captainSearchResults.value = res.items
    } catch {
      captainSearchResults.value = []
    } finally {
      captainSearching.value = false
    }
  }, 300)
}

const openSetCaptainModal = () => {
  captainSearchKeyword.value = ''
  captainSearchResults.value = []
  selectedCaptain.value = captainMember.value
    ? {
        id: captainMember.value.user_id,
        nickname: captainMember.value.nickname,
        real_name: captainMember.value.real_name,
        avatar_url: captainMember.value.avatar_url,
        phone_number: captainMember.value.phone_number,
        status: 1,
        status_label: '',
        create_time: '',
        latest_login_date: '',
        freeze_start_time: null,
        freeze_end_time: null,
        teams: [],
        team_count: 0,
      }
    : null
  setCaptainModalRef.value?.showModal()
}

const handleSetCaptain = async () => {
  if (!selectedCaptain.value) return
  settingCaptain.value = true
  try {
    const isInTeam = isAlreadyMember(selectedCaptain.value.id)
    if (!isInTeam) {
      // 先加入队伍
      await addMember(teamId.value, { user_id: selectedCaptain.value.id, role: 'captain' })
    } else {
      // 设置角色为 captain
      await updateMember(teamId.value, selectedCaptain.value.id, { role: 'captain' })
    }
    // 更新 team.captain_id
    await updateTeam(teamId.value, { captain_id: selectedCaptain.value.id })
    await fetchDetail()
    setCaptainModalRef.value?.close()
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  } finally {
    settingCaptain.value = false
  }
}

// ─────────────── 设置领队 ───────────────
const setLeaderModalRef = ref<HTMLDialogElement>()
const leaderSearchKeyword = ref('')
const leaderSearchResults = ref<Player[]>([])
const leaderSearching = ref(false)
const settingLeader = ref(false)
const selectedLeader = ref<Player | null>(null)
let leaderSearchTimer: ReturnType<typeof setTimeout>

const onLeaderSearch = () => {
  clearTimeout(leaderSearchTimer)
  if (!leaderSearchKeyword.value.trim()) {
    leaderSearchResults.value = []
    return
  }
  leaderSearchTimer = setTimeout(async () => {
    leaderSearching.value = true
    try {
      const res = await listPlayers({
        keyword: leaderSearchKeyword.value.trim(),
        page: 1,
        page_size: 20,
      })
      leaderSearchResults.value = res.items
    } catch {
      leaderSearchResults.value = []
    } finally {
      leaderSearching.value = false
    }
  }, 300)
}

const openSetLeaderModal = () => {
  leaderSearchKeyword.value = ''
  leaderSearchResults.value = []
  selectedLeader.value = leaderMember.value
    ? {
        id: leaderMember.value.user_id,
        nickname: leaderMember.value.nickname,
        real_name: leaderMember.value.real_name,
        avatar_url: leaderMember.value.avatar_url,
        phone_number: leaderMember.value.phone_number,
        status: 1,
        status_label: '',
        create_time: '',
        latest_login_date: '',
        freeze_start_time: null,
        freeze_end_time: null,
        teams: [],
        team_count: 0,
      }
    : null
  setLeaderModalRef.value?.showModal()
}

const handleSetLeader = async () => {
  if (!selectedLeader.value) return
  settingLeader.value = true
  try {
    const isInTeam = isAlreadyMember(selectedLeader.value.id)
    if (!isInTeam) {
      await addMember(teamId.value, { user_id: selectedLeader.value.id, role: 'leader' })
    } else {
      await updateMember(teamId.value, selectedLeader.value.id, { role: 'leader' })
    }
    await fetchDetail()
    setLeaderModalRef.value?.close()
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  } finally {
    settingLeader.value = false
  }
}

// ─────────────── 设置二场队长 ───────────────
const setViceCaptainModalRef = ref<HTMLDialogElement>()
const viceCaptainSearchKeyword = ref('')
const viceCaptainSearchResults = ref<Player[]>([])
const viceCaptainSearching = ref(false)
const settingViceCaptain = ref(false)
const selectedViceCaptain = ref<Player | null>(null)
let viceCaptainSearchTimer: ReturnType<typeof setTimeout>

const onViceCaptainSearch = () => {
  clearTimeout(viceCaptainSearchTimer)
  if (!viceCaptainSearchKeyword.value.trim()) {
    viceCaptainSearchResults.value = []
    return
  }
  viceCaptainSearchTimer = setTimeout(async () => {
    viceCaptainSearching.value = true
    try {
      const res = await listPlayers({
        keyword: viceCaptainSearchKeyword.value.trim(),
        page: 1,
        page_size: 20,
      })
      viceCaptainSearchResults.value = res.items
    } catch {
      viceCaptainSearchResults.value = []
    } finally {
      viceCaptainSearching.value = false
    }
  }, 300)
}

const openSetViceCaptainModal = () => {
  viceCaptainSearchKeyword.value = ''
  viceCaptainSearchResults.value = []
  selectedViceCaptain.value = viceCaptainMember.value
    ? {
        id: viceCaptainMember.value.user_id,
        nickname: viceCaptainMember.value.nickname,
        real_name: viceCaptainMember.value.real_name,
        avatar_url: viceCaptainMember.value.avatar_url,
        phone_number: viceCaptainMember.value.phone_number,
        status: 1,
        status_label: '',
        create_time: '',
        latest_login_date: '',
        freeze_start_time: null,
        freeze_end_time: null,
        teams: [],
        team_count: 0,
      }
    : null
  setViceCaptainModalRef.value?.showModal()
}

const handleSetViceCaptain = async () => {
  if (!selectedViceCaptain.value) return
  settingViceCaptain.value = true
  try {
    const isInTeam = isAlreadyMember(selectedViceCaptain.value.id)
    if (!isInTeam) {
      await addMember(teamId.value, { user_id: selectedViceCaptain.value.id, role: 'vice_captain' })
    } else {
      await updateMember(teamId.value, selectedViceCaptain.value.id, { role: 'vice_captain' })
    }
    await fetchDetail()
    setViceCaptainModalRef.value?.close()
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  } finally {
    settingViceCaptain.value = false
  }
}

// ─────────────── 编辑球队 ───────────────
const editModalRef = ref<HTMLDialogElement>()
const editing = ref(false)
const editError = ref('')
const editForm = reactive({ name: '', description: '', logo_url: '', status: 1 })

const openEditModal = () => {
  if (!detail.value) return
  const t = detail.value.team
  editForm.name = t.name
  editForm.description = t.description || ''
  editForm.logo_url = t.logo_url || ''
  editForm.status = t.status
  editError.value = ''
  editModalRef.value?.showModal()
}

const handleEdit = async () => {
  editing.value = true
  editError.value = ''
  try {
    await updateTeam(teamId.value, {
      name: editForm.name || undefined,
      description: editForm.description || null,
      logo_url: editForm.logo_url || null,
      status: editForm.status,
    })
    await fetchDetail()
    editModalRef.value?.close()
  } catch (e: unknown) {
    editError.value = (e as Error).message || '保存失败'
  } finally {
    editing.value = false
  }
}

// ─────────────── 设置角色 ───────────────
const setRoleModalRef = ref<HTMLDialogElement>()
const settingRole = ref(false)
const setRoleTarget = ref<TeamMemberWithInfo | null>(null)
const setRoleForm = reactive({ role: 'member', jersey_number: '' })

const openSetRoleModal = (member: TeamMemberWithInfo) => {
  setRoleTarget.value = member
  setRoleForm.role = member.role
  setRoleForm.jersey_number = member.jersey_number || ''
  setRoleModalRef.value?.showModal()
}

const handleSetRole = async () => {
  if (!setRoleTarget.value) return
  settingRole.value = true
  try {
    const oldRole = setRoleTarget.value.role
    await updateMember(teamId.value, setRoleTarget.value.user_id, {
      role: setRoleForm.role,
      jersey_number: setRoleForm.jersey_number || null,
    })
    if (setRoleForm.role === 'captain') {
      await updateTeam(teamId.value, { captain_id: setRoleTarget.value.user_id })
    } else if (oldRole === 'captain') {
      await updateTeam(teamId.value, { captain_id: null })
    }
    await fetchDetail()
    setRoleModalRef.value?.close()
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  } finally {
    settingRole.value = false
  }
}

// ─────────────── 移除成员 ───────────────
const removeMemberModalRef = ref<HTMLDialogElement>()
const removingMember = ref<TeamMemberWithInfo | null>(null)
const removingMemberLoading = ref(false)

const confirmRemoveMember = (member: TeamMemberWithInfo) => {
  removingMember.value = member
  removeMemberModalRef.value?.showModal()
}

const handleRemoveMember = async () => {
  if (!removingMember.value) return
  removingMemberLoading.value = true
  try {
    if (removingMember.value.role === 'captain') {
      await updateTeam(teamId.value, { captain_id: null })
    }
    await removeMember(teamId.value, removingMember.value.user_id)
    await fetchDetail()
    removeMemberModalRef.value?.close()
    removingMember.value = null
  } catch (e: unknown) {
    toast.error((e as Error).message || '移除失败')
  } finally {
    removingMemberLoading.value = false
  }
}

// ─────────────── 管理员分配（超级管理员专用） ───────────────
const assignAdminModalRef = ref<HTMLDialogElement>()
const allAdmins = ref<AdminUser[]>([])
const selectedAdminToAssign = ref<AdminUser | null>(null)
const assigningAdmin = ref(false)
const assignAdminError = ref('')

const assignedAdminIds = computed(
  () => new Set(detail.value?.assigned_admins?.map((a) => a.admin_id) ?? []),
)

const availableAdmins = computed(() =>
  allAdmins.value.filter((a) => !a.is_super_admin && !assignedAdminIds.value.has(a.id)),
)

const openAssignAdminModal = async () => {
  selectedAdminToAssign.value = null
  assignAdminError.value = ''
  if (allAdmins.value.length === 0) {
    try {
      allAdmins.value = await listAdmins()
    } catch {
      allAdmins.value = []
    }
  }
  assignAdminModalRef.value?.showModal()
}

const handleAssignAdmin = async () => {
  if (!selectedAdminToAssign.value) return
  assigningAdmin.value = true
  assignAdminError.value = ''
  try {
    await assignAdmin(teamId.value, selectedAdminToAssign.value.id)
    await fetchDetail()
    assignAdminModalRef.value?.close()
  } catch (e: unknown) {
    assignAdminError.value = (e as Error).message || '分配失败'
  } finally {
    assigningAdmin.value = false
  }
}

const handleUnassignAdmin = async (adminId: number) => {
  if (!confirm('确定取消该管理员对此球队的管理权限？')) return
  try {
    await unassignAdmin(teamId.value, adminId)
    await fetchDetail()
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  }
}

// ─────────────── 批量操作 ───────────────
const batchRemoving = ref(false)
const batchRemoveModalRef = ref<HTMLDialogElement>()

const openBatchRemoveModal = () => {
  batchRemoving.value = false
  batchRemoveModalRef.value?.showModal()
}

const handleBatchRemove = async () => {
  if (selectedMemberIds.value.length === 0) return
  batchRemoving.value = true
  try {
    const hasCaptain = detail.value?.members.some(
      (m) => m.role === 'captain' && selectedMemberIds.value.includes(m.user_id),
    )
    if (hasCaptain) {
      await updateTeam(teamId.value, { captain_id: null })
    }
    await batchRemoveMembers(teamId.value, selectedMemberIds.value)
    await fetchDetail()
    batchRemoveModalRef.value?.close()
  } catch (e: unknown) {
    toast.error((e as Error).message || '批量移除失败')
  } finally {
    batchRemoving.value = false
  }
}

const handleBatchFreeze = async () => {
  if (selectedMemberIds.value.length === 0) return
  try {
    await batchUpdateMemberStatus(teamId.value, selectedMemberIds.value, 0)
    await fetchDetail()
    selectedMemberIds.value = []
  } catch (e: unknown) {
    toast.error((e as Error).message || '批量冻结失败')
  }
}

const handleBatchUnfreeze = async () => {
  if (selectedMemberIds.value.length === 0) return
  try {
    await batchUpdateMemberStatus(teamId.value, selectedMemberIds.value, 1)
    await fetchDetail()
    selectedMemberIds.value = []
  } catch (e: unknown) {
    toast.error((e as Error).message || '批量解冻失败')
  }
}

onMounted(fetchDetail)
</script>
