<script setup lang="ts">
import { NeoButton } from "@/components/neo";
import type { BackendUser } from "@/types/backend";
import { resolveUserDisplayName } from "@/utils/viewModels";

defineProps<{
  userSearchKeyword: string;
  userSearching: boolean;
  userSearchResults: BackendUser[];
  selectedCandidate: BackendUser | null;
  isCurrentMember: (userId: number) => boolean;
  isCaptainMember: (userId: number) => boolean;
  candidateActionLabel: (candidate: BackendUser) => string;
}>();

const emit = defineEmits<{
  (event: "update:userSearchKeyword", value: string): void;
  (event: "searchUsers"): void;
  (event: "candidateTap", candidate: BackendUser): void;
}>();

function updateUserSearchKeyword(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  emit("update:userSearchKeyword", detail.detail?.value ?? "");
}

function handleSearchUsers() {
  emit("searchUsers");
}

function handleCandidateTap(candidate: BackendUser) {
  emit("candidateTap", candidate);
}
</script>

<template>
  <view>
    <view class="search-row member-search-row">
      <input
        :value="userSearchKeyword"
        class="form-input search-input"
        placeholder="输入昵称、姓名或用户名"
        confirm-type="search"
        @input="updateUserSearchKeyword"
        @confirm="handleSearchUsers"
      />
      <NeoButton class="search-button" variant="lime" :loading="userSearching" @click="handleSearchUsers">
        {{ userSearching ? "搜索中" : "搜索" }}
      </NeoButton>
    </view>
    <view v-if="userSearchResults.length" class="candidate-list">
      <view
        v-for="candidate in userSearchResults"
        :key="candidate.id"
        :class="['candidate-card', selectedCandidate?.id === candidate.id ? 'candidate-card-active' : '']"
        @tap="handleCandidateTap(candidate)"
      >
        <image v-if="candidate.avatar_url" class="candidate-avatar" :src="candidate.avatar_url" mode="aspectFill" />
        <view v-else class="candidate-avatar candidate-avatar-fallback">{{ resolveUserDisplayName(candidate).slice(0, 1) }}</view>
        <view class="candidate-main">
          <text class="team-result-title">{{ resolveUserDisplayName(candidate) }}</text>
          <text class="team-result-meta">{{ candidate.username || "未命名用户" }}</text>
        </view>
        <text :class="['team-result-action', isCurrentMember(candidate.id) && !isCaptainMember(candidate.id) ? 'team-result-action-danger' : '']">
          {{ candidateActionLabel(candidate) }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.search-row {
  display: flex;
  gap: 12rpx;
}

.member-search-row {
  margin-top: 14rpx;
}

.form-input {
  width: 100%;
  height: 84rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.search-input {
  flex: 1;
}

.search-button {
  width: 142rpx;
  min-height: 84rpx;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 14rpx;
}

.candidate-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-text);
}

.candidate-card-active {
  background: var(--neo-color-success);
  box-shadow: 2rpx 2rpx 0 var(--neo-color-text);
}

.candidate-avatar {
  width: 68rpx;
  height: 68rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  flex-shrink: 0;
  overflow: hidden;
}

.candidate-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--neo-color-text);
  color: var(--neo-color-accent);
  font-size: 28rpx;
  font-weight: 900;
}

.candidate-main {
  flex: 1;
  min-width: 0;
}

.team-result-title {
  display: block;
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 900;
}

.team-result-meta {
  display: block;
  margin-top: 6rpx;
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
}

.team-result-action {
  flex-shrink: 0;
  padding: 8rpx 10rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.team-result-action-danger {
  background: var(--neo-color-danger-soft);
  color: var(--neo-color-text);
}
</style>
