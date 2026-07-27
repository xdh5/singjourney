<template>
  <view
    class="toolbar"
    :style="{ height: `${height}px`, paddingBottom: `${safeBottom}px`, gridTemplateColumns: `repeat(${visibleToolCount}, 76rpx)` }"
  >
    <view class="tool-item" :class="{ disabled: clearDisabled }" role="button" @tap="!clearDisabled && emit('clear')">
      <view class="tool-icon"><image class="tool-image" src="/static/icons/trash.svg" /></view>
      <text>{{ clearLabel }}</text>
    </view>

    <view class="tool-item" :class="{ disabled: playbackDisabled }" role="button" @tap="!playbackDisabled && emit('play')">
      <view class="tool-icon"><image class="tool-image" :src="isPlaying ? '/static/icons/pause.svg' : '/static/icons/play.svg'" /></view>
      <text>{{ playLabel }}</text>
    </view>

    <view v-if="showRecord" class="tool-item" :class="{ disabled: recordDisabled }" role="button" @tap="!recordDisabled && emit('record')">
      <view class="tool-icon primary"><image class="tool-image primary-image" :src="isRecording ? '/static/icons/pause-white.svg' : '/static/icons/mic-white.svg'" /></view>
      <text>{{ recordLabel }}</text>
    </view>

    <view v-if="showDownload" class="tool-item" :class="{ disabled: downloadDisabled }" role="button" @tap="!downloadDisabled && emit('download')">
      <view class="tool-icon"><image class="tool-image" src="/static/icons/download.svg" /></view>
      <text>{{ downloadLabel }}</text>
    </view>

    <view v-if="showSave" class="tool-item" :class="{ disabled: saveDisabled }" role="button" @tap="!saveDisabled && emit('save')">
      <view class="tool-icon"><image class="tool-image" src="/static/icons/save.svg" /></view>
      <text>{{ saveLabel }}</text>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <button v-if="!shareDisabled" class="tool-item share-button" open-type="share">
      <view class="tool-icon"><image class="tool-image" src="/static/icons/share.svg" /></view>
      <text>{{ shareLabel }}</text>
    </button>
    <view v-else class="tool-item disabled" role="button">
      <view class="tool-icon"><image class="tool-image" src="/static/icons/share.svg" /></view>
      <text>{{ shareLabel }}</text>
    </view>
    <!-- #endif -->

    <!-- #ifndef MP-WEIXIN -->
    <view class="tool-item" :class="{ disabled: shareDisabled }" role="button" @tap="!shareDisabled && emit('share')">
      <view class="tool-icon"><image class="tool-image" src="/static/icons/share.svg" /></view>
      <text>{{ shareLabel }}</text>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  height: number
  safeBottom: number
  clearLabel: string
  playLabel: string
  recordLabel: string
  downloadLabel: string
  saveLabel: string
  shareLabel: string
  isPlaying: boolean
  isRecording: boolean
  playbackDisabled?: boolean
  clearDisabled?: boolean
  recordDisabled?: boolean
  downloadDisabled?: boolean
  saveDisabled?: boolean
  shareDisabled?: boolean
  showRecord?: boolean
  showDownload?: boolean
  showSave?: boolean
  detailMode?: boolean
}>(), {
  playbackDisabled: false,
  clearDisabled: false,
  recordDisabled: false,
  downloadDisabled: false,
  saveDisabled: false,
  shareDisabled: false,
  showRecord: true,
  showDownload: true,
  showSave: true,
  detailMode: false
})

const visibleToolCount = computed(() => 3
  + Number(props.showRecord)
  + Number(props.showDownload)
  + Number(props.showSave))

const emit = defineEmits<{
  clear: []
  play: []
  record: []
  download: []
  save: []
  share: []
}>()
</script>

<style scoped>
.toolbar { display: grid; flex: none; width: 100%; align-items: start; justify-content: center; column-gap: 28rpx; padding-top: 13rpx; border-top: 1px solid #d3e2dc; background: #fff; box-sizing: border-box; }
.tool-item { position: relative; display: flex; width: 76rpx; height: 118rpx; min-width: 0; align-items: center; justify-content: center; flex-direction: column; gap: 8rpx; margin: 0; padding: 0; overflow: hidden; border: 0; border-radius: 0; color: #58766c; background: transparent; font-size: 21rpx; font-weight: 500; line-height: 1; }
.tool-icon { display: flex; width: 66rpx; height: 66rpx; align-items: center; justify-content: center; border: 1px solid #c9ddd5; border-radius: 50%; background: #fff; box-sizing: border-box; }
.tool-icon.primary { border-color: #356b5b; background: #356b5b; }
.tool-image { display: block; width: 34rpx; height: 34rpx; }
.primary-image { width: 38rpx; height: 38rpx; }
.tool-item.disabled { opacity: 0.4; }
.share-button::after { border: 0; }
</style>
