<template>
  <view class="page">
    <app-navbar
      title-key="voiceprintConsent.title"
      intercept-back
      @back="returnToSource"
    />
    <scroll-view
      class="agreement-content"
      scroll-y
    >
      <text class="updated-at">{{ t('voiceprintConsent.updatedAt') }}</text>
      <text class="introduction">{{ t('voiceprintConsent.introduction') }}</text>
      <view
        v-for="section in sections"
        :key="section.title"
        class="agreement-section"
      >
        <text class="section-title">{{ section.title }}</text>
        <text class="section-content">{{ section.content }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppNavbar from '../../components/app-navbar.vue'
import { setPageTitle } from '../../i18n'

const { t } = useI18n()
const returnTo = ref('/pages/record/index')
const sections = computed(() =>
  [1, 2, 3, 4, 5].map((index) => ({
    title: t(`voiceprintConsent.section${index}Title`),
    content: t(`voiceprintConsent.section${index}Content`)
  }))
)

onShow(() => setPageTitle('voiceprintConsent.title'))

onLoad((options) => {
  const requested = decodeURIComponent(options?.returnTo || '')
  if (requested === '/pages/practice/index' || requested === '/pages/record/index') {
    returnTo.value = requested
  }
})

function returnToSource() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      uni.redirectTo({
        url: returnTo.value,
        fail: () => uni.reLaunch({ url: returnTo.value })
      })
    }
  })
}
</script>

<style scoped lang="scss">
.page {
  display: flex;
  height: 100vh;
  flex-direction: column;
  background: #f7faf8;
}

.agreement-content {
  flex: 1;
  padding: 34rpx 36rpx calc(52rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.updated-at,
.introduction,
.section-title,
.section-content {
  display: block;
}

.updated-at {
  margin-bottom: 22rpx;
  color: #6c7773;
  font-size: 23rpx;
}

.introduction,
.section-content {
  color: #416b5d;
  font-size: 28rpx;
  line-height: 1.8;
}

.agreement-section {
  margin-top: 32rpx;
}

.section-title {
  margin-bottom: 10rpx;
  color: #173f34;
  font-size: 30rpx;
  font-weight: 700;
}
</style>
