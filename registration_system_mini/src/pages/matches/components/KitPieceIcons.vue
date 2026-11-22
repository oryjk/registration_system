<script setup lang="ts">
import { computed } from "vue";
import { isLightKitColor, kitStrokeColor, normalizeKitColorHex } from "@/utils/kitColors";

const props = withDefaults(
  defineProps<{
    shirtColor?: string | null;
    shortsColor?: string | null;
    socksColor?: string | null;
    size?: "sm" | "md" | "lg";
    onDark?: boolean;
  }>(),
  {
    shirtColor: "",
    shortsColor: "",
    socksColor: "",
    size: "md",
    onDark: false,
  },
);

const shirtHex = computed(() => normalizeKitColorHex(props.shirtColor));
const shortsHex = computed(() => normalizeKitColorHex(props.shortsColor));
const socksHex = computed(() => normalizeKitColorHex(props.socksColor));

const hasAnyPiece = computed(() => !!(shirtHex.value || shortsHex.value || socksHex.value));

function pieceVars(hex: string) {
  const stroke = kitStrokeColor(hex, props.onDark);
  const accent = isLightKitColor(hex) ? "rgba(0, 33, 77, 0.22)" : "rgba(255, 255, 255, 0.34)";
  return {
    "--kit-fill": hex,
    "--kit-stroke": stroke,
    "--kit-detail": accent,
  };
}

const shirtStyle = computed(() => (shirtHex.value ? pieceVars(shirtHex.value) : undefined));
const shortsStyle = computed(() => (shortsHex.value ? pieceVars(shortsHex.value) : undefined));
const socksStyle = computed(() => (socksHex.value ? pieceVars(socksHex.value) : undefined));
</script>

<template>
  <view v-if="hasAnyPiece" :class="['kit-pieces', `kit-pieces--${size}`]" aria-hidden="true">
    <!-- 短袖球衣 -->
    <view v-if="shirtHex" class="kit-piece kit-shirt" :style="shirtStyle">
      <view class="kit-shirt__sleeve kit-shirt__sleeve--left" />
      <view class="kit-shirt__sleeve kit-shirt__sleeve--right" />
      <view class="kit-shirt__torso" />
      <view class="kit-shirt__join" />
      <view class="kit-shirt__collar" />
    </view>

    <!-- 足球短裤 -->
    <view v-if="shortsHex" class="kit-piece kit-shorts" :style="shortsStyle">
      <view class="kit-shorts__leg kit-shorts__leg--left" />
      <view class="kit-shorts__leg kit-shorts__leg--right" />
      <view class="kit-shorts__waist" />
      <view class="kit-shorts__bridge" />
    </view>

    <!-- 一对长筒球袜 -->
    <view v-if="socksHex" class="kit-piece kit-socks" :style="socksStyle">
      <view class="kit-sock kit-sock--left">
        <view class="kit-sock__foot" />
        <view class="kit-sock__calf" />
        <view class="kit-sock__ankle" />
        <view class="kit-sock__cuff" />
      </view>
      <view class="kit-sock kit-sock--right">
        <view class="kit-sock__foot" />
        <view class="kit-sock__calf" />
        <view class="kit-sock__ankle" />
        <view class="kit-sock__cuff" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.kit-pieces {
  display: inline-flex;
  align-items: flex-end;
  justify-content: center;
  flex-shrink: 0;
  gap: 8rpx;
}

.kit-piece {
  position: relative;
  flex-shrink: 0;
  box-sizing: border-box;
}

/* ==================== 短袖球衣 ==================== */
.kit-shirt__sleeve {
  position: absolute;
  box-sizing: border-box;
  background: var(--kit-fill);
  border: 2rpx solid var(--kit-stroke);
}

.kit-shirt__sleeve--left {
  transform: rotate(-30deg);
}

.kit-shirt__sleeve--right {
  transform: rotate(30deg);
}

.kit-shirt__torso {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  box-sizing: border-box;
  background: var(--kit-fill);
  border: 2rpx solid var(--kit-stroke);
}

.kit-shirt__join {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: var(--kit-fill);
}

.kit-shirt__collar {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  box-sizing: border-box;
  background: var(--kit-detail);
  border-bottom: 2rpx solid var(--kit-stroke);
  border-left: 2rpx solid var(--kit-stroke);
  border-right: 2rpx solid var(--kit-stroke);
}

/* ==================== 足球短裤 ==================== */
.kit-shorts__waist {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  box-sizing: border-box;
  background: var(--kit-fill);
  border: 2rpx solid var(--kit-stroke);
}

