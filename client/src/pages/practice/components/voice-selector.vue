<template>
  <view class="control-card sj-card">
    <view class="voice-row">
      <view class="range-summary">
        <view class="waveform-icon" aria-hidden="true">
          <view
            v-for="height in waveformHeights"
            :key="height"
            class="waveform-bar"
            :style="{ height: `${height}rpx` }"
          />
        </view>
        <view class="range-copy">
          <text class="range-value">{{ currentRange }}</text>
        </view>
      </view>

      <view class="voice-switch">
        <view
          v-for="voice in voices"
          :key="voice"
          class="voice-option"
          :class="{ active: selected === voice }"
          role="button"
          @tap="emit('change', voice)"
        >
          <text class="voice-label">{{ t(`practice.voices.${voice}`) }}</text>
        </view>
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VoicePreset } from '../../../services/practice/catalog'

const props = defineProps<{ selected: VoicePreset; headphonesConnected: boolean }>()
const emit = defineEmits<{
  change: [voice: VoicePreset]
  'headphones-change': [connected: boolean]
}>()
const { t } = useI18n()
const voices: VoicePreset[] = ['female', 'male']
const voiceRanges: Record<VoicePreset, string> = {
  female: 'F3-F5',
  male: 'C3-C5'
}
const waveformHeights = [12, 24, 36, 44, 36, 24, 12]
const currentRange = computed(() => voiceRanges[props.selected])
</script>

<style scoped lang="scss">
.control-card {
  display: flex;
  height: 108rpx;
  box-sizing: border-box;
  align-items: center;
  padding: 10rpx 18rpx;
  border: 0;
  border-radius: 36rpx;
  background: #fff;
  box-shadow: 0 8rpx 28rpx rgba(31, 70, 57, 0.09);
}
.voice-row {
  display: flex;
  height: 72rpx;
  flex: 1 1 auto;
  min-width: 0;
  align-items: center;
}
.range-summary {
  display: flex;
  height: 72rpx;
  flex: 0 0 185rpx;
  min-width: 0;
  align-items: center;
  gap: 9rpx;
  box-sizing: border-box;
  padding-right: 14rpx;
  border-right: 1px solid #e5ece9;
}
.waveform-icon {
  display: flex;
  width: 58rpx;
  height: 64rpx;
  flex: 0 0 58rpx;
  align-items: center;
  justify-content: center;
  gap: 3rpx;
  border-radius: 0;
  background: transparent;
}
.waveform-bar {
  width: 3rpx;
  max-height: 38rpx;
  border-radius: 999rpx;
  background: #2aa27c;
}
.range-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.range-value {
  color: $singjourney-green-dark;
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
.voice-switch {
  display: flex;
  height: 72rpx;
  flex: 1;
  min-width: 0;
  margin-left: 14rpx;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid #dce9e4;
  border-radius: 20rpx;
  background: #fff;
}
.headset-control {
  display: flex;
  height: 72rpx;
  flex: 0 0 auto;
  min-width: auto;
  align-items: center;
  justify-content: flex-end;
  gap: 0;
  margin-left: 20rpx;
  padding-left: 0;
  box-sizing: border-box;
}
.headset-switch {
  position: relative;
  display: inline-flex;
  width: auto;
  height: 56rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 999rpx;
  background: #dce5e1;
  transition: background 0.18s ease;
}
.headset-switch.active {
  background: #168d69;
}
.headset-switch-label {
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  padding: 0 16rpx 0 46rpx;
  color: #40564e;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.headset-switch.active .headset-switch-label {
  padding: 0 46rpx 0 16rpx;
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
  transition: transform 0.18s ease;
}
.headset-switch.active .headset-switch-knob {
  right: 6rpx;
  left: auto;
  transform: none;
}
.voice-option {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 19rpx;
  color: #60756e;
}
.voice-option.active {
  border-color: #238b6c;
  color: #fff;
  background: linear-gradient(135deg, #258f70 0%, #18795c 100%);
}
.voice-label {
  font-size: 26rpx;
  font-weight: 600;
  white-space: nowrap;
}
</style>
