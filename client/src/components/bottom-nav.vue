<template>
  <view
    class="bottom-nav"
    role="navigation"
  >
    <view
      class="nav-item"
      :class="{ active: active === 'home' }"
      role="button"
      @tap="select('home')"
    >
      <uni-icons
        type="home"
        :size="28"
        :color="iconColor('home')"
      />
      <text class="nav-label">{{ t('nav.home') }}</text>
    </view>
    <view
      class="nav-item"
      :class="{ active: active === 'profile' }"
      role="button"
      @tap="select('profile')"
    >
      <uni-icons
        type="person-filled"
        :size="27"
        :color="iconColor('profile')"
      />
      <text class="nav-label">{{ t('nav.profile') }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{ active: 'home' | 'profile' }>()
const { t } = useI18n()

function select(tab: 'home' | 'profile') {
  if (tab === props.active) return
  uni.redirectTo({ url: tab === 'home' ? '/pages/home/index' : '/pages/profile/index' })
}

function iconColor(tab: 'home' | 'profile') {
  return tab === props.active ? '#079864' : '#85908c'
}
</script>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  z-index: 50;
  right: 40rpx;
  bottom: calc(env(safe-area-inset-bottom) + 4rpx);
  left: 40rpx;
  display: flex;
  height: 108rpx;
  align-items: center;
  box-sizing: border-box;
  padding: 10rpx 14rpx;
  border: 1px solid rgba(29, 77, 61, 0.08);
  border-radius: 36rpx;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18rpx 44rpx rgba(35, 62, 53, 0.14);
}
.nav-item {
  display: flex;
  flex: 1;
  height: 88rpx;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  gap: 14rpx;
  border-radius: 30rpx;
  color: #85908c;
}
.nav-item.active {
  color: #079864;
  background: linear-gradient(90deg, #eff9f5 0%, #e6f4ef 100%);
}
.nav-label {
  font-size: 27rpx;
  font-weight: 800;
  line-height: 1;
}
</style>
