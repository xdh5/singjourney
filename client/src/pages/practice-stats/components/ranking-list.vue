<template>
  <view
    class="ranking"
    :class="{ compact }"
  >
    <view
      v-for="(item, index) in items"
      :key="item.id"
      class="row"
    >
      <text class="rank">{{ String(index + 1).padStart(2, '0') }}</text>
      <text class="title">{{ item.title }}</text>
      <view
        v-if="compact"
        class="progress"
      >
        <view
          class="progress-value"
          :style="{ width: `${progress(item.sessions)}%` }"
        />
      </view>
      <text class="sessions">{{ item.sessions }} {{ t('practiceStats.sessionsUnit') }}</text>
      <text
        v-if="!compact"
        class="duration"
      >{{ formatDuration(item.durationSeconds) }}</text>
    </view>
    <text
      v-if="items.length === 0"
      class="empty"
    >{{ t('practiceStats.noData') }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RankingView } from '../../../services/practice/statistics'

const props = withDefaults(defineProps<{ items: RankingView[]; compact?: boolean }>(), {
  compact: false
})
const { t } = useI18n()
const maximum = computed(() => Math.max(1, ...props.items.map((item) => item.sessions)))

function progress(sessions: number) {
  return (sessions / maximum.value) * 100
}
function formatDuration(seconds: number) {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} ${t('practiceStats.minutesUnit')}`
  return `${(seconds / 3600).toFixed(1)} ${t('practiceStats.hoursUnit')}`
}
</script>

<style scoped lang="scss">
.ranking {
  display: flex;
  margin-top: 18rpx;
  flex-direction: column;
  gap: 18rpx;
}
.row {
  display: grid;
  min-width: 0;
  align-items: center;
  grid-template-columns: 42rpx minmax(0, 1fr) 92rpx 110rpx;
  gap: 12rpx;
  font-size: 20rpx;
}
.compact .row {
  grid-template-columns: 36rpx minmax(84rpx, 1fr) minmax(40rpx, 1fr) auto;
  gap: 7rpx;
  font-size: 17rpx;
}
.rank {
  color: #09a052;
  font-weight: 800;
}
.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.progress {
  height: 7rpx;
  overflow: hidden;
  border-radius: 4rpx;
  background: #dfeae5;
}
.progress-value {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #059b4e, #63c697);
}
.sessions,
.duration {
  text-align: right;
  white-space: nowrap;
}
.empty {
  padding: 46rpx 0;
  color: #899993;
  text-align: center;
  font-size: 20rpx;
}
</style>
