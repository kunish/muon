import { fetch } from '@tauri-apps/plugin-http'
import { onUnmounted, ref } from 'vue'

// --- 网络状态类型 ---
export type ConnectionStatus = 'online' | 'offline' | 'server-unreachable'

const status = ref<ConnectionStatus>(navigator.onLine ? 'online' : 'offline')
const lastOfflineAt = ref<number | null>(null)

let pingTimer: ReturnType<typeof setInterval> | null = null
let listenerCount = 0
let consecutiveFailures = 0

function handleOnline() {
  // 浏览器恢复在线，但还需要 ping 确认服务器可达
  pingHomeserver()
}

function handleOffline() {
  status.value = 'offline'
  lastOfflineAt.value = Date.now()
  consecutiveFailures = 0
}

async function pingHomeserver() {
  // 浏览器本身就离线，直接标记
  if (!navigator.onLine) {
    status.value = 'offline'
    lastOfflineAt.value = lastOfflineAt.value || Date.now()
    return
  }

  try {
    const serverUrl = localStorage.getItem('muon_homeserver') || 'https://matrix.org'
    const resp = await fetch(`${serverUrl}/_matrix/client/versions`, {
      method: 'GET',
      connectTimeout: 5000,
    })
    if (resp.ok) {
      status.value = 'online'
      consecutiveFailures = 0
    }
    else {
      // 服务器返回非 2xx（如 502/503），但网络本身是通的
      consecutiveFailures++
      if (consecutiveFailures >= 2) {
        status.value = 'server-unreachable'
        lastOfflineAt.value = lastOfflineAt.value || Date.now()
      }
    }
  }
  catch {
    consecutiveFailures++
    // 区分：navigator.onLine 为 true 说明网络层通但服务器连不上
    if (!navigator.onLine) {
      status.value = 'offline'
    }
    else if (consecutiveFailures >= 2) {
      status.value = 'server-unreachable'
    }
    lastOfflineAt.value = lastOfflineAt.value || Date.now()
  }
}

function startPing() {
  if (pingTimer)
    return
  pingHomeserver()
  pingTimer = setInterval(pingHomeserver, 30_000)
}

function stopPing() {
  if (pingTimer) {
    clearInterval(pingTimer)
    pingTimer = null
  }
}

/** 从外部（如 sync ERROR）触发立即检测 */
export function triggerPing() {
  pingHomeserver()
}

export function useNetworkStatus() {
  if (listenerCount === 0) {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    startPing()
  }
  listenerCount++

  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0) {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      stopPing()
    }
  })

  return { status, lastOfflineAt }
}
