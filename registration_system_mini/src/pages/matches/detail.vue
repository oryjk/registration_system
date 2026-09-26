<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed, ref } from "vue";
import { onShow, onHide, onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import AvatarPreviewDialog from "@/components/ui/AvatarPreviewDialog.vue";
import type { AvatarItem } from "@/components/ui/avatarTypes";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import MatchSignupCountSheet from "./components/MatchSignupCountSheet.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import MatchFinishCard from "./components/MatchFinishCard.vue";
import MatchCaptainContact from "./components/MatchCaptainContact.vue";
import MatchScoreCard from "./components/MatchScoreCard.vue";
import MatchScoreDialog from "./components/MatchScoreDialog.vue";
import MatchJoinTeamSheet from "./components/MatchJoinTeamSheet.vue";
import MatchIndividualRegistration from "./components/MatchIndividualRegistration.vue";
import { useShareCover } from "@/composables/useShareCover";

import { useMatchCaptainContact } from "./useMatchCaptainContact";
import { useMatchDetailPage } from "./useMatchDetailPage";
import { useMatchTeamApplications } from "./useMatchTeamApplications";
import MatchTeamApplications from "./components/MatchTeamApplications.vue";

const { shareCoverUrl, refreshShareCover } = useShareCover("match");
onShow(() => { void refreshShareCover(); });

defineOptions({ inheritAttrs: false });

const {
  matchId,
  pageStyle,
  contentStyle,
  errorMessage,
  isLoading,
  match,
  sourceMatch,
  matchTeamGroups,
  teamProgressItems,
  isRegistrationReadOnly,
  matchKindLabel,
  homeTeamLabel,
  displayOpponentLabel,
  homeTeamColor,
  awayTeamColor,
  homeTeamLogoUrl,
  awayTeamLogoUrl,
  matchClockLabel,
  matchLocation,
  joinedCount,
  participantPreview,
  selectedGroupMinPlayers,
  selectedGroupMaxPlayers,
  countdownText,
  currentStatus,
  teamMemberRegistrationGroups,
  submittingStatus,
  pendingPaymentFeeLabel,
  submittingPayment,
  handlePayRegistration,
  confirmRegistrationAction,
  confirmDialogVisible,
  confirmDialogState,
  handleConfirmPrimary,
  handleConfirmSecondary,
  handleConfirmClose,
  individualCtaLabel,
  canSubmitIndividualRegistration,
  isGuestMode,
  isPickupMatch,
  myRegistrationPaid,
  myRegistrationCount,
  signupSheetVisible,
  signupMaxCount,
  feePerPersonLabel,
  matchFeeLabel,
  closeSignupSheet,
  handleSignupSheetConfirm,
  handleSignupSheetCancelRegistration,
  currentTeam,
  currentUser,
  openMatchLocation,
  handleSelectIndividualSignup,
  joinTeamSheet,
  handleSelectTeamMemberStand,
  canFinishMatch,
  canCancelMatch,
  finishDialogVisible,
  handleOpenFinishDialog,
  handleCloseFinishDialog,
  handleFinishMatch,
  cancelDialogVisible,
  cancelDialogState,
  handleCancelMatch,
  handleCancelPrimary,
  handleCancelSecondary,
  handleCancelClose,
  matchScore,
  loadPageData,
} = useMatchDetailPage();

const {
  applications: matchApplications,
  isLoading: applicationsLoading,
  isSelecting: applicationSelecting,
  loadErrorMessage: applicationsError,
  canManageApplications,
  selectOpponent: selectMatchOpponent,
} = useMatchTeamApplications(sourceMatch, loadPageData, confirmRegistrationAction);

const captainContact = useMatchCaptainContact();
function openMatchEditor() {
  if (!sourceMatch.value) return;
  const page = isPickupMatch.value ? "/pages/challenges/create-individual/index" : "/pages/matches/create/index";
  uni.navigateTo({ url: `${page}?editId=${sourceMatch.value.id}` });
}
// 主队管理者可编辑比赛（对手名称与报名上限）；口径与接约申请的管理者判定一致。
const canEditMatch = computed(() => {
  const source = sourceMatch.value;
  if (!source || isGuestMode.value || source.status === "ended" || source.status === "cancelled") return false;
  if (source.publication_mode === "online_pickup") return source.created_by_user_id === currentUser.value?.id;
  return !!source?.host_team_id
    && currentTeam.value?.id === source.host_team_id
    && !!currentTeam.value?.canManageTeam;
});
// 仅当详情带主队队长、且当前用户不是主队管理者（口径与接约申请一致：当前球队=主队且有管理权）时展示。
const captainContactCaptain = computed(() => {
  const source = sourceMatch.value;
  if (isGuestMode.value || !source?.host_captain) return null;
  const isHostManager = currentTeam.value?.id === source.host_team_id && !!currentTeam.value?.canManageTeam;
  return isHostManager ? null : source.host_captain;
});

const shareTitle = computed(() => {
  if (!match.value) return "邀请你参加比赛报名";
  return `邀请你报名：${match.value.name}`;
});

const sharePath = computed(() => `/pages/matches/detail?id=${matchId.value || match.value?.id || ""}`);
const teamMemberDialogVisible = ref(false);
const previewAvatar = ref<AvatarItem | null>(null);
const avatarPreviewVisible = ref(false);
const avatarPreviewRendered = ref(false);
function openAvatarPreview(avatar: AvatarItem) {
  previewAvatar.value = { ...avatar };
  avatarPreviewVisible.value = true;
}
onHide(() => { avatarPreviewVisible.value = false; });

function openMatchHall() {
  uni.switchTab({ url: "/pages/activities/index" });
}

function handleTeamMemberDialogVisibilityChange(visible: boolean) {
  teamMemberDialogVisible.value = visible;
}

// 加入球队弹框里点「联系队长」：收起加入弹框，打开给队长留言的弹窗。
function handleJoinSheetContactCaptain() {
  joinTeamSheet.requestContactCaptain();
  captainContact.open();
}

onShareAppMessage(() => ({
  title: shareTitle.value,
  path: sharePath.value,
  imageUrl: shareCoverUrl.value,
}));

onShareTimeline(() => ({
  title: shareTitle.value,
  query: `id=${matchId.value || match.value?.id || ""}`,
  imageUrl: shareCoverUrl.value,
}));

// page-meta：主题变量覆盖 + 任一弹层打开时锁定滚动。
const { themePageStyle } = useAccentTheme();
const metaPageStyle = computed(() =>
  [
    themePageStyle.value,
    avatarPreviewRendered.value || teamMemberDialogVisible.value || confirmDialogVisible.value || finishDialogVisible.value || cancelDialogVisible.value || signupSheetVisible.value || captainContact.popupVisible.value || joinTeamSheet.sheetVisible.value || matchScore.dialogVisible.value
      ? "overflow: hidden;"
      : "",
  ].filter(Boolean).join(";"),
);
</script>

<template>
  <page-meta :page-style="metaPageStyle" />
  <view class="app-theme-scope registration-page" :style="[themePageStyle, pageStyle]">
    <!-- 导航标题用比赛名（加载前回落通用标题），页面卡片内不再重复大标题。 -->
    <AppTabHeader :title="match?.name || '比赛报名'" showBack />

    <view class="registration-content" :style="contentStyle">
      <view v-if="errorMessage" class="registration-empty">
        <text>{{ errorMessage }}</text>
        <AppButton @click="openMatchHall">返回约球大厅</AppButton>
      </view>
      <RunningLoader v-else-if="isLoading" text="正在前往比赛" />

      <view v-else-if="match" class="registration-shell">
      <MatchIndividualRegistration
        @avatar-select="openAvatarPreview"
        :match="match"
        :match-kind-label="matchKindLabel"
        :home-team-label="homeTeamLabel"
        :display-opponent-label="displayOpponentLabel"
        :home-team-color="homeTeamColor"
        :away-team-color="awayTeamColor"
        :home-team-logo-url="homeTeamLogoUrl"
        :away-team-logo-url="awayTeamLogoUrl"
        :match-clock-label="matchClockLabel"
        :match-location="matchLocation"
        :participant-preview="participantPreview"
        :joined-count="joinedCount"
        :required-players="selectedGroupMinPlayers ?? 0"
        :max-players="selectedGroupMaxPlayers ?? 0"
        :countdown-text="countdownText"
        :submitting-status="submittingStatus"
        :individual-cta-label="individualCtaLabel"
        :is-guest-mode="isGuestMode"
        :can-submit-individual-registration="canSubmitIndividualRegistration"
        :registration-closed="isRegistrationReadOnly"
        :is-pickup-match="isPickupMatch"
        :my-registration-paid="myRegistrationPaid"
        :fee-label="matchFeeLabel"
        :team-progress="teamProgressItems"
        :pending-payment-fee-label="pendingPaymentFeeLabel"
        :pending-payment-title="currentStatus === '参加' ? `已报 ${myRegistrationCount} 人 · 报名费待支付` : ''"
        :submitting-payment="submittingPayment"
        :team-member-registration-groups="teamMemberRegistrationGroups"
        @open-location="openMatchLocation"
        @select-individual-signup="handleSelectIndividualSignup"
        @pay-registration="handlePayRegistration"
        @select-team-member-stand="handleSelectTeamMemberStand"
        @dialog-visibility-change="handleTeamMemberDialogVisibilityChange"
      >
        <template #captain>
      <!-- 联系主队队长：入口在此，往来留言在消息中心查看。 -->
      <MatchCaptainContact
        @avatar-select="openAvatarPreview"
        v-if="captainContactCaptain && matchId"
        :captain="captainContactCaptain"
        embedded
        :match-id="matchId"
        :popup-visible="captainContact.popupVisible.value"
        :content="captainContact.content.value"
        :is-submitting="captainContact.isSubmitting.value"
        @open="captainContact.open"
        @close="captainContact.close"
        @update:content="captainContact.content.value = $event"
        @submit="void captainContact.submit(matchId)"
      />
        </template>
      </MatchIndividualRegistration>



      <!-- 管理区收拢：编辑/接约申请/收尾集中在同一「比赛管理」分区，各功能保留原角色门控。 -->
      <view
        v-if="canEditMatch || canManageApplications || ((canFinishMatch || canCancelMatch) && sourceMatch)"
        class="match-admin-zone"
      >
        <SectionHeader title="比赛管理" />
        <AppSurface v-if="canEditMatch || (canCancelMatch && sourceMatch)" variant="outlined">
          <view class="match-manage-actions">
            <button v-if="canEditMatch" class="match-manage-action" hover-class="match-manage-action--pressed" :disabled="submittingStatus" @tap="openMatchEditor">
              修改比赛
            </button>
            <button v-if="canCancelMatch && sourceMatch" class="match-manage-action match-manage-action--cancel" hover-class="match-manage-action--pressed" :disabled="submittingStatus" @tap="handleCancelMatch">
              {{ submittingStatus ? '处理中…' : '取消比赛' }}
            </button>
          </view>
        </AppSurface>

        <!-- 接约申请是主队管理功能，不依赖“球队报名”标签（Go 比赛没有该标签）。 -->
        <MatchTeamApplications
          v-if="canManageApplications"
          :applications="matchApplications"
          :is-loading="applicationsLoading"
          :is-selecting="applicationSelecting"
          :load-error-message="applicationsError"
          @select-opponent="selectMatchOpponent"
        />
        <!-- 主队管理方在比赛过结束时间后收尾比赛。 -->
        <MatchFinishCard
          v-if="canFinishMatch && !canCancelMatch && sourceMatch"
          :match="sourceMatch"
          :submitting-status="submittingStatus"
          :can-cancel="false"
          @open-finish-dialog="handleOpenFinishDialog"
          @cancel-match="handleCancelMatch"
        />
      </view>
      <!-- 比分卡：已录入对比分时所有人可见；比赛管理员可录入/修正。 -->
      <MatchScoreCard
        v-if="(matchScore.recordedScore.value || matchScore.canRecordScore.value) && sourceMatch"
        :match="sourceMatch"
        :recorded-score="matchScore.recordedScore.value"
        :can-record="matchScore.canRecordScore.value"
        @open-score-dialog="matchScore.open"
      />
      </view>
    </view>


    <ConfirmDialog
      :visible="confirmDialogVisible"
      :title="confirmDialogState.title"
      :message="confirmDialogState.message"
      :highlight="confirmDialogState.highlight"
      :primary-icon="confirmDialogState.primaryIcon"
      :secondary-icon="confirmDialogState.secondaryIcon"
      :primary-text="confirmDialogState.primaryText"
      :secondary-text="confirmDialogState.secondaryText"
      :primary-tone="confirmDialogState.primaryTone"
      :loading="submittingStatus"
      @primary="handleConfirmPrimary"
      @secondary="handleConfirmSecondary"
      @close="handleConfirmClose"
    />

    <!-- 结束比赛：主按钮=正常结束，次按钮=取消比赛，遮罩/× 只是关闭不改动状态。
         赛前支付的比赛不支持取消（后端同样拦截），只保留正常结束。 -->
    <ConfirmDialog
      :visible="finishDialogVisible"
      title="结束比赛"
      message="比赛时间已过，请选择本场比赛的最终结果。"
      primary-text="比赛结束"
      :secondary-text="sourceMatch?.payment_mode === 'prepaid' ? '' : '比赛取消'"
      :loading="submittingStatus"
      @primary="handleFinishMatch('ended')"
      @secondary="handleFinishMatch('cancelled')"
      @close="handleCloseFinishDialog"
    />

    <!-- 赛前取消比赛：创建者二次确认（danger），确认后提交 cancelled。 -->
    <ConfirmDialog
      :visible="cancelDialogVisible"
      :title="cancelDialogState.title"
      :message="cancelDialogState.message"
      :highlight="cancelDialogState.highlight"
      :primary-text="cancelDialogState.primaryText"
      :secondary-text="cancelDialogState.secondaryText"
      :primary-tone="cancelDialogState.primaryTone"
      :loading="submittingStatus"
      @primary="handleCancelPrimary"
      @secondary="handleCancelSecondary"
      @close="handleCancelClose"
    />

    <!-- 录入比分：比赛管理员专用。 -->
    <MatchScoreDialog
      :visible="matchScore.dialogVisible.value"
      :host-team-label="sourceMatch?.host_team_name || '主队'"
      :away-team-label="sourceMatch?.away_team_name || sourceMatch?.opponent_name || '客队'"
      :host-score="matchScore.hostScore.value"
      :away-score="matchScore.awayScore.value"
      :submitting="matchScore.isSubmitting.value"
      @close="matchScore.close"
      @update:host-score="matchScore.hostScore.value = $event"
      @update:away-score="matchScore.awayScore.value = $event"
      @submit="void matchScore.submit()"
    />

    <!-- 非比赛球队成员：加入主队球队（无密码直接加入，有密码可输入或转联系队长）。 -->
    <MatchJoinTeamSheet
      :visible="joinTeamSheet.sheetVisible.value"
      :match="sourceMatch"
      :needs-password="joinTeamSheet.needsPassword.value"
      :password="joinTeamSheet.password.value"
      :is-submitting="joinTeamSheet.isSubmitting.value"
      @close="joinTeamSheet.close"
      @confirm="void joinTeamSheet.confirmJoin()"
      @update:password="joinTeamSheet.password.value = $event"
      @contact-captain="handleJoinSheetContactCaptain"
    />

    <!-- 散人约球：报名人数选择（一人可代朋友报名，费用按人数合计）。 -->
    <MatchSignupCountSheet
      :visible="signupSheetVisible"
      :max-count="signupMaxCount"
      :current-count="currentStatus === '参加' ? myRegistrationCount : 1"
      :fee-per-person-label="feePerPersonLabel"
      :fee-type="sourceMatch?.fee_type"
      :submitting="submittingStatus"
      :can-cancel="currentStatus === '参加' && !myRegistrationPaid"
      @close="closeSignupSheet"
      @confirm="handleSignupSheetConfirm"
      @cancel-registration="handleSignupSheetCancelRegistration"
    />
    <AvatarPreviewDialog
      :visible="avatarPreviewVisible"
      :avatar="previewAvatar"
      @close="avatarPreviewVisible = false"
      @presence="avatarPreviewRendered = $event"
    />
  </view>
</template>

<style scoped>
.registration-page {
  min-height: 100vh;
  padding-left: 24rpx;
  padding-right: 24rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.registration-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

/* 管理区：独立分区收拢编辑/接约/收尾，内部各功能仍按角色单独显隐。 */
.match-admin-zone {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.match-manage-actions { display: flex; gap: 16rpx; }
.match-manage-action {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  min-height: 72rpx;
  margin: 0;
  padding: 12rpx 16rpx;
  border: 0;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 500;
  line-height: 1.4;
}
.match-manage-action::after { border: 0; }
.match-manage-action--cancel { background: var(--ui-color-danger-bg); color: var(--ui-color-danger-fg); }
.match-manage-action--pressed { opacity: 0.75; }
.match-manage-action[disabled] { opacity: 0.5; }

.registration-segment {
  width: 100%;
}

.registration-empty {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  align-items: center;
  justify-content: center;
  min-height: 520rpx;
  color: var(--ui-color-text-muted);
  font-size: 30rpx;
  font-weight: 400;
}

/* #ifdef H5 */
.registration-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.registration-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */

</style>
