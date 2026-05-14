<script setup lang="ts">
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
      <view class="search-button" @tap="handleSearchUsers">{{ userSearching ? "搜索中" : "搜索" }}</view>
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
          <text class="team-result-meta">{{ candidate.username || "微信用户" }}</text>
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
  height: 86rpx;
  padding: 0 22rpx;
  border-radius: 22rpx;
  background: #f3f5ef;
  color: #111310;
  font-size: 28rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.search-input {
  flex: 1;
}

.search-button {
  width: 136rpx;
  height: 86rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: #c8ff00;
  color: #10110f;
  font-size: 28rpx;
  font-weight: 900;
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
  border-radius: 22rpx;
  background: #ffffff;
  border: 2rpx solid transparent;
}

.candidate-card-active {
  border-color: #c8ff00;
  background: #fbfff0;
}

.candidate-avatar {
  width: 68rpx;
  height: 68rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
  overflow: hidden;
}

.candidate-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111310;
  color: #c8ff00;
  font-size: 28rpx;
  font-weight: 900;
}

.candidate-main {
  flex: 1;
  min-width: 0;
}

.team-result-title {
  display: block;
  color: #111310;
  font-size: 30rpx;
  font-weight: 900;
}

.team-result-meta {
  display: block;
  margin-top: 6rpx;
  color: #6a7165;
  font-size: 24rpx;
  font-weight: 700;
}

.team-result-action {
  color: #111310;
  font-size: 24rpx;
  font-weight: 900;
}

.team-result-action-danger {
  color: #b42318;
}
</style>
