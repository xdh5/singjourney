<template>
  <view class="control-card sj-card">
    <view class="waveform-icon" aria-hidden="true">
      <view
        v-for="height in waveformHeights"
        :key="height"
        class="waveform-bar"
        :style="{ height: `${height}rpx` }"
      />
    </view>

    <view class="range-slider-panel">
      <text class="range-end-label">{{ midiToNoteName(draftMinimum) }}</text>
      <view
        class="range-track"
        @tap="tapTrack"
      >
        <view class="range-track-base" />
        <view
          class="range-track-selected"
          :style="selectedTrackStyle"
        />
        <view
          class="range-handle range-handle-minimum"
          :style="{ left: `${minimumPercent}%` }"
          role="slider"
          :aria-label="t('practice.rangeMinimum')"
          :aria-valuenow="draftMinimum"
          @tap.stop
          @touchstart.stop="startDrag('minimum', $event)"
          @touchmove.stop.prevent="dragHandle"
          @touchend.stop="finishDrag"
          @touchcancel.stop="finishDrag"
        />
        <view
          class="range-handle range-handle-maximum"
          :style="{ left: `${maximumPercent}%` }"
          role="slider"
          :aria-label="t('practice.rangeMaximum')"
          :aria-valuenow="draftMaximum"
          @tap.stop
          @touchstart.stop="startDrag('maximum', $event)"
          @touchmove.stop.prevent="dragHandle"
          @touchend.stop="finishDrag"
          @touchcancel.stop="finishDrag"
        />
      </view>
      <text class="range-end-label">{{ midiToNoteName(draftMaximum) }}</text>
    </view>

    <view
      class="headset-control"
      role="switch"
      :aria-checked="headphonesConnected"
      @tap="emit('headphones-change', !headphonesConnected)"
    >
      <view class="headset-switch" :class="{ active: headphonesConnected }">
        <text class="headset-switch-label">{{
          t(headphonesConnected ? 'practice.headphonesConnected' : 'practice.headphonesDisconnected')
        }}</text>
        <view class="headset-switch-knob" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  PRACTICE_RANGE_MAXIMUM_MIDI,
  PRACTICE_RANGE_MINIMUM_MIDI,
  type VocalRange
} from '../../../services/account/preferences'

const props = defineProps<{ range: VocalRange; headphonesConnected: boolean }>()
const emit = defineEmits<{
  'range-change': [range: VocalRange]
  'headphones-change': [connected: boolean]
}>()
const { t } = useI18n()
const waveformHeights = [12, 24, 36, 44, 36, 24, 12]
const draftMinimum = ref(props.range.minimumMidi)
const draftMaximum = ref(props.range.maximumMidi)
const instance = getCurrentInstance()
const rangeSpan = PRACTICE_RANGE_MAXIMUM_MIDI - PRACTICE_RANGE_MINIMUM_MIDI
const minimumPercent = computed(
  () => ((draftMinimum.value - PRACTICE_RANGE_MINIMUM_MIDI) / rangeSpan) * 100
)
const maximumPercent = computed(
  () => ((draftMaximum.value - PRACTICE_RANGE_MINIMUM_MIDI) / rangeSpan) * 100
)
const selectedTrackStyle = computed(() => ({
  left: `${minimumPercent.value}%`,
  width: `${maximumPercent.value - minimumPercent.value}%`
}))
let activeHandle: 'minimum' | 'maximum' | null = null
let draggedSinceTouchStart = false
let suppressTrackTap = false
let trackLeft = 0
let trackWidth = 1

watch(
  () => props.range,
  (range) => {
    draftMinimum.value = range.minimumMidi
    draftMaximum.value = range.maximumMidi
  },
  { deep: true }
)

function startDrag(handle: 'minimum' | 'maximum', event: TouchEvent) {
  activeHandle = handle
  draggedSinceTouchStart = false
  measureTrack(() => updateFromClientX(event.touches[0]?.clientX))
}

function dragHandle(event: TouchEvent) {
  draggedSinceTouchStart = true
  updateFromClientX(event.touches[0]?.clientX)
}

function finishDrag() {
  if (!activeHandle) return
  suppressTrackTap = draggedSinceTouchStart
  if (suppressTrackTap) {
    setTimeout(() => {
      suppressTrackTap = false
    }, 150)
  }
  activeHandle = null
  commitRange()
}

