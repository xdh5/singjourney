<template>
  <app-navbar title-key="nav.practiceStats" />
  <view class="page">
    <view class="intro">
      <view class="intro-heading">
        <text class="title">{{ t('practiceStats.title') }}</text>
      </view>
      <text class="subtitle">{{ t('practiceStats.subtitle') }}</text>
    </view>

    <view class="summary-grid">
      <summary-card
        :period="t('practiceStats.today')"
        :sessions="summary.today.sessions"
        :sessions-label="t('practiceStats.sessionsUnit')"
        :duration="summary.today.duration"
        :duration-label="t('practiceStats.duration')"
        highlighted
      />
      <summary-card
        :period="t('practiceStats.total')"
        :sessions="summary.total.sessions"
        :sessions-label="t('practiceStats.sessionsUnit')"
        :duration="summary.total.duration"
        :duration-label="t('practiceStats.duration')"
      />
    </view>

    <view class="panel activity-panel">
      <view class="panel-heading">
        <view class="panel-copy">
          <text class="panel-title">{{ t('practiceStats.activityTitle') }}</text>
          <text class="panel-subtitle">{{ t('practiceStats.activitySubtitle') }}</text>
        </view>
        <view class="activity-legend">
          <text>{{ t('practiceStats.less') }}</text>
          <view
            v-for="level in activityLevels"
            :key="level"
            class="legend-cell"
            :class="`level-${level}`"
          />
          <text>{{ t('practiceStats.more') }}</text>
        </view>
      </view>

      <scroll-view
        class="activity-scroll"
        scroll-x
        :show-scrollbar="false"
      >
        <view class="activity-layout">
          <view class="weekday-labels">
            <text
              v-for="weekday in weekdays"
              :key="weekday"
              >{{ weekday }}</text
            >
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
      <exercise-stat-row
        v-for="exercise in todayExercises"
        :key="exercise.id"
        :title="exercise.title"
        :duration="t('practiceStats.exerciseDuration', { duration: exercise.duration })"
        :sessions="t('practiceStats.exerciseSessions', { count: exercise.sessions })"
        :progress="exercise.progress"
      />
      <view
        v-if="!loading && todayExercises.length === 0"
        class="empty-state"
      >
        {{ t('practiceStats.emptyToday') }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import AppNavbar from '../../components/app-navbar.vue'
import { setPageTitle } from '../../i18n'
import ExerciseStatRow from './components/exercise-stat-row.vue'
import SummaryCard from './components/summary-card.vue'
import { PRACTICE_ACTIVITY_LEVELS } from '../../services/practice/statistics'
import { usePracticeStatisticsStore } from '../../stores/practice-statistics'
import { getStoredAuthSession } from '../../utils/http/authentication'

const { t, tm } = useI18n()
const statisticsStore = usePracticeStatisticsStore()
const { statistics, loading } = storeToRefs(statisticsStore)
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
  if (!getStoredAuthSession()) {
    statisticsStore.reset()
    return
  }
  try {
    await statisticsStore.refresh()
  } catch {
    statisticsStore.reset()
  }
}
</script>

<style scoped lang="scss">
.page {
  min-height: calc(100vh - 36px - env(safe-area-inset-top));
  padding: 30rpx 28rpx 64rpx;
  box-sizing: border-box;
  background: #f7faf8;
}
.intro {
  display: flex;
  flex-direction: column;
  padding: 4rpx 2rpx 26rpx;
}
.intro-heading {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.title {
  color: #294c43;
  font-size: 40rpx;
  font-weight: 900;
}
.subtitle {
  margin-top: 10rpx;
  color: #6b8179;
  font-size: 23rpx;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}
.panel {
  margin-top: 20rpx;
  padding: 24rpx;
  border: 1px solid $singjourney-border;
  border-radius: 24rpx;
  background: #fff;
}
.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}
.panel-copy,
.section-heading {
  display: flex;
  flex-direction: column;
}
.panel-title {
  color: #294c43;
  font-size: 28rpx;
  font-weight: 900;
}
.panel-subtitle {
  margin-top: 6rpx;
  color: #789087;
  font-size: 20rpx;
}
.activity-legend {
  display: flex;
  flex: none;
  align-items: center;
  gap: 5rpx;
  color: #789087;
  font-size: 18rpx;
}
.legend-cell,
.activity-cell {
  border-radius: 4rpx;
  background: #e8efec;
}
.legend-cell {
  width: 15rpx;
  height: 15rpx;
}
.activity-scroll {
  width: 100%;
  margin-top: 24rpx;
}
.activity-layout {
  display: flex;
  width: max-content;
  min-width: 100%;
  align-items: flex-start;
}
.weekday-labels {
  display: grid;
  flex: 0 0 28rpx;
  grid-template-rows: repeat(3, 40rpx);
  padding-top: 18rpx;
  color: #82978f;
  font-size: 16rpx;
}
.activity-grid {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 22rpx);
  gap: 6rpx;
}
.activity-cell {
  width: 22rpx;
  height: 22rpx;
}
.level-0 {
  background: #e8efec;
}
.level-1 {
  background: #cce0d8;
}
.level-2 {
  background: #97bdae;
}
.level-3 {
  background: #5f917f;
}
.level-4 {
  background: #356b5b;
}
.section-heading {
  margin: 30rpx 2rpx 17rpx;
}
.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.empty-state {
  padding: 44rpx 20rpx;
  color: #789087;
  text-align: center;
  font-size: 23rpx;
}
</style>
