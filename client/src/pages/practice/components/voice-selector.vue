<template>
  <view class="control-card sj-card">
    <view class="range-summary">
      <view class="waveform-icon" aria-hidden="true">
        <view
          v-for="height in waveformHeights"
          :key="height"
          class="waveform-bar"
          :style="{ height: `${height}rpx` }"
        />
      </view>
      <text class="range-value">{{ formattedRange }}</text>
    </view>

    <view class="range-sliders">
      <view class="slider-row">
        <text class="slider-label">{{ t('practice.rangeMinimum') }}</text>
        <slider
          class="range-slider"
          :min="PRACTICE_RANGE_MINIMUM_MIDI"
          :max="draftMaximum - 1"
          :value="draftMinimum"
          active-color="#238b6c"
          background-color="#dce9e4"
          block-color="#168d69"
          :block-size="16"
          @changing="changeMinimum"
          @change="commitMinimum"
        />
        <text class="note-label">{{ midiToNoteName(draftMinimum) }}</text>
      </view>
      <view class="slider-row">
        <text class="slider-label">{{ t('practice.rangeMaximum') }}</text>
        <slider
          class="range-slider"
          :min="draftMinimum + 1"
          :max="PRACTICE_RANGE_MAXIMUM_MIDI"
          :value="draftMaximum"
          active-color="#238b6c"
          background-color="#dce9e4"
          block-color="#168d69"
          :block-size="16"
          @changing="changeMaximum"
          @change="commitMaximum"
        />
        <text class="note-label">{{ midiToNoteName(draftMaximum) }}</text>
      </view>
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
import { computed, ref, watch } from 'vue'
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
const formattedRange = computed(
  () => `${midiToNoteName(draftMinimum.value)}-${midiToNoteName(draftMaximum.value)}`
)

watch(
  () => props.range,
  (range) => {
    draftMinimum.value = range.minimumMidi
    draftMaximum.value = range.maximumMidi
  },
  { deep: true }
)

function changeMinimum(event: { detail: { value: number } }) {
  draftMinimum.value = Math.min(event.detail.value, draftMaximum.value - 1)
}

function commitMinimum(event: { detail: { value: number } }) {
  changeMinimum(event)
  commitRange()
}

function changeMaximum(event: { detail: { value: number } }) {
  draftMaximum.value = Math.max(event.detail.value, draftMinimum.value + 1)
}

function commitMaximum(event: { detail: { value: number } }) {
  changeMaximum(event)
  commitRange()
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
  min-height: 132rpx;
  align-items: center;
  padding: 14rpx 18rpx;
  box-sizing: border-box;
  border: 0;
  border-radius: 36rpx;
  background: #fff;
  box-shadow: 0 8rpx 28rpx rgba(31, 70, 57, 0.09);
}
.range-summary {
  display: flex;
  min-width: 180rpx;
  align-items: center;
  gap: 8rpx;
  padding-right: 14rpx;
  border-right: 1px solid #e5ece9;
}
.waveform-icon {
  display: flex;
  width: 48rpx;
  height: 64rpx;
  align-items: center;
  justify-content: center;
  gap: 3rpx;
}
.waveform-bar {
  width: 3rpx;
  max-height: 38rpx;
  border-radius: 999rpx;
  background: #2aa27c;
}
.range-value {
  color: $singjourney-green-dark;
  font-size: 29rpx;
  font-weight: 700;
  white-space: nowrap;
}
.range-sliders {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2rpx;
  padding: 0 12rpx;
}
.slider-row {
  display: flex;
  height: 48rpx;
  align-items: center;
}
.slider-label,
.note-label {
  color: #60756e;
  font-size: 21rpx;
  font-weight: 600;
  white-space: nowrap;
}
.slider-label {
  width: 48rpx;
}
.note-label {
  width: 54rpx;
  color: #176f56;
  text-align: right;
}
.range-slider {
  min-width: 120rpx;
  flex: 1;
  margin: 0;
}
.headset-control {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  border-left: 1px solid #e5ece9;
  padding-left: 14rpx;
}
.headset-switch {
  position: relative;
  display: inline-flex;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #dce5e1;
}
.headset-switch.active {
  background: #168d69;
}
.headset-switch-label {
  padding: 0 14rpx 0 44rpx;
  color: #40564e;
  font-size: 22rpx;
  font-weight: 600;
  white-space: nowrap;
}
.headset-switch.active .headset-switch-label {
  padding: 0 44rpx 0 14rpx;
  color: #fff;
}
.headset-switch-knob {
  position: absolute;
  top: 11rpx;
  left: 6rpx;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2rpx 7rpx rgba(26, 69, 55, 0.18);
}
.headset-switch.active .headset-switch-knob {
  right: 6rpx;
  left: auto;
}
</style>
