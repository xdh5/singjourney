export default defineNuxtConfig({
  ssr: false,
  modules: [],
  css: ['bootstrap/dist/css/bootstrap.css', 'bootstrap-icons/font/bootstrap-icons.css'],
  app: {
    head: {
      title: 'TONE',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'theme-color', content: '#ffc43d' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'TONE' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/icons/icon-192.png' }
      ]
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  },
  devtools: { enabled: false },
  nitro: { preset: 'static' }
})
