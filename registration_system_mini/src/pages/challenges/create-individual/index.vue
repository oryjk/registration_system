<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { createChallenge } from "@/api/challenge";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";

const { currentTeam, ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();
const submitting = ref(false);

const form = reactive({
  title: "周三晚散人局",
  date: "",
  startTime: "20:00",
  endTime: "22:00",
  location: "",
  playersPerTeam: "14",
  feePerPerson: "",
  note: "",
});

const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

const canSubmit = computed(
  () =>
    !!currentTeam.value?.canManageTeam &&
    !!form.title.trim() &&
    !!form.date &&
    !!form.startTime &&
    !!form.endTime &&
    !!form.location.trim() &&
    !submitting.value,
);

function defaultPublishDate() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function combineDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function handleDateChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  form.date = detail.detail?.value ?? form.date;
}

function handleStartTimeChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  form.startTime = detail.detail?.value ?? form.startTime;
}

function handleEndTimeChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  form.endTime = detail.detail?.value ?? form.endTime;
}

function validateForm() {
  if (!currentTeam.value?.canManageTeam) return "只有队长或领队可以发布散人约队";
  if (!form.title.trim() || !form.date || !form.location.trim()) return "请补全标题、日期和场地";

  const playersPerTeam = Number(form.playersPerTeam || 0);
  if (!Number.isFinite(playersPerTeam) || playersPerTeam <= 0) return "请填写正确的招募人数";

  const feePerPerson = form.feePerPerson ? Number(form.feePerPerson) : null;
  if (feePerPerson !== null && (!Number.isFinite(feePerPerson) || feePerPerson < 0)) return "请填写正确的费用";

  if (combineDateTime(form.date, form.endTime) <= combineDateTime(form.date, form.startTime)) return "结束时间必须晚于开始时间";

  return "";
}

async function handleSubmit() {
  if (submitting.value) return;

  const message = validateForm();
  if (message || !currentTeam.value) {
    uni.showToast({
      title: message || "请先选择球队",
      icon: "none",
    });
    return;
  }

  const feePerPerson = form.feePerPerson ? Number(form.feePerPerson) : null;
  submitting.value = true;
  try {
    const challenge = await createChallenge({
      kind: "individual",
      host_team_id: currentTeam.value.id,
      title: form.title.trim(),
      holding_date: combineDateTime(form.date, form.startTime),
      start_time: combineDateTime(form.date, form.startTime),
      end_time: combineDateTime(form.date, form.endTime),
      location: form.location.trim(),
      players_per_team: Number(form.playersPerTeam),
      fee_per_person: feePerPerson !== null ? feePerPerson.toFixed(2) : undefined,
      note: form.note.trim() || undefined,
    });

    uni.showToast({
      title: "散人约队已发布",
      icon: "none",
    });
    uni.redirectTo({
      url: `/pages/challenges/detail?id=${challenge.id}`,
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "发布失败",
      icon: "none",
    });
  } finally {
    submitting.value = false;
  }
}

onShow(async () => {
  await ensureSessionReady();
  if (!form.date) {
    form.date = defaultPublishDate();
  }
});
</script>

