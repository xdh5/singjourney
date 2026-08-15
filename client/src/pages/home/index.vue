<template>
  <view
    class="page"
    :style="pageStyle"
  >
    <page-heading
      class="page-heading-component"
      :title="t('app.name')"
      :subtitle="t('home.pitchSubtitle')"
    />

    <daily-practice-card
      :description="dailyMessage"
      :today-minutes="todayMinutes"
      @select="open('/pages/practice/index')"
    />

    <view class="feature-cards">
      <view class="feature-card-shell voice-analysis-shell">
        <feature-card
          class="feature-card-component"
          :art="voiceAnalysisCard"
          :title="t('home.freeRecording')"
          :description="t('home.freeRecordingDescription')"
          @select="open('/pages/record/index')"
        />
      </view>
      <view class="feature-card-shell recordings-shell">
        <feature-card
          class="feature-card-component"
          :art="recordingsCard"
          :title="t('home.recordings')"
          :description="t('home.recordingsDescription')"
          @select="open('/pages/recordings/index')"
        />
      </view>
    </view>

    <view
      class="advertising-reserve"
      aria-hidden="true"
    />
    <bottom-nav active="home" />
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import BottomNav from '../../components/bottom-nav.vue'
import PageHeading from '../../components/page-heading.vue'
import voiceAnalysisCard from '../../assets/home/voice-analysis-card.png'
import recordingsCard from '../../assets/home/recordings-card.png'
import { setPageTitle } from '../../i18n'
import { TELEMETRY_EVENT, trackTelemetry } from '../../utils/telemetry'
import { getWindowMetrics } from '../../utils/window-metrics'
import { fetchDailyPracticeMessage } from '../../services/practice/daily-message'
import { usePracticeStatisticsStore } from '../../stores/practice-statistics'
import DailyPracticeCard from './components/daily-practice-card.vue'
import FeatureCard from './components/feature-card.vue'

const { t } = useI18n()
const dailyMessage = ref(t('home.dailyPracticeDescription'))
const statisticsStore = usePracticeStatisticsStore()
const { statistics } = storeToRefs(statisticsStore)
const todayMinutes = computed(() => Math.floor(statistics.value.today.durationSeconds / 60))
const windowMetrics = getWindowMetrics()
const pageStyle = {
  paddingTop: `${windowMetrics.statusBarHeight + (48 * windowMetrics.windowWidth) / 750}px`
}
onShow(() => {
  setPageTitle('app.name')
  dailyMessage.value = t('home.dailyPracticeDescription')
  void fetchDailyPracticeMessage()
    .then((message) => {
      dailyMessage.value = message
    })
    .catch(() => {
      // 接口不可用时保留默认文案，不打扰用户。
    })
  void statisticsStore.refresh().catch(() => {
    // 统计接口不可用时保留已有数字，不打扰用户。
  })
})

function open(url: string) {
  trackTelemetry(TELEMETRY_EVENT.FEATURE_OPENED, {
    sourcePage: 'pitch_home',
    featureKey: url.replace(/^\//, '')
  })
  uni.navigateTo({ url, animationType: 'none', animationDuration: 0 })
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: 0 30rpx calc(env(safe-area-inset-bottom) + 28rpx);
  box-sizing: border-box;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 85% 19%, rgba(196, 225, 211, 0.27), transparent 29%),
    linear-gradient(180deg, #fdfefc 0%, #fafbf9 100%);
}
.page-heading-component {
  display: block;
  height: 156rpx;
}

.feature-cards {
  display: flex;
  gap: 16rpx;
  margin-top: 32rpx;
  align-items: flex-start;
}
.feature-card-shell {
  flex: none;
  height: 252rpx;
  min-width: 0;
}
.feature-card-component {
  display: block;
  width: 100%;
  height: 100%;
}
.voice-analysis-shell {
  width: calc(51% - 8rpx);
}
.recordings-shell {
  width: calc(49% - 8rpx);
}
.advertising-reserve {
  min-height: 300rpx;
}

@media (min-width: 768px) {
  .page {
    max-width: 820px;
    margin: 0 auto;
  }
}
</style>
