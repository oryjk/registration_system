<script setup lang="ts">
import { computed } from "vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSegmentedControl from "@/components/neo/NeoSegmentedControl.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import NeoTag from "@/components/neo/NeoTag.vue";
import type { CurrentIdentityViewModel, TeamProfileViewModel } from "@/types/viewModels";

const props = defineProps<{
  availableIdentities: CurrentIdentityViewModel[];
  currentIdentity: CurrentIdentityViewModel | null;
  currentTeam: TeamProfileViewModel | null;
  teamProfiles: TeamProfileViewModel[];
  isSwitchingTeam: boolean;
}>();

const emit = defineEmits<{
  (event: "switchIdentity", identityId: string): void;
  (event: "switchTeam", teamId: number): void;
  (event: "manageTeam", teamId?: number): void;
}>();

const teamOptions = computed(() =>
  props.teamProfiles.map((team) => ({
    label: team.name,
    value: String(team.id),
    disabled: props.isSwitchingTeam,
  })),
);
const identityOptions = computed(() =>
  props.availableIdentities.map((identity) => ({
    label: `${identity.roleLabel} · ${identity.label}`,
    value: identity.id,
  })),
);
const useCompactTeamControl = computed(() => props.teamProfiles.length > 0 && props.teamProfiles.length <= 3);
const useCompactIdentityControl = computed(() => props.availableIdentities.length > 0 && props.availableIdentities.length <= 3);

function handleSwitchTeam(value: string) {
  if (props.isSwitchingTeam) return;
  const teamId = Number(value);
  if (!Number.isFinite(teamId) || teamId === props.currentTeam?.id) return;
  emit("switchTeam", teamId);
}

function handleSwitchIdentity(identityId: string) {
  if (!identityId || identityId === props.currentIdentity?.id) return;
  emit("switchIdentity", identityId);
}
</script>

<template>
  <view class="mine-context-section">
    <NeoSectionHeader title="球队与身份" marker="队" caption="切换后，比赛和信用数据会同步更新" />

    <NeoSurface v-if="currentTeam" interactive custom-class="mine-current-team" @tap="emit('manageTeam', currentTeam.id)">
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
        <text class="mine-current-team__eyebrow">当前球队</text>
        <text class="mine-current-team__name">{{ currentTeam.name }}</text>
        <text class="mine-current-team__meta">{{ currentTeam.myRoleLabel }} · {{ currentTeam.memberCount }} 人</text>
      </view>
      <text class="mine-current-team__arrow">›</text>
    </NeoSurface>

    <NeoSurface v-else variant="outlined" custom-class="mine-context-empty">
      <text class="mine-context-empty__title">暂未加入球队</text>
      <text class="mine-context-empty__copy">加入球队后可查看身份、比赛和球队信用。</text>
    </NeoSurface>

    <view v-if="teamProfiles.length > 1" class="mine-switch-group">
      <text class="mine-switch-group__label">切换球队</text>
      <NeoSegmentedControl
        v-if="useCompactTeamControl"
        :model-value="currentTeam ? String(currentTeam.id) : ''"
        :options="teamOptions"
        @change="handleSwitchTeam"
      />
      <scroll-view v-else class="mine-switch-scroll" scroll-x enhanced :show-scrollbar="false">
        <view class="mine-switch-row">
          <view
            v-for="team in teamProfiles"
            :key="team.id"
            :class="[
              'mine-switch-chip',
              team.id === currentTeam?.id ? 'mine-switch-chip--active' : '',
              isSwitchingTeam ? 'mine-switch-chip--disabled' : '',
            ]"
            :hover-class="isSwitchingTeam ? 'none' : 'mine-switch-chip--pressed'"
            @tap="handleSwitchTeam(String(team.id))"
          >
            <text class="mine-switch-chip__role">{{ team.myRoleLabel }}</text>
            <text class="mine-switch-chip__name">{{ team.name }}</text>
          </view>
        </view>
      </scroll-view>
      <text v-if="isSwitchingTeam" class="mine-switch-group__pending">球队数据切换中...</text>
    </view>

    <view class="mine-switch-group">
      <text class="mine-switch-group__label">发布身份</text>
      <NeoSegmentedControl
        v-if="useCompactIdentityControl"
        :model-value="currentIdentity?.id || ''"
        :options="identityOptions"
        @change="handleSwitchIdentity"
      />
      <scroll-view
        v-else-if="availableIdentities.length"
        class="mine-switch-scroll"
        scroll-x
        enhanced
        :show-scrollbar="false"
      >
        <view class="mine-switch-row">
          <view
            v-for="identity in availableIdentities"
            :key="identity.id"
            :class="[
              'mine-switch-chip',
              identity.id === currentIdentity?.id ? 'mine-switch-chip--active' : '',
            ]"
            hover-class="mine-switch-chip--pressed"
            @tap="handleSwitchIdentity(identity.id)"
          >
            <text class="mine-switch-chip__role">{{ identity.roleLabel }}</text>
            <text class="mine-switch-chip__name">{{ identity.label }}</text>
          </view>
        </view>
      </scroll-view>
      <view v-else class="mine-inline-empty">当前球队暂无可切换身份</view>
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
          custom-class="mine-manage-team"
          @tap="emit('manageTeam', team.id)"
        >
          <view class="mine-manage-team__badge">{{ team.name.slice(0, 1) || "队" }}</view>
          <view class="mine-manage-team__copy">
            <text class="mine-manage-team__name">{{ team.name }}</text>
            <text class="mine-manage-team__meta">{{ team.myRoleLabel }} · {{ team.memberCount }} 人</text>
          </view>
          <text class="mine-manage-team__arrow">→</text>
        </NeoSurface>
      </view>
    </view>
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
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 18rpx;
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

.mine-switch-group {
  margin-top: 24rpx;
}

.mine-switch-group__label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.mine-switch-group__pending {
  display: block;
  margin-top: 10rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
}

.mine-switch-scroll {
  width: 100%;
  white-space: nowrap;
}

.mine-switch-row {
  display: inline-flex;
  gap: 12rpx;
  padding: 0 8rpx 8rpx 0;
}

.mine-switch-chip {
  display: flex;
  width: 222rpx;
  min-height: 92rpx;
  padding: 14rpx 16rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-text);
  flex-direction: column;
  justify-content: center;
  white-space: normal;
  box-sizing: border-box;
}

.mine-switch-chip--active {
  background: var(--neo-color-accent);
}

.mine-switch-chip--disabled {
  opacity: 0.46;
}

.mine-switch-chip--pressed {
  transform: translate(4rpx, 4rpx);
  box-shadow: none;
}

.mine-switch-chip__role {
  color: var(--neo-color-text-muted);
  font-size: 20rpx;
  font-weight: 800;
}

.mine-switch-chip__name {
  margin-top: 4rpx;
  color: var(--neo-color-text);
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.25;
  word-break: break-word;
}

.mine-inline-empty {
  min-height: 76rpx;
  padding: 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  color: var(--neo-color-text-muted);
  font-size: 23rpx;
  line-height: 1.5;
  box-sizing: border-box;
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
