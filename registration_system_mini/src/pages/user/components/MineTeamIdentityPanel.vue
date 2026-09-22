<script setup lang="ts">
import TeamRoleIcon from "@/components/ui/TeamRoleIcon.vue";
import { ref } from "vue";
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
    <view class="section-heading"><text>我的球队</text>
      <button v-if="teamProfiles.length > 1" class="text-action" :disabled="isSwitchingTeam" @tap="openSwitchSheet"><text>切换球队</text><wd-icon name="arrow-right" size="24rpx" /></button>
    </view>
    <view class="team-list">
      <button v-for="team in teamProfiles" :key="team.id" class="team-row" hover-class="team-row--pressed" @tap="emit('manageTeam', team.id)">
        <view class="team-logo"><image v-if="team.logoUrl" :src="team.logoUrl" mode="aspectFit" /><text v-else>{{ team.name.slice(0,1) }}</text></view>
        <view class="team-copy"><view class="team-name-row"><text class="team-name">{{ team.name }}</text><text v-if="team.id === currentTeam?.id" class="team-current">当前</text></view><view class="team-meta"><TeamRoleIcon :team-role="team.myRole" :label="team.myRoleLabel" /><text>{{ team.memberCount }} 人</text></view></view>
        <wd-icon name="arrow-right" size="28rpx" color="var(--ui-color-text-muted)" />
      </button>
      <view v-if="!teamProfiles.length" class="team-empty">暂未加入球队</view>
    </view>
    <MineTeamSwitchSheet :visible="isSwitchSheetVisible" :teams="teamProfiles" :current-team-id="currentTeam?.id" :is-switching="isSwitchingTeam" @close="isSwitchSheetVisible = false" @select="handleSwitchTeam" />
  </view>
</template>
<style scoped>

.mine-context-section { margin-top:28rpx; }
.section-heading { display:flex; align-items:center; justify-content:space-between; margin:0 4rpx 14rpx; color:var(--ui-color-text); font-size:30rpx; font-weight:600; }
.text-action { display:flex; align-items:center; gap:6rpx; margin:0; padding:10rpx 0 10rpx 16rpx; font-size:22rpx; font-weight:400; color:var(--ui-color-text-muted); background:transparent; line-height:1.4; }
.text-action::after,.team-row::after { border:0; }
.team-list { border:var(--ui-border-default); border-radius:var(--ui-radius-card); background:var(--ui-color-surface); overflow:hidden; }
.team-row { display:flex; align-items:center; gap:16rpx; width:100%; margin:0; padding:22rpx 24rpx; text-align:left; line-height:1.4; border:0; border-radius:0; background:transparent; }
.team-row + .team-row { border-top:var(--ui-border-default); }
.team-row--pressed { background:var(--ui-color-neutral-bg); }
.team-logo { width:64rpx; height:64rpx; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:50%; overflow:hidden; background:var(--ui-color-neutral-bg); color:var(--ui-color-text); font-size:26rpx; }
.team-logo image { width:100%; height:100%; }
.team-copy { flex:1; min-width:0; }
.team-name-row { display:flex; align-items:center; gap:12rpx; }
.team-name { color:var(--ui-color-text); font-size:28rpx; font-weight:600; overflow-wrap:anywhere; }
.team-current { flex-shrink:0; color:var(--ui-color-accent-deep); background:var(--ui-color-accent-soft); padding:2rpx 10rpx; border-radius:8rpx; font-size:20rpx; }
.team-meta { display: flex; align-items: center; gap: 8rpx; margin-top:6rpx; color:var(--ui-color-text-muted); font-size:22rpx; }
.team-empty { padding:28rpx; color:var(--ui-color-text-muted); font-size:24rpx; }

</style>
