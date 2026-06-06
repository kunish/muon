import { useStorage } from '@vueuse/core'
import { ref } from 'vue'
import { fetch as desktopFetch } from '@/desktop/http'
import { parseIcs } from '../lib/ics'
import { replaceSubscriptionEvents } from '../stores/calendarStore'

const SUBSCRIPTIONS_STORAGE_KEY = 'muon_calendar_subscriptions'

export interface CalendarSubscription {
  id: string
  url: string
}

/** 由 URL 派生稳定 id，使重复同步可幂等替换同一订阅的事件 */
function subscriptionId(url: string): string {
  let hash = 5381
  for (let i = 0; i < url.length; i++) hash = (hash * 33) ^ url.charCodeAt(i)
  return `cs${(hash >>> 0).toString(36)}`
}

export function useCalendarSubscriptions() {
  const subscriptions = useStorage<CalendarSubscription[]>(SUBSCRIPTIONS_STORAGE_KEY, [])
  const syncing = ref(false)

  function addSubscription(rawUrl: string): boolean {
    const url = rawUrl.trim()
    if (!url) return false
    if (subscriptions.value.some((sub) => sub.url === url)) return false
    subscriptions.value = [...subscriptions.value, { id: subscriptionId(url), url }]
    return true
  }

  function removeSubscription(id: string): void {
    subscriptions.value = subscriptions.value.filter((sub) => sub.id !== id)
    replaceSubscriptionEvents(id, [])
  }

  /** 拉取单个 iCal 订阅并把事件合并进日历（幂等） */
  async function syncSubscription(sub: CalendarSubscription): Promise<number> {
    const response = await desktopFetch(sub.url)
    if (!response.ok) throw new Error(`calendar subscription fetch failed: ${response.status}`)
    const parsed = parseIcs(await response.text())
    replaceSubscriptionEvents(sub.id, parsed)
    return parsed.length
  }

  /** 同步全部订阅，返回成功同步的订阅数 */
  async function syncAll(): Promise<number> {
    if (syncing.value) return 0
    syncing.value = true
    let synced = 0
    try {
      for (const sub of subscriptions.value) {
        try {
          await syncSubscription(sub)
          synced += 1
        } catch {
          /* 单个订阅失败不影响其余 */
        }
      }
    } finally {
      syncing.value = false
    }
    return synced
  }

  return { subscriptions, syncing, addSubscription, removeSubscription, syncSubscription, syncAll }
}
