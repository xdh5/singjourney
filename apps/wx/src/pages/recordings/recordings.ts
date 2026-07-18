import { formatTime, listRecordings, removeRecording, type WxRecording } from '../../shared/storage'

Page({
  data: { items: [] as Array<WxRecording & { durationLabel: string; dateLabel: string }>, playingId: '' },
  player: null as any,
  onShow() { this.refresh() },
  onUnload() { this.player?.destroy() },
  refresh() {
    const items = listRecordings().map(item => ({ ...item, durationLabel: formatTime(item.duration), dateLabel: formatDate(item.createdAt) }))
    this.setData({ items })
  },
  goRecord() { wx.navigateTo({ url: '/pages/record/record' }) },
  togglePlay(event: any) {
    const { id, path } = event.currentTarget.dataset
    if (this.data.playingId === id) { this.player?.pause(); this.setData({ playingId: '' }); return }
    this.player?.destroy()
    this.player = wx.createInnerAudioContext()
    this.player.src = path
    this.player.onEnded(() => this.setData({ playingId: '' }))
    this.player.onError(() => { this.setData({ playingId: '' }); wx.showToast({ title: '录音无法播放', icon: 'none' }) })
    this.player.play(); this.setData({ playingId: id })
  },
  remove(event: any) {
    const id = event.currentTarget.dataset.id
    wx.showModal({ title: '删除录音', content: '删除后不能恢复，确定继续？', success: (result: any) => { if (result.confirm) { if (this.data.playingId === id) { this.player?.destroy(); this.setData({ playingId: '' }) }; removeRecording(id); this.refresh() } } })
  }
})

function formatDate(value: string) {
  const date = new Date(value)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
