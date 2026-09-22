<script setup lang="ts">
import { computed, ref } from "vue";
import type { AvatarItem } from "@/components/ui/avatarTypes";
import { resolveDetailActions, type DetailAction } from "../detailPresentation";
import StickyActionBar from "@/components/ui/StickyActionBar.vue";
import AppButton from "@/components/ui/AppButton.vue";
import type { BackendActivity } from "@/types/backend";
import type { MatchTeamProgressItem } from "@/types/viewModels";
import IndividualInfoCard from "./IndividualInfoCard.vue";
import IndividualMatchupHero from "./IndividualMatchupHero.vue";
import MatchRegistrationStatusCard from "./MatchRegistrationStatusCard.vue";
import TeamMemberRegistrationBoard from "./TeamMemberRegistrationBoard.vue";

const props = defineProps<{
  match: BackendActivity;
  myRegistrationPaid: boolean;
  matchKindLabel: string;
  homeTeamLabel: string;
  displayOpponentLabel: string;
  homeTeamColor: string;
  awayTeamColor: string;
  homeTeamLogoUrl?: string;
  awayTeamLogoUrl?: string;
  matchClockLabel: string;
  matchLocation: string;
  joinedCount: number;
  participantPreview?: AvatarItem[];
  requiredPlayers: number;
  maxPlayers: number;
  countdownText: string;
  remainingPlayersLabel: string;
  submittingStatus: boolean;
  individualCtaLabel: string;
  isGuestMode: boolean;
  canSubmitIndividualRegistration: boolean;
  /** 报名已截止：隐藏所有修改报名状态的入口（待支付除外）。 */
  registrationClosed?: boolean;
  /** 散人约球（online_pickup）：唯一有人数调整语义的类型，由页面按 publication_mode 判定后传入。 */
  isPickupMatch?: boolean;
  /** 人均费用标签（如 ¥25.00）；空串表示免费。 */
  feeLabel?: string;
  /** 球队约队的主/客队双边报名进度；散人约局为空。 */
  teamProgress?: MatchTeamProgressItem[];
  /** 待支付报名费标签（按人数合计的总应付）；非空时主行动切换为「去支付」。 */
  pendingPaymentFeeLabel?: string;
  /** 待支付面板标题（如「已报 3 人 · 报名费待支付」）；缺省为「报名费待支付」。 */
  pendingPaymentTitle?: string;
  /** 支付流程进行中（下单/拉起/核销）。 */
  submittingPayment?: boolean;
  teamMemberRegistrationGroups: {
    joined: Array<{ userId: number; name: string; avatarUrl: string; tone: string; jerseyNumber: string; isCurrentUser: boolean }>;
    leave: Array<{ userId: number; name: string; avatarUrl: string; tone: string; jerseyNumber: string; isCurrentUser: boolean }>;
    pending: Array<{ userId: number; name: string; avatarUrl: string; tone: string; jerseyNumber: string; isCurrentUser: boolean }>;
  };
}>();

const emit = defineEmits<{
  (event: "avatarSelect", avatar: AvatarItem): void;
  (event: "openLocation"): void;
  (event: "selectIndividualSignup"): void;
  (event: "selectTeamMemberStand", value: 0 | 1 | 2): void;
  (event: "dialogVisibilityChange", visible: boolean): void;
  (event: "payRegistration"): void;
}>();

const showTeamMemberRegistrationBoard = computed(() => {
  const groups = props.teamMemberRegistrationGroups;
  return groups.joined.length + groups.leave.length + groups.pending.length > 0;
});

const hasPendingPayment = computed(() => !!props.pendingPaymentFeeLabel);

// 我的名单状态（与名单板同口径）：决定名单操作按钮的文案。
const myGroupStatus = computed<"joined" | "leave" | "pending">(() => {
  if (props.teamMemberRegistrationGroups.joined.some((member) => member.isCurrentUser)) return "joined";
  if (props.teamMemberRegistrationGroups.leave.some((member) => member.isCurrentUser)) return "leave";
  return "pending";
});

const rosterActionLabel = computed(() => {
  if (props.submittingStatus) return "提交中...";
  if (myGroupStatus.value === "joined") return "已报名 · 修改状态";
  if (myGroupStatus.value === "leave") return "已请假 · 修改状态";
  return "选择报名状态";
});

// 父级单一行动栏通过计数触发名单板的状态对话框（对话框本体留在名单板内）。
const statusDialogRequest = ref(0);
function requestRosterStatusAction() {
  if (props.submittingStatus) return;
  statusDialogRequest.value += 1;
}

const actions = computed(() => resolveDetailActions({
  closed: !!props.registrationClosed,
  pendingPayment: hasPendingPayment.value,
  pickup: !!props.isPickupMatch,
  hasRoster: showTeamMemberRegistrationBoard.value,
  paid: props.myRegistrationPaid,
}));
const busy = computed(() => props.submittingStatus || !!props.submittingPayment);
function actionLabel(action: DetailAction | null) {
  if (action === "pay") return props.submittingPayment ? "支付中..." : `去支付 ${props.pendingPaymentFeeLabel}`;
  if (action === "roster") return rosterActionLabel.value;
  return props.submittingStatus ? "提交中..." : props.individualCtaLabel;
}
function actionDisabled(action: DetailAction | null) {
  return busy.value || (action === "individual" && !props.canSubmitIndividualRegistration);
}
function runAction(action: DetailAction | null) {
  if (!action || actionDisabled(action)) return;
  // 拒绝窗口/付款状态改变后已经失效的事件。
  if (action !== actions.value.primary && action !== actions.value.secondary) return;
  if (action === "pay") emit("payRegistration");
  else if (action === "roster") requestRosterStatusAction();
  else emit("selectIndividualSignup");
}

