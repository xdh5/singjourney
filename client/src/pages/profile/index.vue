<template>
  <view class="page">
    <view class="profile-card">
      <view
        class="avatar"
        role="button"
        @tap="handleAvatarTap"
      >
        <image
          class="avatar-image"
          :src="session?.user.avatar_data_url || defaultAvatar"
          mode="aspectFill"
        />
      </view>
      <view class="identity-row">
        <text class="title">
          {{ session?.user.display_name || t('account.defaultNickname') }}
        </text>
        <text v-if="!session" class="guest-label">（{{ t('account.guest') }}）</text>
      </view>
    </view>
    <view class="profile-links">
      <profile-link
        icon="statistics"
        :title="t('home.practiceRecords')"
        :description="t('home.practiceRecordsDescription')"
        @select="openPracticeStats"
      />
      <profile-link
        icon="email"
        :title="t('account.contactAuthor')"
        description="zhaozy086@gmail.com"
        :show-chevron="false"
        @select="copyAuthorEmail"
      />
    </view>

    <view
      v-if="profileEditorVisible"
      class="profile-editor-mask"
    >
      <view class="profile-editor">
        <text class="editor-title">{{ t('account.profileTitle') }}</text>
        <text class="editor-description">{{ t('account.profileDescription') }}</text>
        <button
          class="avatar-picker"
          open-type="chooseAvatar"
          @chooseavatar="chooseAvatar"
        >
          <image
            v-if="avatarPreview"
            class="avatar-preview"
            :src="avatarPreview"
            mode="aspectFill"
          />
          <app-icon
            v-else
            name="user"
            :size="30"
          />
        </button>
        <input
          class="nickname-input"
          type="nickname"
          name="nickname"
          :value="displayNameDraft"
          :placeholder="t('account.nicknamePlaceholder')"
          maxlength="30"
          confirm-type="done"
          @input="updateNickname"
          @blur="updateNickname"
        />
        <view class="editor-actions">
          <button
            class="editor-button secondary"
            @tap="cancelLogin"
          >
            {{ t('account.cancel') }}
          </button>
          <button
            class="editor-button primary"
            :disabled="savingProfile"
            @tap="confirmProfile"
          >
            {{ t('account.confirmLogin') }}
          </button>
        </view>
      </view>
    </view>
    <bottom-nav active="profile" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import BottomNav from '../../components/bottom-nav.vue'
import AppIcon from '../../components/app-icon.vue'
import { setPageTitle } from '../../i18n'
import ProfileLink from './components/profile-link.vue'
import { useAuthenticationStore } from '../../stores/authentication'
import { avatarFileToDataUrl } from '../../utils/media/avatar'
import defaultAvatar from '../../assets/profile/default-avatar.jpg'

const { t, locale } = useI18n()
const authenticationStore = useAuthenticationStore()
const { session } = storeToRefs(authenticationStore)
const profileEditorVisible = ref(false)
const savingProfile = ref(false)
const displayNameDraft = ref('')
const avatarPreview = ref('')
const avatarDataUrlDraft = ref<string>()
const pendingDestination = ref<string>()

onShow(() => {
  authenticationStore.refreshFromStorage()
  setPageTitle('nav.profile')
})

function open(url: string) {
  uni.navigateTo({ url, animationType: 'none', animationDuration: 0 })
}

function openPracticeStats() {
  authenticationStore.refreshFromStorage()
  if (session.value) {
    open('/pages/practice-stats/index')
    return
  }
  uni.showModal({
    title: t('account.statisticsLoginTitle'),
    content: t('account.statisticsLoginWarning'),
    confirmText: t('account.login'),
    cancelText: t('account.continueLocal'),
    success: (result) => {
      if (result.confirm) void loginAndContinue('/pages/practice-stats/index')
      else if (result.cancel) open('/pages/practice-stats/index')
    }
  })
}

function handleAvatarTap() {
  authenticationStore.refreshFromStorage()
  if (!session.value) {
    void loginAndContinue('')
    return
  }
  uni.showModal({
    title: t('account.logoutTitle'),
    content: t('account.logoutConfirm'),
    confirmText: t('account.logout'),
    cancelText: t('account.cancel'),
    success: (result) => {
      if (!result.confirm) return
      void authenticationStore.logout().catch(() => {
        uni.showToast({ title: t('account.logoutSyncFailed'), icon: 'none' })
      })
    }
  })
}

function copyAuthorEmail() {
  uni.setClipboardData({
    data: 'zhaozy086@gmail.com',
    success: () => {
      uni.showToast({ title: t('account.emailCopied'), icon: 'none' })
    }
  })
}

function showProfileEditor(destination: string) {
  displayNameDraft.value = ''
  avatarPreview.value = session.value?.user.avatar_data_url || defaultAvatar
  avatarDataUrlDraft.value = undefined
  pendingDestination.value = destination || undefined
  profileEditorVisible.value = true
}