<template>
  <view class="individual-create-page" :style="pageStyle">
    <AppTabHeader title="散人约队" showBack />

    <view class="create-hero">
      <view>
        <wd-text custom-class="create-hero-tag" color="#111310" text="散人约队" />
        <wd-text custom-class="create-hero-title" color="#111310" :text="currentTeam?.name || '当前球队'" />
        <wd-text custom-class="create-hero-copy" color="#111310" text="散人约队同一时间只能接一场，发布后球员可直接报名。" />
      </view>
    </view>

    <view class="create-card">
      <view class="create-card-title">基础信息</view>
      <view class="create-form-grid">
        <view class="create-form-item create-form-item-full">
          <text class="create-form-label">标题</text>
          <input v-model="form.title" class="create-input" placeholder="例如：周三晚散人局，还缺 4 人" />
        </view>
        <view class="create-form-item">
          <text class="create-form-label">日期</text>
          <picker mode="date" :value="form.date" @change="handleDateChange">
            <view class="create-input create-picker">{{ form.date || "选择日期" }}</view>
          </picker>
        </view>
        <view class="create-form-item">
          <text class="create-form-label">招募人数</text>
          <input v-model="form.playersPerTeam" class="create-input" type="number" placeholder="14" />
        </view>
        <view class="create-form-item">
          <text class="create-form-label">开始时间</text>
          <picker mode="time" :value="form.startTime" @change="handleStartTimeChange">
            <view class="create-input create-picker">{{ form.startTime }}</view>
          </picker>
        </view>
        <view class="create-form-item">
          <text class="create-form-label">结束时间</text>
          <picker mode="time" :value="form.endTime" @change="handleEndTimeChange">
            <view class="create-input create-picker">{{ form.endTime }}</view>
          </picker>
        </view>
      </view>
    </view>

    <view class="create-card">
      <view class="create-card-title">场地与费用</view>
      <view class="create-form-grid">
        <view class="create-form-item create-form-item-full">
          <text class="create-form-label">场地</text>
          <input v-model="form.location" class="create-input" placeholder="填写球场名称" />
        </view>
        <view class="create-form-item">
          <text class="create-form-label">预计费用/人</text>
          <input v-model="form.feePerPerson" class="create-input" type="digit" placeholder="25" />
        </view>
        <view class="create-form-item create-form-item-full">
          <text class="create-form-label">备注</text>
          <textarea v-model="form.note" class="create-textarea" maxlength="200" placeholder="例如：缺后卫和门将，守时优先" />
        </view>
      </view>
    </view>

    <view class="create-submit-row">
      <view :class="['create-submit-button', !canSubmit ? 'create-submit-button-disabled' : '']" @tap="handleSubmit">
        {{ submitting ? "发布中..." : "发布散人约队" }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.individual-create-page {
  min-height: 100vh;
  padding: 30rpx 28rpx 110rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.14), transparent 26%),
    linear-gradient(180deg, #ffffff 0%, #f5f6f2 100%);
  box-sizing: border-box;
}

.create-hero,
.create-card {
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.create-hero {
  padding: 28rpx;
  border-radius: 34rpx;
}

.create-hero-tag {
  display: inline-flex;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #eef8d6;
  color: #526a00;
  font-size: 22rpx;
  font-weight: 900;
}

.create-hero-title {
  display: block;
  margin-top: 14rpx;
  font-size: 40rpx;
  color: #131410;
  font-weight: 900;
}

.create-hero-copy {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #111310;
  line-height: 1.6;
}

.create-card {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 30rpx;
}

.create-card-title {
  display: block;
  font-size: 30rpx;
  color: #171814;
  font-weight: 900;
}

.create-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.create-form-item {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-width: 0;
}

.create-form-item-full {
  grid-column: 1 / -1;
}

.create-form-label {
  font-size: 22rpx;
  color: #111310;
  font-weight: 700;
}

.create-input,
.create-textarea {
  width: 100%;
  min-height: 88rpx;
  padding: 0 22rpx;
  border-radius: 24rpx;
  border: 2rpx solid #d7ddd2;
  background: #f4f6f0;
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.74);
  color: #171814;
  font-size: 28rpx;
  box-sizing: border-box;
}

.create-picker {
  display: flex;
  align-items: center;
}

.create-textarea {
  min-height: 176rpx;
  padding: 22rpx;
  line-height: 1.5;
}

.create-submit-row {
  margin-top: 24rpx;
}

.create-submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 92rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #131410;
  font-size: 30rpx;
  font-weight: 900;
}

.create-submit-button-disabled {
  background: #d7dcd0;
  color: #686d64;
}
</style>
