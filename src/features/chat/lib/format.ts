/**
 * 根据 ID 字符串生成确定性渐变色，用于无头像时的占位背景
 */
export function avatarGradient(id: string): string {
  let hash = 0
  for (const ch of id) {
    hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `linear-gradient(135deg, oklch(62% 0.12 ${hue}), oklch(48% 0.12 ${(hue + 40) % 360}))`
}

/**
 * 获取名称首字母大写
 */
export function initials(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

const WEEKDAYS_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const BOT_NAME_RE = /^bot[_-]|[_-]bot$|^bot$/

/** 获取今天 0 点的时间戳 */
function todayStart(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 格式化为 HH:mm */
function formatHHMM(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/** 将时间戳归类到时间区间 */
function classifyTimeBucket(ts: number): 'today' | 'yesterday' | 'thisWeek' | 'thisYear' | 'older' {
  const today = todayStart()
  if (ts >= today)
    return 'today'
  if (ts >= today - 86_400_000)
    return 'yesterday'
  if (ts >= today - 6 * 86_400_000)
    return 'thisWeek'
  if (new Date(ts).getFullYear() === new Date().getFullYear())
    return 'thisYear'
  return 'older'
}

/** 根据时间区间格式化日期部分（不含时间） */
function formatDatePart(d: Date, locale: string, bucket: string): string {
  const isZh = locale === 'zh'
  switch (bucket) {
    case 'today':
      return isZh ? '今天' : 'Today'
    case 'yesterday':
      return isZh ? '昨天' : 'Yesterday'
    case 'thisWeek':
      return isZh ? WEEKDAYS_ZH[d.getDay()] : WEEKDAYS_EN[d.getDay()]
    case 'thisYear':
      return isZh
        ? `${d.getMonth() + 1}月${d.getDate()}日`
        : `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
    default: // older
      return isZh
        ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
        : `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
  }
}

/**
 * 飞书风格时间格式化（会话列表用）：
 * - 今天 → HH:mm
 * - 昨天 → 昨天 / Yesterday
 * - 本周内(2-6天前) → 星期X / Wed
 * - 今年内 → MM月DD日 / MM/DD
 * - 更早 → YYYY/MM/DD
 */
export function formatMessageTime(ts: number | undefined, locale: string = 'zh'): string {
  if (!ts)
    return ''
  const d = new Date(ts)
  const bucket = classifyTimeBucket(ts)
  // 会话列表中，今天直接显示时间，不显示"今天"前缀
  if (bucket === 'today')
    return formatHHMM(d)
  return formatDatePart(d, locale, bucket)
}

/**
 * 飞书风格时间分割线格式化（聊天历史用）：
 * - 今天 → 今天 HH:mm
 * - 昨天 → 昨天 HH:mm
 * - 本周内 → 星期X HH:mm
 * - 今年内 → MM月DD日 HH:mm
 * - 更早 → YYYY年MM月DD日 HH:mm
 */
export function formatTimestampDivider(ts: number, locale: string = 'zh'): string {
  const d = new Date(ts)
  const bucket = classifyTimeBucket(ts)
  return `${formatDatePart(d, locale, bucket)} ${formatHHMM(d)}`
}

/**
 * 消息类型 → i18n key 映射
 */
const MESSAGE_TYPE_KEYS: Record<string, string> = {
  'm.image': 'chat.image',
  'm.video': 'chat.video',
  'm.audio': 'chat.voice_message',
  'm.file': 'chat.file',
}

export function messageTypeLabel(type?: string): string | null {
  if (!type || type === 'm.text' || type === 'm.notice')
    return null
  return MESSAGE_TYPE_KEYS[type] ?? null
}

/**
 * 判断用户是否可能是 Bot
 * Matrix 惯例：appservice bridge 用户 ID 以 @_ 开头，
 * 或者用户名中包含 "bot" 关键词
 */
export function isLikelyBot(userId: string): boolean {
  if (!userId)
    return false
  const localpart = userId.split(':')[0]?.slice(1)?.toLowerCase() || ''
  // appservice bridge 用户通常以 _ 开头（如 @_slack_xxx:server）
  if (localpart.startsWith('_'))
    return true
  // 用户名包含 bot 后缀或前缀
  if (BOT_NAME_RE.test(localpart))
    return true
  return false
}
