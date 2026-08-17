<template>
  <app-navbar
    v-if="!activeManifest"
    title-key="nav.practice"
  />
  <practice-session
    v-if="activeManifest"
    :manifest="activeManifest"
    :exercise-title="activeExerciseTitle"
    :include-accompaniment-on-replay="headphonesConnected"
    @close="closePracticeSession"
    @completed="saveCompletedPractice"
  />
  <view
    v-else
    class="page"
  >
    <page-heading
      class="page-heading-component"
      :title="t('home.practiceTitle')"
      :subtitle="t('home.practiceSubtitle')"
      compact
    />

    <voice-selector
      :selected="selectedVoice"
      :headphones-connected="headphonesConnected"
      @change="selectVoice"
      @headphones-change="selectHeadphonesMode"
    />
    <scroll-view
      class="category-scroll"
      scroll-x
      :show-scrollbar="false"
    >
      <view class="category-row">
        <view
          v-for="category in categories"
          :key="category.key"
          class="category-chip"
          :class="{ active: selectedCategory === category.key }"
          role="button"
          @tap="selectCategory(category.key)"
        >
          {{ category.name }}
        </view>
      </view>
    </scroll-view>

    <view
      v-if="listLoading"
      class="list-loading"
    >
      <uni-load-more status="loading" />
    </view>
    <view
      v-else
      class="exercise-list"
    >
      <exercise-card
        v-for="exercise in visibleExercises"
        :key="exercise.id"
        :exercise="exercise"
        :bookmarked="favoriteIds.includes(exercise.id)"
        @start="startExercise"
        @toggle-bookmark="toggleFavorite"
      />
      <view
        v-if="visibleExercises.length === 0"
        class="empty-state"
      >
        <view
          v-if="selectedCategory === 'favorites'"
          class="empty-illustration"
          aria-hidden="true"
        >
          <view class="empty-hook" />
          <view class="empty-box-body" />
          <view class="empty-box-flap empty-box-flap-left" />
          <view class="empty-box-flap empty-box-flap-right" />
        </view>
        <text class="empty-label">{{
          selectedCategory === 'favorites' ? t('practice.emptyFavorites') : t('practice.emptyCatalog')
        }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import PageHeading from '../../components/page-heading.vue'
import AppNavbar from '../../components/app-navbar.vue'
import { setPageTitle } from '../../i18n'
import PracticeSession from './components/practice-session.vue'
import ExerciseCard from './components/exercise-card.vue'
import VoiceSelector from './components/voice-selector.vue'
import type { PracticeManifest } from '../../utils/practice/types'
import {
  recordCompletedPractice,
  type CompletedPracticeEvent
} from '../../services/practice/statistics'
import { fetchPracticeManifest, type VoicePreset } from '../../services/practice/catalog'
import { usePracticeCatalogStore } from '../../stores/practice-catalog'
import { usePracticeFavoritesStore } from '../../stores/practice-favorites'
import { useAuthenticationStore } from '../../stores/authentication'
import { configureHeadphonesAudioMode } from '../../utils/audio/player'
import {
  keepScreenAwakeWhilePageOpen,
  releasePageScreenAwake
} from '../../utils/recording/screen-awake'
import {
  isVoicePreset,
  clearLocalVoicePreset,
  readLocalVoicePreset,
  readStoredLocalVoicePreset,
  storeLocalVoicePreset
} from '../../services/account/preferences'

const { t } = useI18n()
const catalogStore = usePracticeCatalogStore()
const favoritesStore = usePracticeFavoritesStore()
const authenticationStore = useAuthenticationStore()
const {
  categories: catalogCategories,
  exercises,
  loading: catalogLoading
} = storeToRefs(catalogStore)
const { favoriteIds, loading: favoritesLoading } = storeToRefs(favoritesStore)
const { session } = storeToRefs(authenticationStore)
const categories = computed(() => [
  { key: 'favorites', name: t('practice.categories.favorites') },
  ...catalogCategories.value
])
const selectedVoice = ref<VoicePreset>(
  isVoicePreset(session.value?.user.preferred_voice_preset)
    ? session.value.user.preferred_voice_preset
    : readLocalVoicePreset()
)
const selectedCategory = ref('favorites')
const headphonesConnected = ref(false)
const activeManifest = ref<PracticeManifest | null>(null)
const activeExerciseTitle = ref('')
const PRACTICE_SCREEN_AWAKE_OWNER = 'practice-page'
let voicePreferenceUpdate = Promise.resolve()

const visibleExercises = computed(() =>
  selectedCategory.value === 'favorites'
    ? exercises.value.filter((exercise) => favoriteIds.value.includes(exercise.id))
    : exercises.value.filter((exercise) => exercise.category_keys.includes(selectedCategory.value))
)
const listLoading = computed(
  () =>
    catalogLoading.value ||
    (selectedCategory.value === 'favorites' && favoritesLoading.value)
)

// setup 阶段立即发起请求，让首帧直接进入加载态，不先渲染“暂无收藏”。
void catalogStore.refresh().catch(() => {})

onShow(() => {
  void keepScreenAwakeWhilePageOpen(PRACTICE_SCREEN_AWAKE_OWNER)
  setPageTitle('nav.practice')
  const serverVoice = session.value?.user.preferred_voice_preset
  if (isVoicePreset(serverVoice)) {
    selectedVoice.value = serverVoice
  }
  void catalogStore.refresh().catch(() => {})
  void favoritesStore.refresh()
})

onHide(() => {
  void releasePageScreenAwake(PRACTICE_SCREEN_AWAKE_OWNER)
})
onUnload(resetPageSession)

function resetPageSession() {
  void releasePageScreenAwake(PRACTICE_SCREEN_AWAKE_OWNER)
  headphonesConnected.value = false
  void configureHeadphonesAudioMode(false)
  activeManifest.value = null
  activeExerciseTitle.value = ''
}

function selectVoice(voice: VoicePreset) {
  selectedVoice.value = voice
  storeLocalVoicePreset(voice)
  if (!session.value) return
  voicePreferenceUpdate = voicePreferenceUpdate
    .then(() => authenticationStore.updateVoicePreference(voice))
    .then(() => {
      if (readStoredLocalVoicePreset() === voice) clearLocalVoicePreset()
    })
    .catch(() => undefined)
}

function selectCategory(category: string) {
  selectedCategory.value = category
}

function selectHeadphonesMode(connected: boolean) {
  headphonesConnected.value = connected
  void configureHeadphonesAudioMode(connected)
  if (connected) {
    void uni.showModal({
      title: t('practice.headphonesDelayTitle'),
      content: t('practice.headphonesDelayMessage'),
      showCancel: false
    })
  }
}

function toggleFavorite(id: string) {
  void favoritesStore.toggle(id)
}

async function startExercise(id: string) {
  const exercise = exercises.value.find((item) => item.id === id)
  if (!exercise?.enabled) return
  try {
    activeExerciseTitle.value = exercise.title
    activeManifest.value = await fetchPracticeManifest(id, selectedVoice.value)
  } catch {
    activeExerciseTitle.value = ''
    uni.showToast({ title: t('practice.catalogLoadFailed'), icon: 'none' })
  }
}

function closePracticeSession() {
  activeManifest.value = null
  activeExerciseTitle.value = ''
}

function saveCompletedPractice(event: CompletedPracticeEvent) {
  const exercise = exercises.value.find((item) => item.id === event.exerciseKey)
  const primaryCategoryKey = exercise?.category_keys[0]
  const primaryCategory = catalogCategories.value.find(
    (category) => category.key === primaryCategoryKey
  )
  void recordCompletedPractice({
    ...event,
    title: exercise?.title,
    primaryCategoryKey,
    primaryCategoryName: primaryCategory?.name
  }).catch(() => {
    // 事件保留在本地重试队列中，打开统计页时再次同步。
  })
}

</script>

<style scoped lang="scss">
.page {
  min-height: calc(100vh - 36px - env(safe-area-inset-top));
  padding: 28rpx 28rpx 64rpx;
  box-sizing: border-box;
  background: #f7faf8;
}
.page-heading-component {
  display: block;
  height: 156rpx;
}

.category-scroll {
  width: calc(100% + 56rpx);
  margin: 24rpx -28rpx 0;
  white-space: nowrap;
}
.category-row {
  display: inline-flex;
  gap: 30rpx;
  padding: 0 28rpx;
}
.category-chip {
  position: relative;
  display: inline-flex;
  height: 58rpx;
  align-items: center;
  padding: 0 4rpx;
  border: 0;
  color: #3f514b;
  background: transparent;
  font-size: 26rpx;
  font-weight: 600;
}
.category-chip.active {
  color: #147b59;
}
.category-chip.active::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 4rpx;
  border-radius: 999rpx;
  background: #1f9a6d;
  content: '';
}

