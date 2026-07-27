<template>
  <view class="page" :class="{ 'page-empty': items.length === 0, 'page-recordings': items.length > 0 }">
    <template v-if="items.length === 0">
      <view class="storage-notice">
        <image class="notice-icon" src="/static/icons/notification.svg" mode="aspectFit" />
        <!-- #ifdef MP-WEIXIN -->
        <text class="notice-copy">{{ t('recordings.wechatNotice') }}</text>
        <!-- #endif -->
        <!-- #ifdef H5 -->
        <text class="notice-copy">{{ t('recordings.webNotice') }}</text>
        <!-- #endif -->
        <!-- #ifdef APP-PLUS -->
        <text class="notice-copy">{{ t('recordings.appNotice') }}</text>
        <!-- #endif -->
      </view>

      <view class="empty">
        <text class="empty-title">{{ t('recordings.empty') }}</text>
        <text class="empty-description">{{ t('recordings.emptyDescription') }}</text>
        <button class="start-button" hover-class="none" @tap="openRecorder">
          <image class="start-button-art" src="/static/recordings/open-pitch-meter.png" mode="scaleToFill" />
          <text class="start-button-label">{{ t('recordings.start') }}</text>
        </button>
      </view>
    </template>

    <template v-else>
    <view class="hero">
      <image class="hero-waveform" src="/static/home/pitch-heading-curve.png" mode="aspectFit" />
      <text class="hero-title">{{ t('nav.recordings') }}</text>
      <!-- #ifdef MP-WEIXIN -->
      <text class="hero-copy">{{ t('recordings.wechatNotice') }}</text>
      <!-- #endif -->
      <!-- #ifdef H5 -->
      <text class="hero-copy">{{ t('recordings.webNotice') }}</text>
      <!-- #endif -->
      <!-- #ifdef APP-PLUS -->
      <text class="hero-copy">{{ t('recordings.appNotice') }}</text>
      <!-- #endif -->
    </view>

    <view class="section-heading">
      <text class="section-title">{{ t('recordings.myRecordings') }}</text>
      <view class="selection-actions">
        <view class="selection-button" role="button" @tap="toggleSelectionMode">
          <view class="selection-icon" :class="{ active: selectionMode }">{{ selectionMode ? '−' : '✓' }}</view>
          <text>{{ selectionMode ? t('recordings.cancelSelection') : t('recordings.select') }}</text>
        </view>
        <view class="delete-selection-button" :class="{ disabled: selectedIds.length === 0, active: selectedIds.length > 0 }" role="button" @tap="removeSelected">
          <image class="delete-icon" src="/static/icons/trash.svg" mode="aspectFit" />
          <text>{{ t('recordings.delete') }}</text>
        </view>
      </view>
    </view>

    <view class="recording-list">
      <view
        v-for="item in items"
        :key="item.id"
        class="recording-card"
        :class="{ selected: selectedIds.includes(item.id) }"
        role="button"
        @tap="handleRecordingTap(item)"
      >
        <view v-if="selectionMode" class="recording-checkbox" :class="{ checked: selectedIds.includes(item.id) }">✓</view>
        <image v-else class="play-button" src="/static/recordings/recording-play.png" mode="aspectFit" />
        <view class="recording-copy">
          <text class="recording-name">{{ displayRecordingName(item) }}</text>
          <view class="recording-meta">
            <image class="duration-icon" src="/static/icons/recording-duration.svg" mode="aspectFit" />
            <text>{{ formatTime(item.duration) }}</text>
            <text class="meta-dot">·</text>
            <text class="recording-tag">{{ recordingTypeLabel(item) }}</text>
          </view>
        </view>
        <text class="recording-date">{{ formatDate(item.createdAt) }}</text>
      </view>
    </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { setPageTitle } from './i18n'
import { formatRecordingTimestamp, formatTime, listRecordings, RECORDING_TYPE, removeRecording, type Recording } from './shared/recordings'

const COUNT_PLACEHOLDER = '{count}'
const items = ref<Recording[]>([])
const selectedIds = ref<string[]>([])
const selectionMode = ref(false)
const { t } = useI18n()
const defaultRecordingName = computed(() => t('record.defaultName'))

