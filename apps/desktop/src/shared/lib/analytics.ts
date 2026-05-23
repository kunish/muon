export function setAnalyticsEnabled(enabled: boolean): void {
  localStorage.setItem('muon_analytics_enabled', String(enabled))
  if (import.meta.env.DEV)
    // eslint-disable-next-line no-console
    console.debug('[Analytics] enabled:', enabled)
}
