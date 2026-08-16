<template>
  <image
    class="app-icon"
    :class="`tone-${tone}`"
    :src="iconSource"
    :style="{ width: `${size}px`, height: `${size}px` }"
    mode="aspectFit"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AppIconName, AppIconTone } from './app-icon'
import backIcon from '../assets/icons/back.svg'
import calendarIcon from '../assets/icons/calendar.svg'
import checkboxEmptyIcon from '../assets/icons/checkbox-empty.svg'
import checkboxCheckedIcon from '../assets/icons/checkbox-checked.svg'
import deleteIcon from '../assets/icons/delete.svg'
import emailIcon from '../assets/icons/email.svg'
import favoriteIcon from '../assets/icons/favorite.svg'
import homeIcon from '../assets/icons/home.svg'
import headsetIcon from '../assets/icons/headset.svg'
import infoIcon from '../assets/icons/info.svg'
import microphoneIcon from '../assets/icons/microphone.svg'
import musicIcon from '../assets/icons/music.svg'
import moreIcon from '../assets/icons/more.svg'
import pauseIcon from '../assets/icons/pause.svg'
import playIcon from '../assets/icons/play.svg'
import rightIcon from '../assets/icons/right.svg'
import saveIcon from '../assets/icons/save.svg'
import shareIcon from '../assets/icons/share.svg'
import statisticsIcon from '../assets/icons/statistics.svg'
import trendUpIcon from '../assets/icons/trend-up.svg'
import userIcon from '../assets/icons/user.svg'
import waveformIcon from '../assets/icons/waveform.svg'

const iconSources = {
  back: backIcon,
  calendar: calendarIcon,
  'checkbox-empty': checkboxEmptyIcon,
  'checkbox-checked': checkboxCheckedIcon,
  delete: deleteIcon,
  email: emailIcon,
  favorite: favoriteIcon,
  home: homeIcon,
  headset: headsetIcon,
  info: infoIcon,
  microphone: microphoneIcon,
  music: musicIcon,
  more: moreIcon,
  pause: pauseIcon,
  play: playIcon,
  right: rightIcon,
  save: saveIcon,
  share: shareIcon,
  statistics: statisticsIcon,
  'trend-up': trendUpIcon,
  user: userIcon,
  waveform: waveformIcon
} as const

const props = withDefaults(
  defineProps<{
    name: AppIconName
    size?: number
    tone?: AppIconTone
  }>(),
  { size: 24, tone: 'primary' }
)

const iconSource = computed(() => iconSources[props.name])
</script>

<style scoped>
.app-icon {
  display: block;
  flex: none;
}

.tone-primary {
  filter: brightness(0) saturate(100%) invert(34%) sepia(15%) saturate(1235%)
    hue-rotate(109deg) brightness(89%) contrast(86%);
}

.tone-accent {
  filter: brightness(0) saturate(100%) invert(73%) sepia(83%) saturate(1168%)
    hue-rotate(100deg) brightness(97%) contrast(94%);
}

.tone-muted {
  opacity: 0.55;
  filter: brightness(0) saturate(100%) invert(34%) sepia(15%) saturate(1235%)
    hue-rotate(109deg) brightness(89%) contrast(86%);
}

.tone-white {
  filter: brightness(0) invert(1);
}

.tone-yellow {
  filter: brightness(0) saturate(100%) invert(90%) sepia(75%) saturate(594%)
    hue-rotate(344deg) brightness(103%) contrast(94%);
}
</style>
