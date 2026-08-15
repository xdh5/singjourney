<template>
  <view
    class="toolbar"
    :style="{
      height: `${height}px`,
      paddingBottom: `${safeBottom}px`,
      gridTemplateColumns: `repeat(${visibleToolCount}, 76rpx)`
    }"
  >
    <view
      v-if="showClear"
      class="tool-item"
      :class="{ disabled: clearDisabled }"
      role="button"
      @tap="!clearDisabled && emit('clear')"
    >
      <view class="tool-icon"
        ><uni-icons
          type="trash-filled"
          :size="21"
          color="#356b5b"
      /></view>
      <text>{{ clearLabel }}</text>
    </view>

    <view
      class="tool-item"
      :class="{ disabled: playbackDisabled }"
      role="button"
      @tap="!playbackDisabled && emit('play')"
    >
      <view class="tool-icon"
        ><uni-icons
          :type="isPlaying ? 'minus-filled' : 'forward'"
          :size="21"
          color="#356b5b"
      /></view>
      <text>{{ playLabel }}</text>
    </view>

    <view
      v-if="showRecord"
      class="tool-item"
      :class="{ disabled: recordDisabled }"
      role="button"
      @tap="!recordDisabled && emit('record')"
    >
      <view class="tool-icon primary"
        ><uni-icons
          :type="isRecording ? 'minus-filled' : 'mic-filled'"
          :size="23"
          color="#ffffff"
      /></view>
      <text>{{ recordLabel }}</text>
    </view>

    <view
      v-if="showSave"
      class="tool-item"
      :class="{ disabled: saveDisabled }"
      role="button"
      @tap="!saveDisabled && emit('save')"
    >
      <view class="tool-icon"
        ><uni-icons
          type="download-filled"
          :size="21"
          color="#356b5b"
      /></view>
      <text>{{ saveLabel }}</text>
    </view>

    <view
      v-if="showShare"
      class="tool-item"
      :class="{ disabled: shareDisabled }"
      role="button"
      @tap="!shareDisabled && emit('share')"
    >
      <view class="tool-icon"
        ><uni-icons
          type="redo-filled"
          :size="21"
          color="#356b5b"
      /></view>
      <text>{{ shareLabel }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    height: number
    safeBottom: number
    clearLabel: string
    playLabel: string
    recordLabel: string
    saveLabel: string
    shareLabel: string
    isPlaying: boolean
    isRecording: boolean
    playbackDisabled?: boolean
    clearDisabled?: boolean
    recordDisabled?: boolean
    saveDisabled?: boolean
    shareDisabled?: boolean
    showRecord?: boolean
    showClear?: boolean
    showSave?: boolean
    showShare?: boolean
    detailMode?: boolean
  }>(),
  {
    playbackDisabled: false,
    clearDisabled: false,
    recordDisabled: false,
    saveDisabled: false,
    shareDisabled: false,
    showRecord: true,
    showClear: true,
    showSave: true,
    showShare: true,
    detailMode: false
  }
)

const visibleToolCount = computed(
  () =>
    1 +
    Number(props.showClear) +
    Number(props.showRecord) +
    Number(props.showSave) +
    Number(props.showShare)
)

const emit = defineEmits<{
  clear: []
  play: []
  record: []
  save: []
  share: []
}>()
</script>

<style scoped lang="scss">
.toolbar {
  display: grid;
  flex: none;
  width: 100%;
  align-items: start;
  justify-content: center;
  column-gap: 28rpx;
  padding-top: 13rpx;
  border-top: 1px solid #d3e2dc;
  background: #fff;
  box-sizing: border-box;
}
.tool-item {
  position: relative;
  display: flex;
  width: 76rpx;
  height: 118rpx;
  min-width: 0;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8rpx;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  color: #58766c;
  background: transparent;
  font-size: 21rpx;
  font-weight: 500;
  line-height: 1;
}
.tool-icon {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  align-items: center;
  justify-content: center;
  border: 1px solid #c9ddd5;
  border-radius: 50%;
  background: #fff;
  box-sizing: border-box;
}
.tool-icon.primary {
  border-color: #356b5b;
  background: #356b5b;
}
.tool-item.disabled {
  opacity: 0.4;
}
</style>
