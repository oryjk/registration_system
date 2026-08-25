<script setup lang="ts">
import { computed } from "vue";
import NeoButton from "@/components/neo/NeoButton.vue";
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

const visible = computed({
  get: () => props.visible,
  set: (value: boolean) => {
    if (!value) emit("close");
  },
});

const teamName = computed(() => props.match?.host_team_name || "该球队");


</script>

<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    custom-class="join-team-popup"
    :close-on-click-modal="!isSubmitting"
    safe-area-inset-bottom
    root-portal
    @close="emit('close')"
  >
    <view class="join-team-sheet">
      <view class="join-team-header">
        <view>
          <text class="join-team-kicker">加入球队</text>
          <text class="join-team-title">{{ teamName }}</text>
          <text class="join-team-copy">
            {{ needsPassword ? "该球队设置了入队密码，输入密码即可加入。" : "加入后即可报名本球队的队内比赛。" }}
          </text>
        </view>
      </view>

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

      <view class="join-team-actions">
        <NeoButton variant="outline" :disabled="isSubmitting" @click="emit('close')">我再想想</NeoButton>
        <NeoButton
          variant="dark"
          :loading="isSubmitting"
          :disabled="isSubmitting || (needsPassword && !password.trim())"
          @click="emit('confirm')"
        >
          {{ isSubmitting ? "加入中..." : "确认加入" }}
        </NeoButton>
      </view>
    </view>
  </wd-popup>
</template>

<style scoped>
.join-team-sheet {
  display: flex;
  flex-direction: column;
  gap: 26rpx;
  padding: 32rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  background: var(--neo-color-surface);
  border-radius: 32rpx 32rpx 0 0;
}

.join-team-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.join-team-kicker {
  display: block;
  font-size: 24rpx;
  font-weight: 800;
  color: var(--neo-color-text-muted);
}

.join-team-title {
  display: block;
  margin-top: 6rpx;
  font-size: 36rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.join-team-copy {
  display: block;
  margin-top: 8rpx;
  font-size: 25rpx;
  font-weight: 700;
  color: var(--neo-color-text-muted);
  line-height: 1.5;
}

.join-team-field {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.join-team-input {
  box-sizing: border-box;
  width: 100%;
  height: 92rpx;
  padding: 0 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-page);
  font-size: 28rpx;
  color: var(--neo-color-text);
}

.join-team-contact {
  display: flex;
  justify-content: center;
}

.join-team-contact-text {
  font-size: 25rpx;
  font-weight: 800;
  color: var(--neo-color-accent-deep);
  text-decoration: underline;
}

.join-team-actions {
  display: flex;
  gap: 18rpx;
}

.join-team-actions > :deep(*) {
  flex: 1;
}
</style>
