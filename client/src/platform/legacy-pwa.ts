const LEGACY_WEB_CACHE_NAMES = ['tone-v2']

export async function removeLegacyWebAppCache() {
  // #ifdef H5
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(registration => registration.unregister()))
  }
  if ('caches' in globalThis) {
    await Promise.all(LEGACY_WEB_CACHE_NAMES.map(cacheName => caches.delete(cacheName)))
  }
  // #endif
}
