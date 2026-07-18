<template>
  <main class="tone-menu">
    <section class="tone-shell">
      <header class="menu-header">
        <p>TONE</p>
        <h1>随时看见你的声音</h1>
        <span>录音和音高曲线仅保存在当前设备</span>
      </header>

      <nav class="module-list" aria-label="TONE 功能菜单">
        <NuxtLink class="module-row primary" to="/record">
          <span class="module-icon"><i class="bi bi-mic-fill"></i></span>
          <span class="module-copy"><strong>自由录音</strong><small>实时查看并保存音高曲线</small></span>
          <i class="bi bi-chevron-right"></i>
        </NuxtLink>
        <NuxtLink class="module-row" to="/recordings">
          <span class="module-icon"><i class="bi bi-collection-play"></i></span>
          <span class="module-copy"><strong>录音记录</strong><small>播放、重命名或删除本机录音</small></span>
          <i class="bi bi-chevron-right"></i>
        </NuxtLink>
      </nav>
      <p class="privacy-note"><i class="bi bi-device-ssd"></i> 无账号、无上传、无服务端</p>
    </section>
  </main>
</template>

<style scoped>
.tone-menu { min-height: 100dvh; background: #eef3f8; }
.tone-shell { min-height: 100dvh; max-width: 520px; margin: 0 auto; padding: 44px 16px 28px; background: #fff; }
.menu-header { margin-bottom: 26px; }
.menu-header p { margin: 0 0 5px; color: #627083; font-size: .76rem; font-weight: 900; letter-spacing: .12em; }
.menu-header h1 { margin: 0 0 8px; color: #162033; font-size: 1.6rem; font-weight: 900; }
.menu-header span { color: #66758a; font-size: .86rem; }
.module-list { display: grid; gap: 12px; }
.module-row { display: grid; grid-template-columns: 46px minmax(0, 1fr) 20px; align-items: center; min-height: 76px; gap: 12px; padding: 12px 14px; border: 1px solid #dce5ef; border-radius: 12px; color: #1d2938; background: #f8fafc; text-decoration: none; }
.module-row.primary { border-color: #ffc43d; background: #fff9e8; }
.module-icon { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 999px; background: #fff; color: #334155; font-size: 1.2rem; }
.primary .module-icon { background: #ffc43d; color: #172033; }
.module-copy { display: grid; min-width: 0; gap: 4px; }
.module-copy strong { font-size: 1rem; font-weight: 850; }
.module-copy small { overflow: hidden; color: #66758a; font-size: .8rem; text-overflow: ellipsis; white-space: nowrap; }
.privacy-note { display: flex; align-items: center; justify-content: center; gap: 7px; margin: 28px 0 0; color: #8290a2; font-size: .78rem; }
</style>