.kit-shorts__leg {
  position: absolute;
  bottom: 0;
  box-sizing: border-box;
  background: var(--kit-fill);
  border: 2rpx solid var(--kit-stroke);
}

.kit-shorts__leg--left {
  transform: rotate(5deg);
}

.kit-shorts__leg--right {
  transform: rotate(-5deg);
}

.kit-shorts__bridge {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: var(--kit-fill);
}

/* ==================== 一对长筒球袜 ==================== */
.kit-sock {
  position: absolute;
  bottom: 0;
}

.kit-sock__calf {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  background: var(--kit-fill);
  border: 2rpx solid var(--kit-stroke);
}

.kit-sock__foot {
  position: absolute;
  bottom: 0;
  left: 0;
  box-sizing: border-box;
  background: var(--kit-fill);
  border: 2rpx solid var(--kit-stroke);
}

.kit-sock__ankle {
  position: absolute;
  background: var(--kit-fill);
}

.kit-sock__cuff {
  position: absolute;
  background: var(--kit-detail);
}

/* ==================== Size: sm (详情页紧凑) ==================== */
.kit-pieces--sm { gap: 6rpx; }

.kit-pieces--sm .kit-shirt { width: 32rpx; height: 28rpx; }
.kit-pieces--sm .kit-shirt__sleeve { top: 3rpx; width: 10rpx; height: 12rpx; border-radius: 3rpx; }
.kit-pieces--sm .kit-shirt__sleeve--left { left: 2rpx; }
.kit-pieces--sm .kit-shirt__sleeve--right { right: 2rpx; }
.kit-pieces--sm .kit-shirt__torso { top: 2rpx; width: 18rpx; height: 26rpx; border-radius: 4rpx 4rpx 3rpx 3rpx; }
.kit-pieces--sm .kit-shirt__join { top: 4rpx; width: 20rpx; height: 9rpx; border-radius: 3rpx; }
.kit-pieces--sm .kit-shirt__collar { top: 2rpx; width: 9rpx; height: 5rpx; border-radius: 0 0 6rpx 6rpx; }

.kit-pieces--sm .kit-shorts { width: 24rpx; height: 22rpx; }
.kit-pieces--sm .kit-shorts__waist { width: 20rpx; height: 7rpx; border-radius: 3rpx 3rpx 2rpx 2rpx; }
.kit-pieces--sm .kit-shorts__leg { width: 10rpx; height: 18rpx; border-radius: 2rpx 2rpx 3rpx 3rpx; }
.kit-pieces--sm .kit-shorts__leg--left { left: 2rpx; }
.kit-pieces--sm .kit-shorts__leg--right { right: 2rpx; }
.kit-pieces--sm .kit-shorts__bridge { top: 4rpx; width: 16rpx; height: 6rpx; }

.kit-pieces--sm .kit-socks { width: 24rpx; height: 24rpx; }
.kit-pieces--sm .kit-sock { width: 12rpx; height: 24rpx; }
.kit-pieces--sm .kit-sock--left { left: 0; }
.kit-pieces--sm .kit-sock--right { right: 0; }
.kit-pieces--sm .kit-sock__calf { width: 8rpx; height: 19rpx; border-radius: 2rpx; }
.kit-pieces--sm .kit-sock__foot { width: 12rpx; height: 8rpx; border-radius: 3rpx 5rpx 4rpx 4rpx; }
.kit-pieces--sm .kit-sock__ankle { left: 2rpx; bottom: 4rpx; width: 5rpx; height: 6rpx; }
.kit-pieces--sm .kit-sock__cuff { top: 4rpx; left: 2rpx; width: 4rpx; height: 2rpx; }

/* ==================== Size: md (创建页表单行) ==================== */
.kit-pieces--md { gap: 10rpx; }

.kit-pieces--md .kit-shirt { width: 46rpx; height: 40rpx; }
.kit-pieces--md .kit-shirt__sleeve { top: 4rpx; width: 14rpx; height: 18rpx; border-radius: 4rpx; }
.kit-pieces--md .kit-shirt__sleeve--left { left: 3rpx; }
.kit-pieces--md .kit-shirt__sleeve--right { right: 3rpx; }
.kit-pieces--md .kit-shirt__torso { top: 2rpx; width: 26rpx; height: 38rpx; border-radius: 6rpx 6rpx 4rpx 4rpx; }
.kit-pieces--md .kit-shirt__join { top: 5rpx; width: 28rpx; height: 13rpx; border-radius: 4rpx; }
.kit-pieces--md .kit-shirt__collar { top: 2rpx; width: 12rpx; height: 7rpx; border-radius: 0 0 8rpx 8rpx; }

