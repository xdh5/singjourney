<template>
  <app-navbar
    v-if="!activeManifest"
    title-key="nav.practice"
  />
  <practice-session
    v-if="activeManifest"
    :manifest="activeManifest"
    @close="activeManifest = null"
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
      @change="selectVoice"
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
          <text
            v-if="category.key === 'favorites'"
            class="favorite-chip-icon"
            >☆</text
          >
          {{ category.name }}
        </view>
      </view>
    </scroll-view>

    <view class="exercise-list">
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
import { onShow } from '@dcloudio/uni-app'
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

const { t } = useI18n()
const catalogStore = usePracticeCatalogStore()
const favoritesStore = usePracticeFavoritesStore()
const { categories: catalogCategories, exercises } = storeToRefs(catalogStore)
const { favoriteIds } = storeToRefs(favoritesStore)
const categories = computed(() => [
  { key: 'favorites', name: t('practice.categories.favorites') },
  ...catalogCategories.value
])
const selectedVoice = ref<VoicePreset>('female')
const selectedCategory = ref('favorites')
const activeManifest = ref<PracticeManifest | null>(null)

const visibleExercises = computed(() =>
  selectedCategory.value === 'favorites'
    ? exercises.value.filter((exercise) => favoriteIds.value.includes(exercise.id))
    : exercises.value.filter((exercise) => exercise.category_keys.includes(selectedCategory.value))
)

onShow(() => {
  setPageTitle('nav.practice')
  void catalogStore.refresh().catch(() => {})
  void favoritesStore.refresh()
})

function selectVoice(voice: VoicePreset) {
  selectedVoice.value = voice
}

function selectCategory(category: string) {
  selectedCategory.value = category
}

function toggleFavorite(id: string) {
  void favoritesStore.toggle(id)
}

async function startExercise(id: string) {
  const exercise = exercises.value.find((item) => item.id === id)
  if (!exercise?.enabled) return
  try {
    activeManifest.value = await fetchPracticeManifest(id, selectedVoice.value)
  } catch {
    uni.showToast({ title: t('practice.catalogLoadFailed'), icon: 'none' })
  }
}

function saveCompletedPractice(event: CompletedPracticeEvent) {
  void recordCompletedPractice(event).catch(() => {
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
  margin: 28rpx -28rpx 0;
  white-space: nowrap;
}
.category-row {
  display: inline-flex;
  gap: 12rpx;
  padding: 0 28rpx;
}
.category-chip {
  display: inline-flex;
  height: 62rpx;
  align-items: center;
  padding: 0 25rpx;
  border: 1px solid #b4d1c7;
  border-radius: 999rpx;
  color: #315f51;
  background: #fff;
  font-size: 23rpx;
  font-weight: 600;
}
.favorite-chip-icon {
  margin-right: 8rpx;
  font-size: 29rpx;
  font-weight: 400;
  line-height: 1;
}
.category-chip.active {
  border-color: #356b5b;
  color: #fff;
  background: #356b5b;
}

.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 28rpx;
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
