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
      <view class="range-copy">
        <text class="range-label">{{ t('practice.currentRange') }}</text>
        <text class="range-value">{{ currentRange }}</text>
      </view>
    </view>

    <view class="control-divider" />

    <view class="voice-switch">
      <view
        v-for="voice in voices"
        :key="voice"
        class="voice-option"
        :class="{ active: selected === voice }"
        role="button"
        @tap="emit('change', voice)"
      >
        <text class="gender-symbol">{{ voice === 'female' ? '♀' : '♂' }}</text>
        <text class="voice-label">{{ t(`practice.voices.${voice}`) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VoicePreset } from '../../../services/practice/catalog'

const props = defineProps<{ selected: VoicePreset }>()
const emit = defineEmits<{ change: [voice: VoicePreset] }>()
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
  height: 136rpx;
  align-items: center;
  box-sizing: border-box;
  padding: 10rpx 18rpx;
}
.range-summary {
  display: flex;
  height: 68rpx;
  flex: 0 0 214rpx;
  min-width: 0;
  align-items: center;
  gap: 13rpx;
}
.waveform-icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex: 0 0 64rpx;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  border-radius: 20rpx;
  background: linear-gradient(145deg, #f0f9f5 0%, #f8fbfa 100%);
}
.waveform-bar {
  width: 4rpx;
  max-height: 44rpx;
  border-radius: 999rpx;
  background: #2aa27c;
}
.range-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.range-label {
  color: #587168;
  font-size: 18rpx;
  line-height: 1;
}
.range-value {
  margin-top: 9rpx;
  color: $singjourney-green-dark;
  font-size: 29rpx;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
.control-divider {
  width: 1px;
  height: 68rpx;
  flex: 0 0 1px;
  margin: 0 14rpx;
  background: #e1ebe7;
}
.voice-switch {
  display: flex;
  height: 68rpx;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid #dce9e4;
  border-radius: 22rpx;
  background: #fbfcfc;
}
.voice-option {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border: 1px solid transparent;
  border-radius: 21rpx;
  color: #60756e;
}
.voice-option.active {
  border-color: #bddfd3;
  color: $singjourney-green-dark;
  background: linear-gradient(135deg, #edf8f4 0%, #f5faf8 100%);
}
.gender-symbol {
  display: none;
  font-size: 32rpx;
  font-weight: 500;
  line-height: 1;
}
.voice-label {
  font-size: 22rpx;
  font-weight: 600;
  white-space: nowrap;
}
</style>
