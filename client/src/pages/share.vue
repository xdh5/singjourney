<template>
  <view class="page">
    <view v-if="loading" class="state">{{ t('share.loading') }}</view>
    <view v-else-if="errorMessage" class="state">{{ errorMessage }}</view>
    <template v-else-if="share">
      <view class="heading">
        <text class="title">{{ share.title }}</text>
        <text class="duration">{{ formatTime(share.duration_seconds) }}</text>
      </view>
      <canvas canvas-id="shareCurve" class="curve" />
      <view class="playback">
        <text class="time">{{ formatTime(currentTime) }} / {{ formatTime(share.duration_seconds) }}</text>
        <button class="play-button" @tap="togglePlayback">{{ playing ? t('share.pause') : t('share.play') }}</button>
      </view>
      <text class="expiry">{{ t('share.expiry') }}</text>
    </template>
  </view>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { onLoad, onShareAppMessage, onUnload } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { resolveApiUrl } from '../config/runtime'
import { setPageTitle } from '../i18n'
import { formatTime } from '../shared/recordings'

type PitchPoint = { time: number; midi: number | null; confidence: number }
type PublicShare = {
  id: string
  title: string
  duration_seconds: number
  curve: PitchPoint[]
  expires_at: string
  audio_url: string
}

const share = ref<PublicShare | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const playing = ref(false)
const currentTime = ref(0)
const player = uni.createInnerAudioContext()
const { t } = useI18n()

player.onPlay(() => { playing.value = true })
player.onPause(() => { playing.value = false })
player.onStop(() => { playing.value = false })
player.onEnded(() => {
  playing.value = false
  currentTime.value = 0
})
player.onTimeUpdate(() => { currentTime.value = Number(player.currentTime) || 0 })
player.onError(() => {
  playing.value = false
  uni.showToast({ title: t('share.playFailed'), icon: 'none' })
})

onLoad(async options => {
  setPageTitle('nav.share')
  const id = typeof options?.id === 'string' ? options.id : ''
  if (!id) {
    loading.value = false
    errorMessage.value = t('share.invalid')
    return
  }
  try {
    share.value = await requestShare(id)
    player.src = share.value.audio_url
    await nextTick()
    drawCurve(share.value)
  } catch {
    errorMessage.value = t('share.expired')
  } finally {
    loading.value = false
  }
})

onUnload(() => player.destroy())

onShareAppMessage(() => ({
  title: share.value ? t('record.shareMessage', { title: share.value.title }) : t('app.name'),
  path: share.value ? `/pages/share?id=${encodeURIComponent(share.value.id)}` : '/pages/home'
}))

function togglePlayback() {
  if (!share.value) return
  if (playing.value) player.pause()
  else player.play()
}

function requestShare(id: string) {
  return new Promise<PublicShare>((resolve, reject) => {
    uni.request({
      url: resolveApiUrl(`/shares/${encodeURIComponent(id)}`),
      method: 'GET',
      timeout: 15000,
      success: result => result.statusCode === 200 ? resolve(result.data as PublicShare) : reject(new Error()),
      fail: reject
    })
  })
}

function drawCurve(value: PublicShare) {
  const voiced = value.curve.filter(point => point.midi !== null)
  if (!voiced.length) return
  const context = uni.createCanvasContext('shareCurve')
  const windowWidth = uni.getWindowInfo ? uni.getWindowInfo().windowWidth : uni.getSystemInfoSync().windowWidth
  const width = Math.max(1, windowWidth - 40)
  const height = 360 * windowWidth / 750
  const midiValues = voiced.map(point => point.midi as number)
  const minimumMidi = Math.min(...midiValues) - 2
  const maximumMidi = Math.max(...midiValues) + 2
  const midiRange = Math.max(12, maximumMidi - minimumMidi)
  context.setStrokeStyle('#356b5b')
  context.setLineWidth(3)
  context.setLineCap('round')
  context.setLineJoin('round')
  context.beginPath()
  let drawing = false
  for (const point of value.curve) {
    if (point.midi === null) {
      drawing = false
      continue
    }
    const x = point.time / Math.max(value.duration_seconds, 0.001) * width
    const y = height - (point.midi - minimumMidi) / midiRange * height
    if (drawing) context.lineTo(x, y)
    else {
      context.moveTo(x, y)
      drawing = true
    }
  }
  context.stroke()
  context.draw()
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 40rpx; box-sizing: border-box; background: #fff; color: #173f34; }
/* #ifdef H5 */
.page { min-height: calc(100vh - var(--window-top) - var(--window-bottom)); }
/* #endif */
.state { padding-top: 220rpx; text-align: center; color: #789087; }
.heading { display: flex; align-items: center; justify-content: space-between; gap: 24rpx; }
.title { overflow: hidden; font-size: 38rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.duration { flex: none; color: #6b847b; font-variant-numeric: tabular-nums; }
.curve { width: 100%; height: 360rpx; margin-top: 36rpx; border: 1px solid #d6e4df; border-radius: 24rpx; background: #f7faf9; }
.playback { display: flex; align-items: center; justify-content: space-between; margin-top: 30rpx; }
.time { color: #58766c; font-variant-numeric: tabular-nums; }
.play-button { width: 220rpx; margin: 0; border-radius: 999rpx; background: #356b5b; color: #fff; font-size: 28rpx; }
.play-button::after { border: 0; }
.expiry { display: block; margin-top: 36rpx; text-align: center; color: #789087; font-size: 24rpx; }
</style>
