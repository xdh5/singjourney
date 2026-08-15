<template>
  <app-navbar title-key="nav.recordings" />
  <view
    class="page"
    :class="{ 'page-empty': items.length === 0, 'page-recordings': items.length > 0 }"
  >
    <uni-notice-bar
      class="storage-notice"
      :text="t('recordings.localNotice')"
      show-icon
      background-color="#edf5f1"
      color="#294c43"
    />

    <template v-if="items.length === 0">
      <view class="empty">
        <text class="empty-title">{{ t('recordings.empty') }}</text>
        <text class="empty-description">{{ t('recordings.emptyDescription') }}</text>
        <button
          class="start-button"
          hover-class="none"
          @tap="openRecorder"
        >
          <image
            class="start-button-art"
            :src="startRecordingArt"
            mode="scaleToFill"
          />
          <text class="start-button-label">{{ t('recordings.start') }}</text>
        </button>
      </view>
    </template>

    <template v-else>
      <view class="section-heading">
        <text class="section-title">{{ t('recordings.myRecordings') }}</text>
        <view class="selection-actions">
          <view
            class="selection-button"
            role="button"
            @tap="toggleSelectionMode"
          >
            <view
              class="selection-icon"
              :class="{ active: selectionMode }"
              >{{ selectionMode ? '−' : '✓' }}</view
            >
            <text>{{
              selectionMode ? t('recordings.cancelSelection') : t('recordings.select')
            }}</text>
          </view>
          <view
            v-if="selectionMode"
            class="delete-selection-button"
            :class="{ disabled: selectedIds.length === 0, active: selectedIds.length > 0 }"
            role="button"
            @tap="removeSelected"
          >
            <uni-icons
              type="trash-filled"
              :size="18"
              color="#356b5b"
            />
            <text>{{ t('recordings.delete') }}</text>
          </view>
        </view>
      </view>

      <view class="recording-list">
        <recording-card
          v-for="item in visibleItems"
          :key="item.id"
          :name="displayRecordingName(item)"
          :date="formatDate(item.createdAt)"
          :duration="formatTime(item.duration)"
          :selected="selectedIds.includes(item.id)"
          :selection-mode="selectionMode"
          :more-label="t('recordings.moreActions')"
          @select="handleRecordingTap(item)"
          @menu="openRecordingMenu(item)"
        />
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import AppNavbar from '../../components/app-navbar.vue'
import startRecordingArt from '../../assets/recordings/start-recording.svg'
import { setPageTitle } from '../../i18n'
import {
  formatTime,
  getRecording,
  getPlaybackSource,
  recordingDisplayName,
  RECORDING_TYPE,
  type Recording
} from '../../utils/recording/storage'
import {
  retainExistingRecordingSelection,
  toggleRecordingSelection as updateRecordingSelection
} from '../../utils/recording/catalog'
import { exportAudio } from '../../utils/share'
import RecordingCard from './components/recording-card.vue'
import { useRecordingsStore } from '../../stores/recordings'

const COUNT_PLACEHOLDER = '{count}'
const RECORDING_NAME_PLACEHOLDER = '{name}'
const RECORDING_PAGE_SIZE = 30
const RECORDING_MENU_ACTION = {
  RENAME: 0,
  DELETE: 1,
  EXPORT: 2
} as const
const recordingsStore = useRecordingsStore()
const { items } = storeToRefs(recordingsStore)
const visibleItemCount = ref(RECORDING_PAGE_SIZE)
const visibleItems = computed(() => items.value.slice(0, visibleItemCount.value))
const selectedIds = ref<string[]>([])
const selectionMode = ref(false)
const { locale, t } = useI18n()

onShow(loadRecordings)
onReachBottom(() => {
  visibleItemCount.value = Math.min(
    items.value.length,
    visibleItemCount.value + RECORDING_PAGE_SIZE
  )
})

async function loadRecordings() {
  setPageTitle('nav.recordings')
  await recordingsStore.refresh()
  visibleItemCount.value = Math.min(
    items.value.length,
    Math.max(RECORDING_PAGE_SIZE, visibleItemCount.value)
  )
  selectedIds.value = retainExistingRecordingSelection(selectedIds.value, items.value)
  if (items.value.length === 0) selectionMode.value = false
}

function openRecorder() {
  uni.navigateTo({ url: '/pages/record/index', animationType: 'none', animationDuration: 0 })
}

function handleRecordingTap(item: Recording) {
  if (selectionMode.value) {
    toggleRecordingSelection(item.id)
    return
  }
  uni.navigateTo({
    url: `/pages/record/index?id=${encodeURIComponent(item.id)}`,
    animationType: 'none',
    animationDuration: 0
  })
}

async function openRecordingMenu(item: Recording) {
  try {
    const result = await uni.showActionSheet({
      itemList: [t('recordings.rename'), t('recordings.delete'), t('record.share')]
    })
    if (result.tapIndex === RECORDING_MENU_ACTION.RENAME) await promptRename(item)
    if (result.tapIndex === RECORDING_MENU_ACTION.DELETE) await removeSingle(item)
    if (result.tapIndex === RECORDING_MENU_ACTION.EXPORT) await exportSingle(item)
  } catch {
    // 关闭操作菜单属于正常取消，不需要提示错误。
  }
}