async function loginAndContinue(destination: string) {
  uni.showLoading({ title: t('account.login'), mask: true })
  try {
    const loggedInSession = await authenticationStore.login(locale.value, {})
    if (!loggedInSession) return
    if (!loggedInSession.user.display_name && !loggedInSession.user.avatar_data_url) {
      showProfileEditor(destination)
      return
    }
    pendingDestination.value = destination || undefined
    finishLogin()
  } catch (error) {
    reportLoginError(error)
  } finally {
    uni.hideLoading()
  }
}

async function chooseAvatar(event: { detail: { avatarUrl?: string } }) {
  const avatarUrl = event.detail.avatarUrl
  if (!avatarUrl) return
  avatarPreview.value = avatarUrl
  try {
    avatarDataUrlDraft.value = await avatarFileToDataUrl(avatarUrl)
  } catch {
    uni.showToast({ title: t('account.avatarFailed'), icon: 'none' })
  }
}

function updateNickname(event: { detail: { value?: string } }) {
  displayNameDraft.value = event.detail.value || ''
}

async function confirmProfile() {
  const displayName = displayNameDraft.value.trim()
  if (!displayName && !avatarDataUrlDraft.value) {
    uni.showToast({ title: t('account.profileRequired'), icon: 'none' })
    return
  }
  savingProfile.value = true
  try {
    await authenticationStore.updateProfile({
      displayName: displayName || undefined,
      avatarDataUrl: avatarDataUrlDraft.value
    })
    finishLogin()
  } catch (error) {
    reportLoginError(error)
  } finally {
    savingProfile.value = false
  }
}

function reportLoginError(error: unknown) {
  const detail = error as {
    name?: string
    message?: string
    errMsg?: string
    statusCode?: number
    responseData?: unknown
  }
  console.error('[登录错误] 微信登录或资料保存失败', {
    name: detail?.name,
    message: detail?.message || detail?.errMsg,
    statusCode: detail?.statusCode,
    responseData: detail?.responseData,
    rawError: error
  })
  uni.showToast({ title: t('account.loginFailed'), icon: 'none' })
}

function cancelLogin() {
  profileEditorVisible.value = false
  pendingDestination.value = undefined
  displayNameDraft.value = ''
  avatarDataUrlDraft.value = undefined
}

function finishLogin() {
  profileEditorVisible.value = false
  const destination = pendingDestination.value
  pendingDestination.value = undefined
  if (destination) open(destination)
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 64rpx) 30rpx calc(env(safe-area-inset-bottom) + 160rpx);
  box-sizing: border-box;
  background: linear-gradient(180deg, #fdfefc 0%, #f5f9f7 100%);
}
.profile-card {
  display: flex;
  min-height: 280rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border: 1px solid rgba(52, 92, 78, 0.1);
  border-radius: 38rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16rpx 38rpx rgba(48, 78, 67, 0.11);
}
.avatar {
  display: flex;
  width: 112rpx;
  height: 112rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e4f3ec;
  overflow: hidden;
}
.avatar-image,
.avatar-preview {
  width: 100%;
  height: 100%;
}
.identity-row {
  display: flex;
  align-items: baseline;
  margin-top: 16rpx;
}
.title {
  color: $singjourney-green-dark;
  font-size: 34rpx;
  font-weight: 700;
}
.guest-label {
  margin-left: 4rpx;
  color: #7b8e87;
  font-size: 22rpx;
}
.profile-links {
  display: flex;
  margin-top: 28rpx;
  flex-direction: column;
  gap: 18rpx;
}
.profile-editor-mask {
  position: fixed;
  z-index: 20;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36rpx;
  background: rgba(14, 35, 29, 0.46);
}
.profile-editor {
  width: 100%;
  padding: 42rpx 36rpx 34rpx;
  box-sizing: border-box;
  border-radius: 30rpx;
  background: #fff;
  text-align: center;
}
.editor-title {
  display: block;
  color: $singjourney-green-dark;
  font-size: 34rpx;
  font-weight: 700;
}
.editor-description {
  display: block;
  margin-top: 12rpx;
  color: $singjourney-text-secondary;
  font-size: 23rpx;
}
.avatar-picker {
  display: flex;
  width: 128rpx;
  height: 128rpx;
  align-items: center;
  justify-content: center;
  margin: 30rpx auto 22rpx;
  padding: 0;
  overflow: hidden;
  border: 1px solid $singjourney-border;
  border-radius: 50%;
  background: #edf7f2;
}
.avatar-picker::after,
.editor-button::after {
  border: 0;
}
.nickname-input {
  height: 82rpx;
  padding: 0 24rpx;
  border: 1px solid $singjourney-border;
  border-radius: 18rpx;
  background: #f8fbf9;
  color: $singjourney-green-dark;
  text-align: left;
  font-size: 27rpx;
}
.editor-actions {
  display: flex;
  margin-top: 28rpx;
  gap: 16rpx;
}
.editor-button {
  flex: 1;
  height: 76rpx;
  margin: 0;
  border-radius: 38rpx;
  font-size: 25rpx;
  line-height: 76rpx;
}
.editor-button.secondary {
  background: #edf2ef;
  color: #647a72;
}
.editor-button.primary {
  background: $singjourney-green;
  color: #fff;
}
</style>
