<template>
  <view class="page">
    <view class="storage-notice">
      <text class="notice-title">{{ t('recordings.localNotice') }}</text>
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

    <view v-if="items.length === 0" class="empty">
      <text class="empty-title">{{ t('recordings.empty') }}</text>
      <button class="start-button" hover-class="none" @tap="openRecorder">{{ t('recordings.start') }}</button>
    </view>

    <view v-for="item in items" :key="item.id" class="row">
      <view class="play-area" @tap="openRecording(item)">
        <view class="play-icon">▶</view>
        <view class="copy">
          <text class="name">{{ displayRecordingName(item) }}</text>
          <view class="small">
            <text>{{ formatDate(item.createdAt) }}</text>
            <text class="meta-separator">·</text>
            <image class="duration-icon" src="/static/icons/duration.svg" />
            <text>{{ formatTime(item.duration) }}</text>
          </view>
        </view>
      </view>
      <button class="delete-button" hover-class="none" @tap="remove(item)">{{ t('recordings.delete') }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { setPageTitle } from './i18n'
import { formatRecordingTimestamp, formatTime, listRecordings, removeRecording, type Recording } from './shared/recordings'

const items = ref<Recording[]>([])
const { t } = useI18n()

onShow(async () => {
  setPageTitle('nav.recordings')
  items.value = await listRecordings()
})

function openRecorder() {
  uni.navigateTo({ url: '/record', animationType: 'none', animationDuration: 0 })
}

function openRecording(item: Recording) {
  uni.navigateTo({
    url: `/record?id=${encodeURIComponent(item.id)}`,
    animationType: 'none',
    animationDuration: 0
  })
}

async function remove(item: Recording) {
  const result = await uni.showModal({
    title: t('recordings.deleteTitle'),
    content: t('recordings.deleteConfirm', { name: displayRecordingName(item) })
  })
  if (!result.confirm) return
  await removeRecording(item.id)
  items.value = await listRecordings()
}

function formatDate(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function displayRecordingName(item: Recording) {
  return `${t('record.defaultName')} ${formatRecordingTimestamp(new Date(item.createdAt))}`
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 28rpx 48rpx;
  box-sizing: border-box;
  background: #fff;
}

/* #ifdef H5 */
.page { min-height: calc(100vh - var(--window-top) - var(--window-bottom)); }
/* #endif */

.storage-notice {
  display: flex;
  margin-bottom: 22rpx;
  padding: 20rpx 22rpx;
  border: 1px solid #d5e2dc;
  border-radius: 16rpx;
  flex-direction: column;
  background: #f4f8f6;
}

.notice-title { color: #315e50; font-size: 24rpx; font-weight: 800; }
.notice-copy { margin-top: 7rpx; color: #60766e; font-size: 21rpx; line-height: 1.55; }

.empty {
  display: flex;
  min-height: 56vh;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 28rpx;
  color: #6b8179;
}

.empty-title { font-size: 30rpx; }

.start-button {
  margin: 0;
  padding: 0 34rpx;
  border-radius: 999rpx;
  color: #fff;
  background: #356b5b;
  font-size: 27rpx;
}

.row {
  display: flex;
  align-items: stretch;
  margin-bottom: 18rpx;
  overflow: hidden;
  border: 1px solid #c9ddd5;
  border-radius: 18rpx;
  background: #f7faf8;
}

.play-area {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx;
}

.play-icon {
  display: flex;
  flex: 0 0 62rpx;
  width: 62rpx;
  height: 62rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  background: #356b5b;
  font-size: 23rpx;
}

.copy { display: flex; flex: 1; min-width: 0; flex-direction: column; }
.name { overflow: hidden; color: #294c43; font-size: 28rpx; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.small { display: flex; align-items: center; margin-top: 7rpx; color: #6b8179; font-size: 21rpx; }
.meta-separator { margin: 0 8rpx; }
.duration-icon { width: 21rpx; height: 21rpx; margin-right: 5rpx; }

.delete-button {
  display: flex;
  width: 104rpx;
  min-width: 104rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border-radius: 0;
  color: #7b4038;
  background: #f7ece9;
  font-size: 23rpx;
}
</style>
