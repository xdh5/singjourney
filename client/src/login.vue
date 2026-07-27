<template>
  <view class="page">
    <view class="brand-mark"><view class="brand-wave"><view /><view /><view /></view></view>
    <text class="title">{{ t('login.title') }}</text>
    <text class="subtitle">{{ t('login.subtitle') }}</text>
    <button class="login-button" :disabled="loggingIn" hover-class="none" @tap="login">
      {{ loggingIn ? t('login.loggingIn') : t('login.wechatLogin') }}
    </button>
    <text class="privacy-note">{{ t('login.privacyNote') }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { setPageTitle } from './i18n'
import { getStoredAuthSession, loginToPracticeMiniProgram } from './shared/authentication'

const { t, locale } = useI18n()
const loggingIn = ref(false)

onLoad(continueIfAuthenticated)
onShow(() => setPageTitle('login.title'))

function continueIfAuthenticated() {
  if (getStoredAuthSession()) openPracticeHome()
}

async function login() {
  if (loggingIn.value) return
  loggingIn.value = true
  try {
    await loginToPracticeMiniProgram(String(locale.value))
    openPracticeHome()
  } catch {
    uni.showToast({ title: t('login.failed'), icon: 'none' })
  } finally {
    loggingIn.value = false
  }
}

function openPracticeHome() {
  uni.reLaunch({ url: '/practice-home' })
}
</script>

<style scoped>
.page { display: flex; min-height: 100vh; align-items: center; padding: 80rpx 56rpx; box-sizing: border-box; flex-direction: column; background: #fff; }
.brand-mark { display: flex; width: 132rpx; height: 132rpx; align-items: center; justify-content: center; margin-top: 110rpx; border-radius: 38rpx; background: #356b5b; }
.brand-wave { display: flex; height: 54rpx; align-items: center; gap: 10rpx; }
.brand-wave view { width: 10rpx; border-radius: 10rpx; background: #fff; }
.brand-wave view:nth-child(1) { height: 30rpx; }
.brand-wave view:nth-child(2) { height: 54rpx; }
.brand-wave view:nth-child(3) { height: 40rpx; }
.title { margin-top: 38rpx; color: #294c43; font-size: 44rpx; font-weight: 900; }
.subtitle { max-width: 520rpx; margin-top: 16rpx; color: #6b8179; font-size: 25rpx; line-height: 1.6; text-align: center; }
.login-button { width: 100%; height: 88rpx; margin-top: 72rpx; border-radius: 999rpx; color: #fff; background: #356b5b; font-size: 28rpx; font-weight: 800; line-height: 88rpx; }
.login-button[disabled] { color: #d8e5e0; background: #6f9487; }
.privacy-note { margin-top: 22rpx; color: #8a9d96; font-size: 20rpx; line-height: 1.55; text-align: center; }
</style>
