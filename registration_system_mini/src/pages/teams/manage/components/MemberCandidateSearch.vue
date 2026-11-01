<script setup lang="ts">
import { useMinioImages } from "@/composables/useMinioImages";
import AppButton from "@/components/ui/AppButton.vue";
import type { BackendUser } from "@/types/backend";
import { resolveUserDisplayName } from "@/utils/viewModels";

const { minioImageSrc } = useMinioImages();

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
      <AppButton icon="search-line" class="search-button" variant="outline" :loading="userSearching" @click="handleSearchUsers">
        {{ userSearching ? "搜索中" : "搜索" }}
      </AppButton>
    </view>
    <view v-if="userSearchResults.length" class="candidate-list">
      <view
        v-for="candidate in userSearchResults"
        :key="candidate.id"
        :class="['candidate-card ui-list-row', selectedCandidate?.id === candidate.id ? 'candidate-card-active' : '']"
        @tap="handleCandidateTap(candidate)"
      >
        <image v-if="candidate.avatar_url" class="candidate-avatar" :src="minioImageSrc(candidate.avatar_url)" mode="aspectFill" />
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
@import "@/styles/list-surfaces.css";
@import "@/styles/form-controls.css";
.search-row {
  display: flex;
  gap: 12rpx;
}

.member-search-row {
  margin-top: 14rpx;
}

.search-input {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
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
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-shadow: none;
}

.candidate-card-active {
  background: var(--ui-color-accent-soft);
  border-color: var(--ui-color-accent);
  box-shadow: none;
}

.candidate-avatar {
  width: 68rpx;
  height: 68rpx;
  border: none;
  border-radius: var(--ui-radius-round);
  flex-shrink: 0;
  overflow: hidden;
}

.candidate-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.candidate-main {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.team-result-title {
  display: block;
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.team-result-meta {
  display: block;
  margin-top: 6rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
}

.team-result-action {
  flex-shrink: 0;
  padding: 8rpx 10rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-accent-deep);
  font-size: 24rpx;
  font-weight: 600;
}

.team-result-action-danger {
  background: var(--ui-color-danger-bg);
  color: var(--ui-color-danger-fg);
}

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.member-search-row { margin-top: var(--ui-space-3); }
.candidate-list { gap: 0; margin-top: var(--ui-space-3); }
.candidate-card { gap: var(--ui-space-4); padding: var(--ui-list-row-padding) var(--ui-space-3); border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); }
.candidate-avatar-fallback { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.team-result-title { font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-heading); }
.team-result-meta { margin-top: var(--ui-space-1); font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-body); }
.team-result-action { padding: var(--ui-space-2) var(--ui-space-3); font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-heading); border: var(--ui-control-border); background: var(--ui-control-subtle-bg); }
.candidate-card + .candidate-card { border-top: var(--ui-list-divider); }
.candidate-card-active { background: var(--ui-control-selected-bg); }
.team-result-action-danger { background: var(--ui-color-danger-bg); }
/* #endif */
</style>
