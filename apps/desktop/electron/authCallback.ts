export const ENTERPRISE_AUTH_CALLBACK_CHANNEL = 'muon:auth-callback'

export function isEnterpriseAuthCallbackUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'muon:' && url.hostname === 'auth' && url.pathname === '/callback'
  } catch {
    return false
  }
}

export function extractEnterpriseAuthCallbackUrl(argv: readonly string[]): string | null {
  return argv.find((value) => isEnterpriseAuthCallbackUrl(value)) ?? null
}