onShow(loadRecordings)

async function loadRecordings() {
  setPageTitle('nav.recordings')
  items.value = await listRecordings()
  selectedIds.value = selectedIds.value.filter(id => items.value.some(item => item.id === id))
  if (items.value.length === 0) selectionMode.value = false
}

function openRecorder() {
  uni.navigateTo({ url: '/record', animationType: 'none', animationDuration: 0 })
}

function handleRecordingTap(item: Recording) {
  if (selectionMode.value) {
    toggleRecordingSelection(item.id)
    return
  }
  uni.navigateTo({ url: `/record?id=${encodeURIComponent(item.id)}`, animationType: 'none', animationDuration: 0 })
}

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  selectedIds.value = []
}

function toggleRecordingSelection(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(itemId => itemId !== id)
    : [...selectedIds.value, id]
}

async function removeSelected() {
  if (selectedIds.value.length === 0) return
  const result = await uni.showModal({
    title: t('recordings.deleteTitle'),
    content: t('recordings.deleteSelectedConfirm').replace(COUNT_PLACEHOLDER, String(selectedIds.value.length))
  })
  if (!result.confirm) return
  await Promise.all(selectedIds.value.map(id => removeRecording(id)))
  selectedIds.value = []
  selectionMode.value = false
  await loadRecordings()
}

function formatDate(value: string) {
  const date = new Date(value)
  const part = (number: number) => String(number).padStart(2, '0')
  return `${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}`
}

function displayRecordingName(item: Recording) {
  return `${defaultRecordingName.value} ${formatRecordingTimestamp(new Date(item.createdAt))}`
}

function recordingTypeLabel(item: Recording) {
  return item.recordingType === RECORDING_TYPE.ACCOMPANIED_PRACTICE
    ? t('recordings.accompaniedPracticeTag')
    : t('recordings.pitchMeterTag')
}
</script>

