<template>
  <app-navbar title-key="nav.practiceStats" />
  <view class="page">
    <statistics-tabs
      :active="activeTab"
      :week-label="t('practiceStats.thisWeek')"
      :total-label="t('practiceStats.total')"
      @change="activeTab = $event"
    />

    <template v-if="activeTab === 'week'">
      <view class="today-card">
        <view class="today-label">
          <view class="calendar-icon"><text>{{ todayDay }}</text></view>
          <text>{{ t('practiceStats.today') }}</text>
        </view>
        <view class="today-metric">
          <text class="metric-value">{{ formatMinutes(statistics.today.durationSeconds) }}</text>
          <text class="metric-unit">{{ t('practiceStats.minutesUnit') }}</text>
          <text class="metric-label">{{ t('practiceStats.duration') }}</text>
        </view>
        <view class="divider" />
        <view class="today-metric">
          <text class="metric-value">{{ statistics.today.sessions }}</text>
          <text class="metric-unit">{{ t('practiceStats.sessionsUnit') }}</text>
          <text class="metric-label">{{ t('practiceStats.sessions') }}</text>
        </view>
      </view>

      <view class="panel">
        <text class="panel-title">{{ t('practiceStats.weekOverview') }}</text>
        <view class="metrics-grid four-columns">
          <metric-item
            :value="formatMinutes(statistics.week.overview.durationSeconds)"
            :unit="t('practiceStats.minutesUnit')"
            :label="t('practiceStats.totalDuration')"
          />
          <metric-item
            :value="statistics.week.overview.practiceDays"
            :unit="t('practiceStats.daysUnit')"
            :label="t('practiceStats.practiceDays')"
          />
          <metric-item
            :value="statistics.week.overview.sessions"
            :unit="t('practiceStats.sessionsUnit')"
            :label="t('practiceStats.sessions')"
          />
          <metric-item
            :value="formatMinutes(statistics.week.overview.averageDailySeconds)"
            :unit="t('practiceStats.minutesUnit')"
            :label="t('practiceStats.averageDaily')"
          />
        </view>
      </view>

      <view class="panel">
        <text class="panel-title">{{ t('practiceStats.dailyDuration') }}</text>
        <weekly-bar-chart
          :days="statistics.week.dailyActivity"
          :weekdays="weekdays"
        />
      </view>

      <view class="split-panels">
        <view class="panel split-panel">
          <text class="panel-title">{{ t('practiceStats.weekCategoryRatio') }}</text>
          <category-donut :categories="statistics.week.categories" />
        </view>
        <view class="panel split-panel">
          <text class="panel-title">{{ t('practiceStats.weekTopFive') }}</text>
          <ranking-list
            :items="statistics.week.topExercises"
            compact
          />
        </view>
      </view>
    </template>

    <template v-else>
      <view class="panel history-panel">
        <text class="panel-title">{{ t('practiceStats.history') }}</text>
        <text
          v-if="statistics.lifetime.history.startedOn"
          class="history-since"
        >
          {{ historySince }}
        </text>
        <view class="metrics-grid four-columns history-metrics">
          <metric-item
            :value="statistics.lifetime.history.practiceDays"
            :unit="t('practiceStats.daysUnit')"
            :label="t('practiceStats.cumulativeDays')"
          />
          <metric-item
            :value="formatHours(statistics.lifetime.history.durationSeconds)"
            :unit="t('practiceStats.hoursUnit')"
            :label="t('practiceStats.cumulativeDuration')"
          />
          <metric-item
            :value="statistics.lifetime.history.sessions"
            :unit="t('practiceStats.sessionsUnit')"
            :label="t('practiceStats.cumulativeSessions')"
          />
          <metric-item
            :value="statistics.lifetime.history.longestStreakDays"
            :unit="t('practiceStats.daysUnit')"
            :label="t('practiceStats.longestStreak')"
          />
        </view>
      </view>

      <view class="panel">
        <text class="panel-title">{{ t('practiceStats.totalCategoryRatio') }}</text>
        <category-donut
          :categories="statistics.lifetime.categories"
          large
        />
      </view>

      <view class="panel">
        <text class="panel-title">{{ t('practiceStats.historyTopFive') }}</text>
        <ranking-list :items="statistics.lifetime.topExercises" />
      </view>
    </template>

  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import AppNavbar from '../../components/app-navbar.vue'