function tapTrack(event: { detail: { x: number } }) {
  if (suppressTrackTap) {
    suppressTrackTap = false
    return
  }
  measureTrack(() => {
    const tappedMidi = midiFromClientX(event.detail.x)
    activeHandle =
      Math.abs(tappedMidi - draftMinimum.value) <= Math.abs(tappedMidi - draftMaximum.value)
        ? 'minimum'
        : 'maximum'
    updateFromClientX(event.detail.x)
    activeHandle = null
    commitRange()
  })
}

function measureTrack(callback: () => void) {
  uni
    .createSelectorQuery()
    .in(instance?.proxy)
    .select('.range-track')
    .boundingClientRect((rect) => {
      const bounds = rect as UniApp.NodeInfo
      if (typeof bounds.left === 'number') trackLeft = bounds.left
      if (typeof bounds.width === 'number' && bounds.width > 0) trackWidth = bounds.width
      callback()
    })
    .exec()
}

function midiFromClientX(clientX: number) {
  const ratio = Math.max(0, Math.min(1, (clientX - trackLeft) / trackWidth))
  return PRACTICE_RANGE_MINIMUM_MIDI + Math.round(ratio * rangeSpan)
}

function updateFromClientX(clientX?: number) {
  if (!activeHandle || typeof clientX !== 'number') return
  const midi = midiFromClientX(clientX)
  if (activeHandle === 'minimum') {
    draftMinimum.value = Math.min(midi, draftMaximum.value - 1)
  } else {
    draftMaximum.value = Math.max(midi, draftMinimum.value + 1)
  }
}

function commitRange() {
  emit('range-change', {
    minimumMidi: draftMinimum.value,
    maximumMidi: draftMaximum.value
  })
}

function midiToNoteName(midi: number) {
  const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
  return `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`
}
</script>

<style scoped lang="scss">
.control-card {
  display: flex;
  min-height: 112rpx;
  align-items: center;
  gap: 14rpx;
  padding: 12rpx 20rpx;
  box-sizing: border-box;
  border: 0;
  border-radius: 36rpx;
  background: #fff;
  box-shadow: 0 8rpx 28rpx rgba(31, 70, 57, 0.09);
}
.waveform-icon {
  display: flex;
  width: 46rpx;
  height: 54rpx;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
}
.waveform-bar {
  width: 5rpx;
  max-height: 34rpx;
  border-radius: 999rpx;
  background: #2aa27c;
}
.range-slider-panel {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14rpx;
  flex: 1;
  padding: 0 2rpx;
}
.range-end-label {
  width: 54rpx;
  flex: 0 0 54rpx;
  color: #15966e;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 40rpx;
  text-align: center;
  white-space: nowrap;
}
.range-track {
  position: relative;
  height: 40rpx;
  min-width: 150rpx;
  flex: 1;
}
.range-track-base,
.range-track-selected {
  position: absolute;
  top: 18rpx;
  height: 5rpx;
  border-radius: 999rpx;
}
.range-track-base {
  right: 0;
  left: 0;
  background: #dce9e4;
}
.range-track-selected {
  background: #149b72;
}
.range-handle {
  position: absolute;
  top: 0;
  width: 38rpx;
  height: 38rpx;
  box-sizing: border-box;
  border: 5rpx solid #149b72;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2rpx 8rpx rgba(24, 121, 92, 0.25);
  transform: translateX(-50%);
}
.headset-control {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  padding-left: 2rpx;
}
.headset-switch {
  position: relative;
  display: inline-flex;
  min-width: 174rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #dce5e1;
}
.headset-switch.active {
  background: #168d69;
}
.headset-switch-label {
  padding: 0 14rpx 0 46rpx;
  color: #40564e;
  font-size: 22rpx;
  font-weight: 600;
  white-space: nowrap;
}
.headset-switch.active .headset-switch-label {
  padding: 0 46rpx 0 14rpx;
  color: #fff;
}
.headset-switch-knob {
  position: absolute;
  top: 7rpx;
  left: 7rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2rpx 7rpx rgba(26, 69, 55, 0.18);
}
.headset-switch.active .headset-switch-knob {
  right: 7rpx;
  left: auto;
}
</style>
