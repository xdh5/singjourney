<template><ToneAnalyzer mode="playback" :recording-id="recordingId" /></template>
<script setup lang="ts">
const route = useRoute()
const recordingId = computed(() => String(route.params.recordingId || ''))
</script>