.kit-pieces--md .kit-shorts { width: 34rpx; height: 32rpx; }
.kit-pieces--md .kit-shorts__waist { width: 28rpx; height: 10rpx; border-radius: 4rpx 4rpx 2rpx 2rpx; }
.kit-pieces--md .kit-shorts__leg { width: 14rpx; height: 26rpx; border-radius: 3rpx 3rpx 4rpx 4rpx; }
.kit-pieces--md .kit-shorts__leg--left { left: 3rpx; }
.kit-pieces--md .kit-shorts__leg--right { right: 3rpx; }
.kit-pieces--md .kit-shorts__bridge { top: 5rpx; width: 22rpx; height: 9rpx; }

.kit-pieces--md .kit-socks { width: 34rpx; height: 34rpx; }
.kit-pieces--md .kit-sock { width: 17rpx; height: 34rpx; }
.kit-pieces--md .kit-sock--left { left: 0; }
.kit-pieces--md .kit-sock--right { right: 0; }
.kit-pieces--md .kit-sock__calf { width: 11rpx; height: 27rpx; border-radius: 3rpx; }
.kit-pieces--md .kit-sock__foot { width: 17rpx; height: 11rpx; border-radius: 4rpx 7rpx 5rpx 5rpx; }
.kit-pieces--md .kit-sock__ankle { left: 2rpx; bottom: 5rpx; width: 7rpx; height: 8rpx; }
.kit-pieces--md .kit-sock__cuff { top: 6rpx; left: 2rpx; width: 7rpx; height: 3rpx; }

/* ==================== Size: lg (选色弹层大预览) ==================== */
.kit-pieces--lg { gap: 18rpx; }

.kit-pieces--lg .kit-shirt { width: 76rpx; height: 66rpx; }
.kit-pieces--lg .kit-shirt__sleeve { top: 6rpx; width: 22rpx; height: 30rpx; border-radius: 6rpx; }
.kit-pieces--lg .kit-shirt__sleeve--left { left: 5rpx; }
.kit-pieces--lg .kit-shirt__sleeve--right { right: 5rpx; }
.kit-pieces--lg .kit-shirt__torso { top: 3rpx; width: 42rpx; height: 62rpx; border-radius: 8rpx 8rpx 6rpx 6rpx; }
.kit-pieces--lg .kit-shirt__join { top: 8rpx; width: 46rpx; height: 22rpx; border-radius: 6rpx; }
.kit-pieces--lg .kit-shirt__collar { top: 3rpx; width: 18rpx; height: 10rpx; border-radius: 0 0 12rpx 12rpx; }

.kit-pieces--lg .kit-shorts { width: 58rpx; height: 52rpx; }
.kit-pieces--lg .kit-shorts__waist { width: 48rpx; height: 14rpx; border-radius: 6rpx 6rpx 3rpx 3rpx; }
.kit-pieces--lg .kit-shorts__leg { width: 24rpx; height: 42rpx; border-radius: 4rpx 4rpx 6rpx 6rpx; }
.kit-pieces--lg .kit-shorts__leg--left { left: 4rpx; }
.kit-pieces--lg .kit-shorts__leg--right { right: 4rpx; }
.kit-pieces--lg .kit-shorts__bridge { top: 8rpx; width: 38rpx; height: 14rpx; }

.kit-pieces--lg .kit-socks { width: 56rpx; height: 56rpx; }
.kit-pieces--lg .kit-sock { width: 28rpx; height: 56rpx; }
.kit-pieces--lg .kit-sock--left { left: 0; }
.kit-pieces--lg .kit-sock--right { right: 0; }
.kit-pieces--lg .kit-sock__calf { width: 17rpx; height: 44rpx; border-radius: 5rpx; }
.kit-pieces--lg .kit-sock__foot { width: 28rpx; height: 17rpx; border-radius: 6rpx 10rpx 8rpx 8rpx; }
.kit-pieces--lg .kit-sock__ankle { left: 3rpx; bottom: 8rpx; width: 11rpx; height: 12rpx; }
.kit-pieces--lg .kit-sock__cuff { top: 9rpx; left: 3rpx; width: 11rpx; height: 4rpx; }
</style>
