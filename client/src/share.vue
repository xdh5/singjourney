<template>
  <view class="page">
    <text>{{ t('share.loading') }}</text>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

onLoad(options => {
  const id = typeof options?.id === 'string' ? options.id : ''
  if (!id) {
    uni.reLaunch({ url: '/home' })
    return
  }
  uni.redirectTo({ url: `/record?shareId=${encodeURIComponent(id)}` })
})
</script>

<style scoped>
.page {
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  color: #789087;
  background: #fff;
}
</style>
