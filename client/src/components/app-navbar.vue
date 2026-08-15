<template>
  <view class="navbar" :style="{ paddingTop: `${statusBarHeight}px` }">
    <view class="navbar-main">
      <view
        class="back-button"
        role="button"
        @tap="goBack"
      >
        <uni-icons type="left" :size="20" color="#ffffff" />
      </view>
      <text class="navbar-title">{{ t(titleKey) }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getWindowMetrics } from '../utils/window-metrics'

const props = withDefaults(defineProps<{ titleKey: string; interceptBack?: boolean }>(), {
  interceptBack: false
})
const emit = defineEmits<{ back: [] }>()
const { t } = useI18n()
const { statusBarHeight } = getWindowMetrics()

function goBack() {
  if (props.interceptBack) {
    emit('back')
    return
  }
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/index' }) })
}
</script>

<style scoped lang="scss">
.navbar {
  position: relative;
  z-index: 20;
  box-sizing: border-box;
  color: #fff;
  background: $singjourney-green;
}
.navbar-main {
  position: relative;
  display: flex;
  height: 36px;
  align-items: center;
  justify-content: center;
}
.back-button {
  position: absolute;
  left: 14rpx;
  display: flex;
  width: 64rpx;
  height: 36px;
  align-items: center;
  justify-content: center;
}
.navbar-title {
  font-size: 16px;
  font-weight: 400;
  line-height: 1;
}
</style>
