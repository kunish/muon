import { i18n } from '@/app/plugins/i18n'

export function localizedText(key: string): string {
  return i18n.global.t(key)
}
