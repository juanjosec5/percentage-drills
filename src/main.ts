import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { useI18n } from './composables/useI18n'
import { KEY } from './stores/save'
import './style.css'

const root = document.getElementById('app')!

/**
 * Plain DOM, since Vue is what failed. The likeliest cause is a save the app can't handle, so
 * the one way out is erasing it, behind the same confirm as Reset progress.
 */
function showFallback() {
  const { t } = useI18n()
  const title = document.createElement('p')
  title.className = 'text-xl font-semibold'
  title.textContent = t('error.title')
  const reset = document.createElement('button')
  reset.className = 'btn btn-primary'
  reset.textContent = t('error.reset')
  reset.onclick = () => {
    if (!confirm(t('home.resetConfirm'))) return
    try {
      localStorage.removeItem(KEY)
    } catch {
      // Storage blocked: nothing saved to erase.
    }
    location.reload()
  }
  const box = document.createElement('div')
  box.className = 'mx-auto max-w-xl space-y-4 px-4 py-8'
  box.append(title, reset)
  root.replaceChildren(box)
}

/**
 * The fallback is for an app that can't start: any error during the first render (Home can come
 * up half-drawn, without its Start button), or a blank screen later. An error that leaves a
 * working app on screen just logs.
 */
let starting = true
const blank = () => !root.firstElementChild

const app = createApp(App).use(createPinia())
app.config.errorHandler = (err) => {
  console.error(err)
  const failedStart = starting
  // After the current render settles: a failed component renders as an empty comment.
  setTimeout(() => {
    if (failedStart || blank()) showFallback()
  })
}
try {
  app.mount(root)
} catch (err) {
  console.error(err)
  showFallback()
}
starting = false
