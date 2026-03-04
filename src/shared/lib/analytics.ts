interface AnalyticsEvent {
  name: string
  category: 'chat' | 'call' | 'contact' | 'settings' | 'app'
  properties?: Record<string, string | number | boolean>
  timestamp: number
}

interface AnalyticsState {
  events: AnalyticsEvent[]
  userId: string | null
  enabled: boolean
}

const MAX_EVENTS = 1000

const state: AnalyticsState = {
  events: [],
  userId: null,
  enabled: localStorage.getItem('muon_analytics_enabled') !== 'false',
}

export function setAnalyticsEnabled(enabled: boolean): void {
  state.enabled = enabled
  localStorage.setItem('muon_analytics_enabled', String(enabled))
  if (import.meta.env.DEV)
    // eslint-disable-next-line no-console
    console.debug('[Analytics] enabled:', enabled)
}

export function trackEvent(
  name: string,
  category: AnalyticsEvent['category'],
  properties?: Record<string, string | number | boolean>,
): void {
  if (!state.enabled)
    return

  const event: AnalyticsEvent = {
    name,
    category,
    properties,
    timestamp: Date.now(),
  }

  state.events.push(event)

  if (state.events.length > MAX_EVENTS) {
    state.events = state.events.slice(-MAX_EVENTS)
  }

  if (import.meta.env.DEV)
    // eslint-disable-next-line no-console
    console.debug('[Analytics] track:', name, category, properties ?? '')
}