async function promptRename(item: Recording) {
  const result = await uni.showModal({
    title: t('recordings.renameTitle'),
    editable: true,
    placeholderText: t('recordings.renamePlaceholder'),
    content: displayRecordingName(item)
  })
  if (!result.confirm) return
  const nextName = result.content?.trim()
  if (!nextName) {
    uni.showToast({ title: t('recordings.nameRequired'), icon: 'none' })
    return
  }
  await recordingsStore.rename(item.id, nextName)
}

async function removeSingle(item: Recording) {
  const result = await uni.showModal({
    title: t('recordings.deleteTitle'),
    content: t('recordings.deleteConfirm').replace(
      RECORDING_NAME_PLACEHOLDER,
      displayRecordingName(item)
    )
  })
  if (!result.confirm) return
  await recordingsStore.remove([item.id])
}

async function exportSingle(item: Recording) {
  let source = ''
  try {
    const currentName = displayRecordingName(item)
    source = await getPlaybackSource(item)
    const result = await exportAudio({ filePath: source, name: currentName })
    if (result === 'cancelled') return
  } catch {
    uni.showToast({ title: t('record.shareFailed'), icon: 'none' })
  } finally {
    // IndexedDB 中的录音通过临时对象地址导出。
  }
}

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  selectedIds.value = []
}

function toggleRecordingSelection(id: string) {
  selectedIds.value = updateRecordingSelection(selectedIds.value, id)
}

async function removeSelected() {
  if (selectedIds.value.length === 0) return
  const result = await uni.showModal({
    title: t('recordings.deleteTitle'),
    content: t('recordings.deleteSelectedConfirm').replace(
      COUNT_PLACEHOLDER,
      String(selectedIds.value.length)
    )
  })
  if (!result.confirm) return
  await recordingsStore.remove(selectedIds.value)
  selectedIds.value = []
  selectionMode.value = false
}

function formatDate(value: string) {
  const date = new Date(value)
  const part = (number: number) => String(number).padStart(2, '0')
  const time = `${part(date.getHours())}:${part(date.getMinutes())}`
  if (locale.value === 'zh-Hans')
    return `${part(date.getMonth() + 1)}月${part(date.getDate())}日 ${time}`
  return `${part(date.getMonth() + 1)}/${part(date.getDate())} ${time}`
}

function displayRecordingName(item: Recording) {
  return recordingDisplayName(item, recordingTypeLabel(item))
}

function recordingTypeLabel(item: Recording) {
  return item.recordingType === RECORDING_TYPE.ACCOMPANIED_PRACTICE
    ? t('recordings.accompaniedPracticeTag')
    : t('recordings.freeRecordingTag')
}
</script>

<style scoped lang="scss">
.page {
  min-height: calc(100vh - 36px - env(safe-area-inset-top));
  box-sizing: border-box;
}
.page-recordings {
  padding: 20rpx 28rpx calc(env(safe-area-inset-bottom) + 48rpx);
  background: linear-gradient(180deg, #fff 0%, #fbfcfb 100%);
}
.page-empty {
  display: flex;
  min-height: calc(100vh - 36px - env(safe-area-inset-top));
  padding: 20rpx 28rpx 48rpx;
  box-sizing: border-box;
  flex-direction: column;
  background: linear-gradient(180deg, #fff 0%, #fbfcfb 100%);
}
.storage-notice {
  display: block;
  margin-bottom: 24rpx;
}
.section-heading {
  display: flex;
  min-height: 100rpx;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}
.section-title {
  flex: none;
  color: #17262a;
  font-size: 38rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}
.selection-actions {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.selection-button,
.delete-selection-button {
  display: flex;
  min-width: 112rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  gap: 9rpx;
  padding: 0 18rpx;
  border: 2rpx solid #356b5b;
  border-radius: 999rpx;
  box-sizing: border-box;
  color: #356b5b;
  background: #fff;
  font-size: 22rpx;
  font-weight: 800;
}
.selection-icon {
  display: flex;
  width: 28rpx;
  height: 28rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #356b5b;
  border-radius: 5rpx;
  box-sizing: border-box;
  color: #356b5b;
  font-size: 20rpx;
  font-weight: 900;
  line-height: 1;
}
.selection-icon.active {
  color: #fff;
  background: #356b5b;
}
.delete-selection-button {
  min-width: 92rpx;
  color: #8f9a96;
  background: #f5f7f6;
}
.delete-selection-button.disabled {
  opacity: 0.45;
}
.delete-selection-button.active {
  color: #356b5b;
  background: #fff;
}

.recording-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.empty {
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: center;
  justify-content: center;
  padding: 40rpx 0 250rpx;
  box-sizing: border-box;
  flex-direction: column;
}
.empty-title {
  color: #17634b;
  font-size: 43rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}
.empty-description {
  margin-top: 22rpx;
  color: #6c7773;
  font-size: 24rpx;
  line-height: 1.5;
  text-align: center;
}
.start-button {
  position: relative;
  width: 480rpx;
  max-width: 100%;
  height: 124rpx;
  margin: 54rpx 0 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 999rpx;
  color: #fff;
  background: transparent;
  box-shadow: 0 16rpx 28rpx rgba(28, 91, 69, 0.22);
  line-height: 1;
}
.start-button::after {
  border: 0;
}
.start-button-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.start-button-label {
  position: absolute;
  inset: 0;
  z-index: 1;
  padding: 0 128rpx;
  box-sizing: border-box;
  font-size: 28rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
  line-height: 124rpx;
  text-align: center;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .page-recordings {
    max-width: 820px;
    margin: 0 auto;
  }
}
</style>