function shareInBrowser() {
  uni.showModal({
    title: "分享报名详情",
    content: "请使用浏览器的分享功能，或复制当前页面链接发给队友。微信内可点击右上角菜单分享。",
    showCancel: false,
    confirmText: "知道了",
  });
}

function handleOpenLocation() {
  emit("openLocation");
}

function handleSelectTeamMemberStand(stand: 0 | 1 | 2) {
  if (props.registrationClosed || busy.value) return;
  emit("selectTeamMemberStand", stand);
}

function handleTeamMemberDialogVisibilityChange(visible: boolean) {
  emit("dialogVisibilityChange", visible);
}
</script>

<template>
  <view class="individual-mode-shell">
    <IndividualMatchupHero
      :match="match"
      :match-kind-label="matchKindLabel"
      :is-pickup-match="isPickupMatch"
      :fee-label="feeLabel"
      :joined-count="joinedCount"
      :home-team-label="homeTeamLabel"
      :display-opponent-label="displayOpponentLabel"
      :home-team-color="homeTeamColor"
      :away-team-color="awayTeamColor"
      :home-team-logo-url="homeTeamLogoUrl"
      :away-team-logo-url="awayTeamLogoUrl"
      :match-clock-label="matchClockLabel"
      :match-location="matchLocation"
      @open-location="handleOpenLocation"
    />
    <MatchRegistrationStatusCard
      @avatar-select="emit('avatarSelect', $event)"
      :participants="participantPreview"
      :joined-count="joinedCount"
      :required-players="requiredPlayers"
      :max-players="maxPlayers"
      :countdown-text="countdownText"
      :remaining-players-label="remainingPlayersLabel"
      :team-progress="teamProgress"
      :pending-payment-fee-label="pendingPaymentFeeLabel"
      :pending-payment-title="pendingPaymentTitle"
    />
    <TeamMemberRegistrationBoard
      @avatar-select="emit('avatarSelect', $event)"
      v-if="showTeamMemberRegistrationBoard"
      :groups="teamMemberRegistrationGroups"
      :submitting-status="submittingStatus"
      :status-dialog-request="statusDialogRequest"
      @select-stand="handleSelectTeamMemberStand"
      @dialog-visibility-change="handleTeamMemberDialogVisibilityChange"
    >
      <slot name="captain" />
    </TeamMemberRegistrationBoard>
    <slot v-if="!showTeamMemberRegistrationBoard" name="captain" />
    <IndividualInfoCard
      :description="match.description"
    />

    <!-- 单一行动栏：支付 > 名单状态 > 报名 CTA；支付态可叠加一个次行动入口。 -->
    <StickyActionBar v-if="actions.primary" flat>
      <AppButton
        v-if="actions.secondary"
        variant="outline"
        :disabled="actionDisabled(actions.secondary)"
        @click="runAction(actions.secondary)"
      >
        {{ actionLabel(actions.secondary) }}
      </AppButton>
      <view class="registration-actions">
        <!-- #ifdef MP-WEIXIN -->
        <button class="registration-share" open-type="share" hover-class="registration-share--pressed"><wd-icon name="share-external" size="34rpx" /><text>分享</text></button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button class="registration-share" hover-class="registration-share--pressed" @tap="shareInBrowser"><wd-icon name="share-external" size="34rpx" /><text>分享</text></button>
        <!-- #endif -->
        <view class="registration-primary">
      <AppButton
        :variant="actionDisabled(actions.primary) ? 'muted' : 'dark'"
        block
        :loading="busy"
        :disabled="actionDisabled(actions.primary)"
        @click="runAction(actions.primary)"
      >
        <view class="registration-button-content">
          <image v-if="actions.primary === 'pay'" class="registration-action-icon" src="/static/icons/lucide/wallet.png" mode="aspectFit" aria-hidden="true" />
          <wd-icon v-else :name="actions.primary === 'roster' ? 'edit' : 'check-circle'" size="34rpx" />
          <text>{{ actionLabel(actions.primary) }}</text>
        </view>
      </AppButton>
        </view>
      </view>
    </StickyActionBar>
  </view>
</template>

<style scoped>
.individual-mode-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.registration-actions { display: flex; align-items: stretch; gap: 16rpx; width: 100%; }
.registration-share {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  flex: 0 0 152rpx;
  height: var(--ui-button-height-md);
  margin: 0;
  padding: 0 20rpx;
  border: 0;
  border-radius: var(--ui-button-radius);
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-text);
  font-size: var(--ui-button-font-size-md);
  font-weight: var(--ui-button-font-weight);
  line-height: 1.4;
  box-sizing: border-box;
}
.registration-share::after { border: 0; }
.registration-share--pressed { opacity: 0.75; }
.registration-primary { flex: 1; min-width: 0; }
.registration-button-content { display: flex; align-items: center; justify-content: center; gap: 12rpx; }
.registration-action-icon { width: 34rpx; height: 34rpx; flex-shrink: 0; }
</style>
