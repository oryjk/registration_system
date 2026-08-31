<script setup lang="ts">
import { ref } from "vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import MineTeamSwitchSheet from "./MineTeamSwitchSheet.vue";
import type { TeamProfileViewModel } from "@/types/viewModels";

const props = defineProps<{
  currentTeam: TeamProfileViewModel | null;
  teamProfiles: TeamProfileViewModel[];
  isSwitchingTeam: boolean;
}>();

const emit = defineEmits<{
  (event: "switchTeam", teamId: number): void;
  (event: "manageTeam", teamId?: number): void;
}>();

const isSwitchSheetVisible = ref(false);

function openSwitchSheet() {
  if (props.isSwitchingTeam || !props.teamProfiles.length) return;
  isSwitchSheetVisible.value = true;
}

function handleSwitchTeam(teamId: number) {
  if (props.isSwitchingTeam) return;
  if (teamId === props.currentTeam?.id) {
    isSwitchSheetVisible.value = false;
    return;
  }
  isSwitchSheetVisible.value = false;
  emit("switchTeam", teamId);
}
</script>

<template>
  <view class="mine-context-section">
    <NeoSectionHeader title="球队" marker="队" caption="切换后，比赛和信用数据会同步更新" />

    <!-- mp-weixin 里 scoped 样式无法穿透 NeoSurface 组件隔离，custom-class 上的布局会失效；
         因此 flex 布局放在面板自己模板内的包裹 view 上，NeoSurface 用 flush 去掉默认内边距。 -->
    <!-- 点击当前球队卡片弹出切换弹层；进入球队详情走下方「我的球队」列表，两个入口职责分开。 -->
    <view v-if="currentTeam" class="mine-current-team">
      <NeoSurface interactive flush @press="openSwitchSheet">
        <view class="mine-current-team__inner">
          <view class="mine-current-team__logo">
            <image
              v-if="currentTeam.logoUrl"
              class="mine-current-team__logo-image"
              :src="currentTeam.logoUrl"
              mode="aspectFill"
            />
            <text v-else>{{ currentTeam.name.slice(0, 1) || "队" }}</text>
          </view>
          <view class="mine-current-team__copy">
            <text class="mine-current-team__eyebrow">当前球队 · 轻点切换</text>
            <text class="mine-current-team__name">{{ currentTeam.name }}</text>
            <text class="mine-current-team__meta">{{ currentTeam.myRoleLabel }} · {{ currentTeam.memberCount }} 人</text>
          </view>
          <text class="mine-current-team__arrow">›</text>
        </view>
      </NeoSurface>
    </view>

    <view v-else class="mine-context-empty">
      <NeoSurface variant="outlined" flush>
        <view class="mine-context-empty__inner">
          <text class="mine-context-empty__title">暂未加入球队</text>
          <text class="mine-context-empty__copy">加入球队后可查看身份、比赛和球队信用。</text>
        </view>
      </NeoSurface>
    </view>

    <view v-if="teamProfiles.length" class="mine-manage-section">
      <view class="mine-manage-section__head">
        <text class="mine-manage-section__title">我的球队</text>
        <text class="mine-manage-section__caption">点击进入球队主页，可缴纳队费与管理</text>
      </view>
      <view class="mine-manage-list">
        <NeoSurface
          v-for="team in teamProfiles"
          :key="team.id"
          interactive
          flush
          @tap="emit('manageTeam', team.id)"
        >
          <view class="mine-manage-team">
            <view class="mine-manage-team__badge">{{ team.name.slice(0, 1) || "队" }}</view>
            <view class="mine-manage-team__copy">
              <text class="mine-manage-team__name">{{ team.name }}</text>
              <text class="mine-manage-team__meta">{{ team.myRoleLabel }} · {{ team.memberCount }} 人</text>
            </view>
            <text class="mine-manage-team__arrow">→</text>
          </view>
        </NeoSurface>
      </view>
    </view>

    <MineTeamSwitchSheet
      :visible="isSwitchSheetVisible"
      :teams="teamProfiles"
      :current-team-id="currentTeam?.id"
      :is-switching="isSwitchingTeam"
      @close="isSwitchSheetVisible = false"
      @select="handleSwitchTeam"
    />
  </view>
</template>

<style scoped>
.mine-context-section {
  margin-top: 34rpx;
}

.mine-current-team__arrow {
  flex-shrink: 0;
  font-size: 40rpx;
  line-height: 1;
  font-weight: 900;
  color: var(--neo-color-text-muted);
}

.mine-current-team {
  margin-top: 18rpx;
}

.mine-current-team__inner {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: var(--neo-surface-padding);
  background: var(--neo-color-info-soft);
}

.mine-current-team__logo,
.mine-manage-team__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 74rpx;
  height: 74rpx;
  overflow: hidden;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.mine-current-team__logo-image {
  width: 100%;
  height: 100%;
}

.mine-current-team__copy,
.mine-manage-team__copy {
  min-width: 0;
  flex: 1;
}

.mine-current-team__eyebrow,
.mine-current-team__meta,
.mine-manage-team__meta {
  display: block;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.4;
}

.mine-current-team__name,
.mine-manage-team__name {
  display: block;
  margin-top: 4rpx;
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.25;
  word-break: break-word;
}

.mine-current-team__meta {
  margin-top: 6rpx;
}

.mine-context-empty {
  margin-top: 18rpx;
}

.mine-context-empty__inner {
  padding: var(--neo-surface-padding);
  background: var(--neo-color-muted);
}

.mine-context-empty__title,
.mine-context-empty__copy {
  display: block;
}

.mine-context-empty__title {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

.mine-context-empty__copy {
  margin-top: 8rpx;
  color: var(--neo-color-text-muted);
  font-size: 23rpx;
  line-height: 1.5;
}

.mine-manage-section {
  margin-top: 28rpx;
}

.mine-manage-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}

.mine-manage-section__title {
  color: var(--neo-color-text);
  font-size: 27rpx;
  font-weight: 900;
}

.mine-manage-section__caption {
  color: var(--neo-color-text-muted);
  font-size: 21rpx;
  font-weight: 700;
}

.mine-manage-list {
  display: grid;
  gap: 14rpx;
  margin-top: 12rpx;
}

.mine-manage-team {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 102rpx;
  padding: 16rpx;
  box-sizing: border-box;
}

.mine-manage-team__badge {
  width: 62rpx;
  height: 62rpx;
  background: var(--neo-color-warning-soft);
  font-size: 26rpx;
}

.mine-manage-team__name {
  margin-top: 0;
  font-size: 26rpx;
}

.mine-manage-team__arrow {
  flex-shrink: 0;
  color: var(--neo-color-text);
  font-size: 34rpx;
  font-weight: 900;
}
</style>
