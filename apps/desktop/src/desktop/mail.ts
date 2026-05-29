import type { FetchedMail, MailAccountConfig, OutgoingMailMessage } from './bridge'
import { getDesktopBridge } from './bridge'

export type { FetchedMail, MailAccountConfig, OutgoingMailMessage }

/** 邮件收发依赖 Electron 主进程的 IMAP/SMTP 桥；浏览器/Electrobun 下不可用 */
export function isMailBridgeAvailable(): boolean {
  return Boolean(getDesktopBridge()?.mail)
}

export async function sendMail(
  account: MailAccountConfig,
  message: OutgoingMailMessage,
): Promise<{ messageId: string }> {
  const mail = getDesktopBridge()?.mail
  if (!mail) throw new Error('mail bridge unavailable')
  return mail.send(account, message)
}

export async function fetchInbox(account: MailAccountConfig, limit = 20): Promise<FetchedMail[]> {
  const mail = getDesktopBridge()?.mail
  if (!mail) throw new Error('mail bridge unavailable')
  return mail.fetchInbox(account, limit)
}
