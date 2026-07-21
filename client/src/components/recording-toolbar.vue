<template>
  <view
    class="toolbar"
    :class="{ 'detail-toolbar': detailMode }"
    :style="{ height: `${height}px`, paddingBottom: `${safeBottom}px` }"
  >
    <view class="tool-item" role="button" @tap="emit('clear')">
      <view class="tool-icon"><image class="tool-image" src="/static/icons/trash.svg" /></view>
      <text>{{ clearLabel }}</text>
    </view>

    <view class="tool-item" :class="{ disabled: playbackDisabled }" role="button" @tap="emit('play')">
      <view class="tool-icon"><image class="tool-image" :src="isPlaying ? '/static/icons/pause.svg' : '/static/icons/play.svg'" /></view>
      <text>{{ playLabel }}</text>
    </view>

    <view v-if="showRecord" class="tool-item" :class="{ disabled: recordDisabled }" role="button" @tap="emit('record')">
      <view class="tool-icon primary"><image class="tool-image primary-image" :src="isRecording ? '/static/icons/pause-white.svg' : '/static/icons/mic-white.svg'" /></view>
      <text>{{ recordLabel }}</text>
    </view>

    <view class="tool-item" :class="{ disabled: downloadDisabled }" role="button" @tap="emit('download')">
      <view class="tool-icon"><image class="tool-image" src="/static/icons/download.svg" /></view>
      <text>{{ downloadLabel }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  height: number
  safeBottom: number
  clearLabel: string
  playLabel: string
  recordLabel: string
  downloadLabel: string
  isPlaying: boolean
  isRecording: boolean
  playbackDisabled?: boolean
  recordDisabled?: boolean
  downloadDisabled?: boolean
  showRecord?: boolean
  detailMode?: boolean
}>(), {
  playbackDisabled: false,
  recordDisabled: false,
  downloadDisabled: false,
  showRecord: true,
  detailMode: false
})

const emit = defineEmits<{
  clear: []
  play: []
  record: []
  download: []
}>()
</script>

<style scoped>
.toolbar { display: grid; flex: none; width: 100%; align-items: start; justify-content: center; grid-template-columns: repeat(4, 76rpx); column-gap: 34rpx; padding-top: 13rpx; border-top: 1px solid #d3e2dc; background: #fff; box-sizing: border-box; }
.toolbar.detail-toolbar { grid-template-columns: repeat(3, 76rpx); column-gap: 42rpx; }
.tool-item { position: relative; display: flex; width: 76rpx; height: 118rpx; min-width: 0; align-items: center; justify-content: center; flex-direction: column; gap: 8rpx; margin: 0; padding: 0; overflow: hidden; border: 0; border-radius: 0; color: #58766c; background: transparent; font-size: 21rpx; font-weight: 500; line-height: 1; }
.tool-icon { display: flex; width: 66rpx; height: 66rpx; align-items: center; justify-content: center; border: 1px solid #c9ddd5; border-radius: 50%; background: #fff; box-sizing: border-box; }
.tool-icon.primary { border-color: #356b5b; background: #356b5b; }
.tool-image { display: block; width: 34rpx; height: 34rpx; }
.primary-image { width: 38rpx; height: 38rpx; }
.tool-item.disabled { opacity: 0.4; }
</style>