<style scoped>
.page { min-height: 100vh; box-sizing: border-box; }
.page-recordings {
  padding: 0 38rpx calc(env(safe-area-inset-bottom) + 46rpx);
  background:
    radial-gradient(circle at 85% 19%, rgba(196, 225, 211, 0.27), transparent 29%),
    linear-gradient(180deg, #fdfefc 0%, #fafbf9 100%);
}
.page-empty {
  display: flex;
  min-height: 100vh;
  padding: 32rpx 40rpx 48rpx;
  box-sizing: border-box;
  flex-direction: column;
  background:
    radial-gradient(circle at 85% 19%, rgba(196, 225, 211, 0.27), transparent 29%),
    linear-gradient(180deg, #fdfefc 0%, #fafbf9 100%);
}
.storage-notice { display: flex; flex: none; align-items: center; gap: 24rpx; margin-bottom: 22rpx; padding: 22rpx 24rpx; border: 1px solid #d5e2dc; border-radius: 16rpx; background: #f4f8f6; }
.notice-icon { flex: 0 0 42rpx; width: 42rpx; height: 42rpx; }
.notice-copy { flex: 1; color: #356b5b; font-size: 23rpx; line-height: 1.55; }
.hero { position: relative; min-height: 294rpx; margin: 0 -38rpx; padding: 58rpx 42rpx 28rpx; overflow: hidden; box-sizing: border-box; background: transparent; }
.hero-waveform { position: absolute; top: -38rpx; right: -48rpx; width: 390rpx; height: 300rpx; opacity: 0.68; }
.hero-title { position: relative; z-index: 1; display: block; color: #17634b; font-size: 66rpx; font-weight: 900; letter-spacing: 2rpx; line-height: 1.12; }
.hero-copy { position: relative; z-index: 1; display: block; max-width: 640rpx; margin-top: 28rpx; color: #416b5d; font-size: 23rpx; line-height: 1.62; }
.section-heading { display: flex; min-height: 86rpx; align-items: center; justify-content: space-between; gap: 18rpx; }
.section-title { flex: none; color: #17634b; font-size: 34rpx; font-weight: 900; }
.selection-actions { display: flex; align-items: center; gap: 14rpx; }
.selection-button, .delete-selection-button { display: flex; min-width: 104rpx; height: 54rpx; align-items: center; justify-content: center; gap: 8rpx; padding: 0 16rpx; border: 1px solid #e1ebe6; border-radius: 999rpx; box-sizing: border-box; color: #17634b; background: #fff; font-size: 21rpx; font-weight: 700; }
.selection-icon { display: flex; width: 27rpx; height: 27rpx; align-items: center; justify-content: center; border: 2rpx solid #17634b; border-radius: 6rpx; box-sizing: border-box; color: #17634b; font-size: 21rpx; font-weight: 900; line-height: 1; }
.selection-icon.active { color: #fff; background: #17634b; }
.delete-selection-button { min-width: 92rpx; color: #8f9a96; background: #f5f7f6; }
.delete-selection-button.disabled { opacity: 0.45; }
.delete-selection-button.active { color: #17634b; background: #fff; }
.delete-icon { width: 27rpx; height: 27rpx; opacity: 0.65; }

.recording-list { display: flex; flex-direction: column; gap: 14rpx; }
.recording-card { position: relative; display: flex; min-height: 136rpx; align-items: center; gap: 18rpx; padding: 13rpx 24rpx 13rpx 22rpx; overflow: hidden; border: 1px solid rgba(52, 92, 78, 0.1); border-radius: 36rpx; box-sizing: border-box; background: rgba(255, 255, 255, 0.96); box-shadow: 0 15rpx 34rpx rgba(48, 78, 67, 0.11); }
.recording-card.selected { background: rgba(255, 255, 255, 0.96); box-shadow: inset 0 0 0 2rpx #356b5b, 0 15rpx 34rpx rgba(48, 78, 67, 0.11); }
.play-button { flex: 0 0 76rpx; width: 76rpx; height: 84rpx; }
.recording-checkbox { display: flex; flex: 0 0 40rpx; width: 40rpx; height: 40rpx; align-items: center; justify-content: center; border: 2rpx solid #17634b; border-radius: 50%; box-sizing: border-box; color: transparent; font-size: 27rpx; font-weight: 900; line-height: 1; }
.recording-checkbox.checked { color: #fff; background: #17634b; }
.recording-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.recording-tag { padding: 4rpx 12rpx; border-radius: 999rpx; color: #2f9a78; background: #eaf6f0; font-size: 18rpx; line-height: 1; }
.recording-name { overflow: hidden; color: #17634b; font-size: 27rpx; font-weight: 900; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.recording-meta { display: flex; align-items: center; gap: 8rpx; margin-top: 14rpx; color: #6c7773; font-size: 20rpx; line-height: 1; }
.duration-icon { width: 23rpx; height: 23rpx; opacity: 0.72; }
.meta-dot { margin: 0 3rpx; }
.recording-date { flex: none; align-self: center; color: #7b8e88; font-size: 20rpx; font-variant-numeric: tabular-nums; }

.empty { display: flex; flex: 1; min-height: 0; align-items: center; justify-content: center; padding: 40rpx 0 250rpx; box-sizing: border-box; flex-direction: column; }
.empty-title { color: #17634b; font-size: 43rpx; font-weight: 900; letter-spacing: 2rpx; }
.empty-description { margin-top: 22rpx; color: #6c7773; font-size: 24rpx; line-height: 1.5; text-align: center; }
.start-button { position: relative; width: 480rpx; max-width: 100%; height: 124rpx; margin: 54rpx 0 0; padding: 0; overflow: hidden; border: 0; border-radius: 999rpx; color: #fff; background: transparent; box-shadow: 0 16rpx 28rpx rgba(28, 91, 69, 0.22); line-height: 1; }
.start-button::after { border: 0; }
.start-button-art { position: absolute; inset: 0; width: 100%; height: 100%; }
.start-button-label { position: absolute; inset: 0; z-index: 1; padding: 0 128rpx; box-sizing: border-box; font-size: 28rpx; font-weight: 800; letter-spacing: 1rpx; line-height: 124rpx; text-align: center; white-space: nowrap; }

/* #ifdef H5 */
.page { min-height: calc(100vh - var(--window-top) - var(--window-bottom)); }
/* #endif */

@media (min-width: 768px) { .page-recordings { max-width: 820px; margin: 0 auto; } }
</style>
