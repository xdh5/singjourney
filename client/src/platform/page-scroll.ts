let webScrollLocked = false
let previousHtmlOverflowY = ''
let previousBodyOverflowY = ''

export function lockDocumentScroll() {
  // #ifdef H5
  if (webScrollLocked) return
  previousHtmlOverflowY = document.documentElement.style.overflowY
  previousBodyOverflowY = document.body.style.overflowY
  document.documentElement.style.overflowY = 'hidden'
  document.body.style.overflowY = 'hidden'
  webScrollLocked = true
  // #endif
}

export function unlockDocumentScroll() {
  // #ifdef H5
  if (!webScrollLocked) return
  document.documentElement.style.overflowY = previousHtmlOverflowY
  document.body.style.overflowY = previousBodyOverflowY
  webScrollLocked = false
  // #endif
}