import { setPageTitle } from '../../i18n'
import { usePracticeStatisticsStore } from '../../stores/practice-statistics'
import CategoryDonut from './components/category-donut.vue'
import MetricItem from './components/metric-item.vue'
import RankingList from './components/ranking-list.vue'
import StatisticsTabs from './components/statistics-tabs.vue'
import WeeklyBarChart from './components/weekly-bar-chart.vue'

const { t, tm } = useI18n()
const statisticsStore = usePracticeStatisticsStore()
const { statistics } = storeToRefs(statisticsStore)
const activeTab = ref<'week' | 'total'>('week')
const weekdays = computed(() => tm('practiceStats.weekdays') as string[])
const todayDay = new Date().getDate()
const historySince = computed(() =>
  statistics.value.lifetime.history.startedOn
    ? `${t('practiceStats.startedOnPrefix')}${statistics.value.lifetime.history.startedOn.replaceAll('-', '.')}${t('practiceStats.startedOnSuffix')}`
    : ''
)

onShow(() => {
  setPageTitle('nav.practiceStats')
  void statisticsStore.refresh()
})

function formatMinutes(seconds: number) {
  if (seconds <= 0) return 0
  return Math.max(1, Math.round(seconds / 60))
}

function formatHours(seconds: number) {
  return Number((seconds / 3600).toFixed(1))
}
</script>

<style scoped lang="scss">
.page {
  min-height: calc(100vh - 36px - env(safe-area-inset-top));
  padding: 0 28rpx 64rpx;
  box-sizing: border-box;
  background: #f8faf9;
  color: #10241f;
}
.today-card,
.panel {
  border: 1px solid rgba(53, 107, 91, 0.13);
  border-radius: 24rpx;
  background: #fff;
}
.today-card {
  display: grid;
  min-height: 132rpx;
  align-items: center;
  padding: 18rpx 26rpx;
  grid-template-columns: 1fr 1.15fr 1px 1fr;
  background: linear-gradient(105deg, #eef9f4, #f8fcfa);
}
.today-label,
.today-metric {
  display: flex;
  align-items: center;
}
.today-label {
  gap: 14rpx;
  font-size: 25rpx;
  font-weight: 700;
}
.calendar-icon {
  display: flex;
  width: 42rpx;
  height: 42rpx;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #0a4637;
  border-radius: 7rpx;
  color: #0a4637;
  font-size: 17rpx;
  line-height: 1;
}
.today-metric {
  flex-wrap: wrap;
  padding-left: 26rpx;
  gap: 5rpx;
}
.metric-value {
  font-size: 37rpx;
  font-weight: 800;
}
.metric-unit {
  margin-top: 8rpx;
  font-size: 20rpx;
}
.metric-label {
  width: 100%;
  color: #64766f;
  font-size: 20rpx;
}
.divider {
  width: 1px;
  height: 48rpx;
  background: #dbe7e2;
}
.panel {
  margin-top: 18rpx;
  padding: 24rpx;
}
.panel-title {
  display: block;
  color: #102d25;
  font-size: 27rpx;
  font-weight: 800;
}
.metrics-grid {
  display: grid;
  margin-top: 24rpx;
}
.four-columns {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.split-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}
.split-panel {
  min-width: 0;
}
.history-since {
  display: block;
  margin-top: 7rpx;
  color: #546860;
  font-size: 21rpx;
}
.history-metrics {
  margin-top: 32rpx;
}
@media (max-width: 360px) {
  .today-card {
    padding: 16rpx;
  }
  .today-metric {
    padding-left: 14rpx;
  }
}
</style>
