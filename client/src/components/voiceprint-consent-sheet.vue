<template>
  <view
    v-if="visible"
    class="consent-mask"
    @touchmove.stop.prevent
  >
    <view class="consent-sheet">
      <view class="application-row">
        <view class="application-icon">
          <app-icon
            name="waveform"
            :size="28"
            tone="white"
          />
        </view>
        <text class="application-name">{{ t('voiceprintConsent.applicationName') }}</text>
      </view>

      <view class="permission-content">
        <text class="permission-title">{{ t('voiceprintConsent.permissionTitle') }}</text>
        <text class="permission-description">{{ t('voiceprintConsent.permissionDescription') }}</text>
      </view>

      <view class="consent-actions">
        <button
          class="consent-button secondary"
          @tap="emit('decline')"
        >
          {{ t('voiceprintConsent.decline') }}
        </button>
        <button
          class="consent-button primary"
          :disabled="!checked"
          @tap="checked && emit('agree')"
        >
          {{ t('voiceprintConsent.allow') }}
        </button>
      </view>

      <view class="agreement-row">
        <checkbox-group @change="handleChange">
          <checkbox
            value="agreed"
            :checked="checked"
            color="#356b5b"
          />
        </checkbox-group>
        <text>{{ t('voiceprintConsent.readAndAgree') }}</text>
        <text
          class="agreement-link"
          role="button"
          @tap="emit('open')"
        >
          《{{ t('voiceprintConsent.title') }}》
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from './app-icon.vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ agree: []; decline: []; open: [] }>()
const { t } = useI18n()
const checked = ref(false)

watch(
  () => props.visible,
  (visible) => {
    if (visible) checked.value = false
  }
)

function handleChange(event: { detail?: { value?: string[] } }) {
  checked.value = Boolean(event.detail?.value?.includes('agreed'))
}
</script>

<style scoped lang="scss">
.consent-mask {
  position: fixed;
  z-index: 1000;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.consent-sheet {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 40rpx 42rpx calc(42rpx + env(safe-area-inset-bottom));
  border-radius: 34rpx 34rpx 0 0;
  background: #fff;
  box-sizing: border-box;
}

.application-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.application-icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #356b5b;
}

.application-name {
  color: #173f34;
  font-size: 30rpx;
  font-weight: 700;
}

.permission-content {
  margin-top: 52rpx;
}

.permission-title,
.permission-description {
  display: block;
}

.permission-title {
  color: #121d19;
  font-size: 42rpx;
  font-weight: 700;
}

.permission-description {
  margin-top: 18rpx;
  color: #6c7773;
  font-size: 28rpx;
}

.consent-actions {
  display: flex;
  gap: 30rpx;
  margin-top: 64rpx;
  padding: 0 70rpx;
}

.consent-button {
  flex: 1;
  height: 88rpx;
  margin: 0;
  border-radius: 16rpx;
  font-size: 32rpx;
  line-height: 88rpx;

  &::after {
    border: 0;
  }

  &.secondary {
    color: #356b5b;
    background: #f0f2f1;
  }

  &.primary {
    color: #fff;
    background: #356b5b;
  }

  &.primary[disabled] {
    color: rgba(255, 255, 255, 0.82);
    background: #9ab8ae;
  }
}

.agreement-row {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 42rpx;
  color: #6c7773;
  font-size: 24rpx;
}

.agreement-row checkbox {
  transform: scale(0.72);
  transform-origin: center;
}

.agreement-link {
  color: #356b5b;
}
</style>
