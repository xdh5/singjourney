<template>
  <view class="page">
    <view class="intro">
      <view class="intro-heading">
        <text class="title">{{ t('practiceStats.title') }}</text>
      </view>
      <text class="subtitle">{{ t('practiceStats.subtitle') }}</text>
    </view>

    <view class="summary-grid">
      <view class="summary-card today-card">
        <text class="summary-period">{{ t('practiceStats.today') }}</text>
        <view class="summary-values">
          <view class="summary-value">
            <text class="summary-number">{{ summary.today.sessions }}</text>
            <text class="summary-label">{{ t('practiceStats.sessionsUnit') }}</text>
          </view>
          <view class="summary-divider" />
          <view class="summary-value">
            <text class="summary-number duration-number">{{ summary.today.duration }}</text>
            <text class="summary-label">{{ t('practiceStats.duration') }}</text>
          </view>
        </view>
      </view>

      <view class="summary-card">
        <text class="summary-period">{{ t('practiceStats.total') }}</text>
        <view class="summary-values">
          <view class="summary-value">
            <text class="summary-number">{{ summary.total.sessions }}</text>
            <text class="summary-label">{{ t('practiceStats.sessionsUnit') }}</text>
          </view>
          <view class="summary-divider" />
          <view class="summary-value">
            <text class="summary-number duration-number">{{ summary.total.duration }}</text>
            <text class="summary-label">{{ t('practiceStats.duration') }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="panel activity-panel">
      <view class="panel-heading">
        <view class="panel-copy">
          <text class="panel-title">{{ t('practiceStats.activityTitle') }}</text>
          <text class="panel-subtitle">{{ t('practiceStats.activitySubtitle') }}</text>
        </view>
        <view class="activity-legend">
          <text>{{ t('practiceStats.less') }}</text>
          <view v-for="level in activityLevels" :key="level" class="legend-cell" :class="`level-${level}`" />
          <text>{{ t('practiceStats.more') }}</text>
        </view>
      </view>

      <scroll-view class="activity-scroll" scroll-x :show-scrollbar="false">
        <view class="activity-layout">
          <view class="weekday-labels">
            <text v-for="weekday in weekdays" :key="weekday">{{ weekday }}</text>
          </view>
          <view class="activity-grid">
            <view
              v-for="day in activity"
              :key="day.date"
              class="activity-cell"
              :class="`level-${day.level}`"
            />
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="section-heading">
      <text class="panel-title">{{ t('practiceStats.todayDetails') }}</text>
      <text class="panel-subtitle">{{ t('practiceStats.todayDetailsSubtitle') }}</text>
    </view>

    <view class="exercise-list">
      <view v-for="exercise in todayExercises" :key="exercise.id" class="exercise-row">
        <view class="exercise-icon"><view class="exercise-bars"><view /><view /><view /></view></view>
        <view class="exercise-content">
          <view class="exercise-heading">
            <text class="exercise-title">{{ t(exercise.titleKey) }}</text>
            <text class="exercise-duration">{{ t('practiceStats.exerciseDuration', { duration: exercise.duration }) }}</text>
          </view>
          <view class="exercise-meta">
            <text>{{ t('practiceStats.exerciseSessions', { count: exercise.sessions }) }}</text>
            <view class="progress-track">
              <view class="progress-value" :style="{ width: `${exercise.progress}%` }" />
            </view>
          </view>
        </view>
      </view>
      <view v-if="!loading && todayExercises.length === 0" class="empty-state">
        {{ t('practiceStats.emptyToday') }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { setPageTitle } from './i18n'
import {
  EMPTY_PRACTICE_STATISTICS,
  fetchPracticeStatistics,
  flushPendingPracticeEvents,
  PRACTICE_ACTIVITY_LEVELS
} from './shared/practice-statistics'

const { t, tm } = useI18n()
const statistics = ref(EMPTY_PRACTICE_STATISTICS)
const loading = ref(false)
const summary = computed(() => statistics.value)
const todayExercises = computed(() => statistics.value.todayExercises)
const activity = computed(() => statistics.value.activity)
const activityLevels = Array.from({ length: PRACTICE_ACTIVITY_LEVELS }, (_, level) => level)
const weekdays = computed(() => tm('practiceStats.weekdays') as string[])

onShow(() => {
  setPageTitle('nav.practiceStats')
  void loadStatistics()
})

async function loadStatistics() {
  if (loading.value) return
  loading.value = true
  try {
    await flushPendingPracticeEvents()
    statistics.value = await fetchPracticeStatistics()
  } catch {
    uni.showToast({ title: t('practiceStats.loadFailed'), icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 30rpx 28rpx 64rpx;
  box-sizing: border-box;
  background: #f7faf8;
}
.intro { display: flex; flex-direction: column; padding: 4rpx 2rpx 26rpx; }
.intro-heading { display: flex; align-items: center; gap: 14rpx; }
.title { color: #294c43; font-size: 40rpx; font-weight: 900; }
.subtitle { margin-top: 10rpx; color: #6b8179; font-size: 23rpx; }
.summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16rpx; }
.summary-card,
.panel,
.exercise-row { border: 1px solid #c9ddd5; border-radius: 24rpx; background: #fff; }
.summary-card { min-width: 0; padding: 22rpx; }
.today-card { border-color: #80a99b; background: #edf5f1; }
.summary-period { color: #527266; font-size: 22rpx; font-weight: 800; }
.summary-values { display: flex; align-items: stretch; margin-top: 17rpx; }
.summary-value { display: flex; flex: 1; min-width: 0; flex-direction: column; }
.summary-divider { width: 1px; margin: 0 13rpx; background: #d8e6e0; }
.summary-number { color: #294c43; font-size: 38rpx; font-weight: 900; font-variant-numeric: tabular-nums; line-height: 1.1; }
.duration-number { font-size: 28rpx; }
.summary-label { margin-top: 8rpx; color: #718980; font-size: 19rpx; }
.panel { margin-top: 20rpx; padding: 24rpx; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.panel-copy,
.section-heading { display: flex; flex-direction: column; }
.panel-title { color: #294c43; font-size: 28rpx; font-weight: 900; }
.panel-subtitle { margin-top: 6rpx; color: #789087; font-size: 20rpx; }
.activity-legend { display: flex; flex: none; align-items: center; gap: 5rpx; color: #789087; font-size: 18rpx; }
.legend-cell,
.activity-cell { border-radius: 4rpx; background: #e8efec; }
.legend-cell { width: 15rpx; height: 15rpx; }
.activity-scroll { width: 100%; margin-top: 24rpx; }
.activity-layout { display: flex; width: max-content; min-width: 100%; align-items: flex-start; }
.weekday-labels { display: grid; flex: 0 0 28rpx; grid-template-rows: repeat(3, 40rpx); padding-top: 18rpx; color: #82978f; font-size: 16rpx; }
.activity-grid { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 22rpx); gap: 6rpx; }
.activity-cell { width: 22rpx; height: 22rpx; }
.level-0 { background: #e8efec; }
.level-1 { background: #cce0d8; }
.level-2 { background: #97bdae; }
.level-3 { background: #5f917f; }
.level-4 { background: #356b5b; }
.section-heading { margin: 30rpx 2rpx 17rpx; }
.exercise-list { display: flex; flex-direction: column; gap: 14rpx; }
.exercise-row { display: flex; align-items: center; padding: 20rpx; }
.exercise-icon { display: flex; flex: 0 0 66rpx; width: 66rpx; height: 66rpx; align-items: center; justify-content: center; border-radius: 20rpx; background: #edf5f1; }
.exercise-bars { display: flex; height: 30rpx; align-items: flex-end; gap: 5rpx; }
.exercise-bars view { width: 6rpx; border-radius: 6rpx; background: #356b5b; }
.exercise-bars view:nth-child(1) { height: 16rpx; }
.exercise-bars view:nth-child(2) { height: 30rpx; }
.exercise-bars view:nth-child(3) { height: 22rpx; }
.exercise-content { flex: 1; min-width: 0; margin-left: 17rpx; }
.exercise-heading { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.exercise-title { overflow: hidden; color: #294c43; font-size: 24rpx; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.exercise-duration { flex: none; color: #356b5b; font-size: 22rpx; font-weight: 800; font-variant-numeric: tabular-nums; }
.exercise-meta { display: flex; align-items: center; gap: 15rpx; margin-top: 12rpx; color: #789087; font-size: 19rpx; }
.empty-state { padding: 44rpx 20rpx; color: #789087; text-align: center; font-size: 23rpx; }
.progress-track { flex: 1; height: 9rpx; overflow: hidden; border-radius: 999rpx; background: #e7efeb; }
.progress-value { height: 100%; border-radius: inherit; background: #6f9d8d; }
/* #ifdef H5 */
.page { min-height: calc(100vh - var(--window-top) - var(--window-bottom)); }
/* #endif */
</style>