.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 22rpx;
}
.list-loading {
  padding: 86rpx 24rpx;
}
.empty-state {
  display: flex;
  align-items: center;
  padding: 86rpx 24rpx;
  color: #82958e;
  flex-direction: column;
  font-size: 24rpx;
  text-align: center;
}
.empty-illustration {
  position: relative;
  width: 150rpx;
  height: 116rpx;
  margin-bottom: 22rpx;
  opacity: 0.82;
}
.empty-hook {
  position: absolute;
  top: 0;
  left: 73rpx;
  width: 20rpx;
  height: 25rpx;
  border-top: 3rpx dotted #cbd8d4;
  border-right: 3rpx dotted #cbd8d4;
  border-radius: 0 18rpx 0 0;
  transform: rotate(-14deg);
}
.empty-box-body {
  position: absolute;
  bottom: 4rpx;
  left: 39rpx;
  width: 74rpx;
  height: 54rpx;
  border-radius: 4rpx 4rpx 8rpx 8rpx;
  background: #e6eeeb;
  box-shadow: inset -20rpx 0 0 rgba(205, 219, 214, 0.5);
}
.empty-box-flap {
  position: absolute;
  top: 40rpx;
  width: 70rpx;
  height: 34rpx;
  border-radius: 5rpx;
  background: #eef4f2;
}
.empty-box-flap-left {
  left: 17rpx;
  transform: skewY(-13deg) rotate(7deg);
}
.empty-box-flap-right {
  right: 16rpx;
  background: #e9f0ed;
  transform: skewY(13deg) rotate(-7deg);
}
.empty-label {
  color: #7e8f89;
  font-size: 25rpx;
}
</style>
