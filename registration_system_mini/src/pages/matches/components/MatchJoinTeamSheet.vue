<script setup lang="ts">
import { computed } from "vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import type { AppMatchSummary } from "@/types/match";

const props = defineProps<{
  visible: boolean;
  match: AppMatchSummary | null;
  needsPassword: boolean;
  password: string;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "confirm"): void;
  (event: "update:password", value: string): void;
  (event: "contactCaptain"): void;
}>();

const teamName = computed(() => props.match?.host_team_name || "该球队");

const message = computed(() =>
  props.needsPassword
    ? `「${teamName.value}」设置了入队密码，输入密码即可加入。`
    : `加入「${teamName.value}」后即可报名本球队的队内比赛。`,
);

const confirmDisabled = computed(() => props.needsPassword && !props.password.trim());
</script>

<template>
  <ConfirmDialog
    :visible="visible"
    title="加入球队"
    :message="message"
    :highlight="teamName"
    primary-text="确认加入"
    secondary-text="我再想想"
    :loading="isSubmitting"
    :primary-disabled="confirmDisabled"
    @primary="emit('confirm')"
    @secondary="emit('close')"
    @close="emit('close')"
  >
    <view v-if="needsPassword" class="join-team-field">
      <input
        class="join-team-input"
        type="safe-password"
        password
        :value="password"
        placeholder="输入入队密码"
        :disabled="isSubmitting"
        @input="emit('update:password', ($event as any).detail.value)"
      />
      <view class="join-team-contact" @tap="!isSubmitting && emit('contactCaptain')">
        <text class="join-team-contact-text">不知道密码？联系队长说明来意</text>
      </view>
    </view>
  </ConfirmDialog>
</template>

<style scoped>
.join-team-field {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 26rpx;
}

.join-team-input {
  box-sizing: border-box;
  width: 100%;
  height: 92rpx;
  padding: 0 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-page);
  font-size: 28rpx;
  color: var(--ui-color-text);
}

.join-team-contact {
  display: flex;
  justify-content: center;
}

.join-team-contact-text {
  font-size: 25rpx;
  font-weight: 500;
  color: var(--ui-color-accent-deep);
  text-decoration: underline;
}
</style>
