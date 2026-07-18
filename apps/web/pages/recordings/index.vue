<template>
  <main class="list-page">
    <section class="list-shell">
      <header class="page-header">
        <NuxtLink class="icon-link" to="/" aria-label="返回"><i class="bi bi-chevron-left"></i></NuxtLink>
        <h1>录音记录</h1><span aria-hidden="true"></span>
      </header>
      <p class="storage-note">所有内容仅保存在当前浏览器，清除浏览器数据会同时删除录音。</p>
      <div v-if="loading" class="empty-row">正在读取本地录音…</div>
      <div v-else-if="recordings.length === 0" class="empty-card">
        <i class="bi bi-mic"></i><strong>还没有录音</strong><NuxtLink to="/record">开始自由录音</NuxtLink>
      </div>
      <div v-for="item in recordings" :key="item.id" class="list-row">
        <NuxtLink class="recording-link" :to="`/recordings/${item.id}`">
          <i class="bi bi-play-fill"></i>
          <span><strong>{{ item.name }}</strong><small>{{ formatDate(item.createdAt) }} · {{ item.pointCount }} 个音高点</small></span>
          <em>{{ formatTime(item.duration) }}</em>
        </NuxtLink>
        <div class="row-actions">
          <button class="action-button" type="button" :aria-label="`重命名 ${item.name}`" @click="openRenameDialog(item)"><i class="bi bi-pencil"></i></button>
          <button class="action-button danger" type="button" :aria-label="`删除 ${item.name}`" @click="openDeleteDialog(item)"><i class="bi bi-trash3"></i></button>
        </div>
      </div>
    </section>
    <AppDialog :open="dialog.open" :title="dialog.title" :message="dialog.message" :confirm-text="dialog.kind === 'delete' ? '删除' : '保存'" :danger="dialog.kind === 'delete'" :busy="dialog.busy" @cancel="closeDialog" @confirm="confirmDialog">
      <label v-if="dialog.kind === 'rename'" class="rename-field"><span>名称</span><input v-model.trim="draftName" maxlength="80" @keyup.enter="confirmDialog" /></label>
    </AppDialog>
  </main>
</template>

<script setup lang="ts">
import type { RecordingMetadata } from '@tone/contracts'
import { deleteLocalRecording, listLocalRecordings, renameLocalRecording } from '~/utils/recordingStore'
import { useToast } from '~/composables/useToast'

const recordings = ref<RecordingMetadata[]>([])
const loading = ref(true)
const draftName = ref('')
const { showToast } = useToast()
const dialog = reactive<{ open: boolean; kind: 'rename' | 'delete' | null; target: RecordingMetadata | null; title: string; message: string; busy: boolean }>({ open: false, kind: null, target: null, title: '', message: '', busy: false })

onMounted(async () => {
  try { recordings.value = await listLocalRecordings() }
  catch { showToast('本地录音读取失败', 'error') }
  finally { loading.value = false }
})
function openRenameDialog(item: RecordingMetadata) { draftName.value = item.name; Object.assign(dialog, { open: true, kind: 'rename', target: item, title: '重命名录音', message: '' }) }
function openDeleteDialog(item: RecordingMetadata) { Object.assign(dialog, { open: true, kind: 'delete', target: item, title: '删除录音', message: `确定删除“${item.name}”？这个操作不能撤销。` }) }
function closeDialog() { if (!dialog.busy) Object.assign(dialog, { open: false, kind: null, target: null }) }
async function confirmDialog() {
  if (!dialog.target || !dialog.kind || dialog.busy) return
  if (dialog.kind === 'rename' && !draftName.value) return showToast('名称不能为空', 'error')
  dialog.busy = true
  try {
    if (dialog.kind === 'rename') {
      const updated = await renameLocalRecording(dialog.target.id, draftName.value)
      recordings.value = recordings.value.map(item => item.id === updated.id ? updated : item)
      showToast('录音已重命名', 'success')
    } else {
      await deleteLocalRecording(dialog.target.id)
      recordings.value = recordings.value.filter(item => item.id !== dialog.target?.id)
      showToast('录音已删除', 'success')
    }
    Object.assign(dialog, { open: false, kind: null, target: null })
  } catch { showToast('本地存储操作失败', 'error') }
  finally { dialog.busy = false }
}
function formatTime(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}` }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
</script>

<style scoped>
.list-page { min-height: 100dvh; background: #eef3f8; }.list-shell { min-height: 100dvh; max-width: 620px; margin: 0 auto; padding: 14px 14px 28px; background: #fff; }
.page-header { display: grid; grid-template-columns: 40px minmax(0, 1fr) 40px; align-items: center; gap: 8px; margin-bottom: 14px; }.page-header h1 { margin: 0; color: #162033; font-size: 1.22rem; font-weight: 850; text-align: center; }
.icon-link { display: grid; width: 40px; height: 40px; place-items: center; border: 1px solid #d6dfeb; border-radius: 999px; color: #303b4d; text-decoration: none; }
.storage-note { margin: 0 0 14px; padding: 10px 12px; border-radius: 8px; color: #66758a; background: #f4f7fb; font-size: .78rem; line-height: 1.45; }
.list-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; min-height: 64px; border-bottom: 1px solid #edf1f5; }.recording-link { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; align-items: center; min-width: 0; color: #1d2938; text-decoration: none; }
.recording-link span { display: grid; min-width: 0; gap: 3px; }.recording-link strong, .recording-link small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.recording-link small, .recording-link em { color: #66758a; font-size: .75rem; font-style: normal; }
.row-actions { display: flex; gap: 6px; padding-left: 8px; }.action-button { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid #d6dfeb; border-radius: 999px; color: #66758a; background: #fff; }.action-button.danger { color: #dc2626; }
.empty-row { padding: 24px; color: #8a97a7; text-align: center; }.empty-card { display: grid; justify-items: center; gap: 10px; padding: 56px 20px; color: #66758a; }.empty-card i { font-size: 2rem; }.empty-card a { color: #172033; font-weight: 800; }
.rename-field { display: grid; gap: 6px; padding: 0 16px 4px; }.rename-field input { height: 40px; border: 1px solid #d6dfeb; border-radius: 8px; padding: 0 10px; font-size: 16px; }
</style>
