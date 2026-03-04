interface Sticker {
  emoji: string
  name: string
}

export interface StickerPack {
  id: string
  icon: string
  label: string
  stickers: Sticker[]
}

/** 图片贴纸 */
export interface ImageSticker {
  id: string
  name: string
  mxcUrl: string
  width: number
  height: number
  mimetype: string // image/webp, image/png, image/gif
  size?: number
}

/** 自定义贴纸包 */
export interface CustomStickerPack {
  id: string
  name: string
  /** 包封面：第一张贴纸的 mxcUrl 或 emoji */
  icon: string
  stickers: ImageSticker[]
  createdAt: number
}

// ─── 内置 Emoji 贴纸包（保留旧的）──────────────────────────────
export const BUILTIN_STICKER_PACKS: StickerPack[] = [
  {
    id: 'faces',
    icon: '😀',
    label: '表情',
    stickers: [
      { emoji: '😀', name: '笑脸' },
      { emoji: '😂', name: '笑哭' },
      { emoji: '🥰', name: '喜欢' },
      { emoji: '😎', name: '墨镜' },
      { emoji: '🤔', name: '思考' },
      { emoji: '😴', name: '睡觉' },
      { emoji: '🤯', name: '爆炸' },
      { emoji: '🥳', name: '庆祝' },
      { emoji: '😭', name: '大哭' },
      { emoji: '🤗', name: '拥抱' },
      { emoji: '😈', name: '恶魔' },
      { emoji: '👻', name: '幽灵' },
      { emoji: '💀', name: '骷髅' },
      { emoji: '🤖', name: '机器人' },
      { emoji: '👽', name: '外星人' },
    ],
  },
  {
    id: 'gestures',
    icon: '👍',
    label: '手势',
    stickers: [
      { emoji: '👍', name: '赞' },
      { emoji: '👎', name: '踩' },
      { emoji: '✌️', name: '胜利' },
      { emoji: '🤞', name: '祈愿' },
      { emoji: '🤟', name: '爱你' },
      { emoji: '🤘', name: '摇滚' },
      { emoji: '👌', name: 'OK' },
      { emoji: '🤌', name: '意大利手势' },
      { emoji: '👏', name: '鼓掌' },
      { emoji: '🙌', name: '万岁' },
      { emoji: '🤝', name: '握手' },
      { emoji: '🫶', name: '比心' },
      { emoji: '💪', name: '加油' },
      { emoji: '👋', name: '挥手' },
      { emoji: '🫡', name: '敬礼' },
    ],
  },
  {
    id: 'animals',
    icon: '🐶',
    label: '动物',
    stickers: [
      { emoji: '🐶', name: '狗' },
      { emoji: '🐱', name: '猫' },
      { emoji: '🐭', name: '老鼠' },
      { emoji: '🐹', name: '仓鼠' },
      { emoji: '🐰', name: '兔子' },
      { emoji: '🦊', name: '狐狸' },
      { emoji: '🐻', name: '熊' },
      { emoji: '🐼', name: '熊猫' },
      { emoji: '🐨', name: '考拉' },
      { emoji: '🐯', name: '老虎' },
      { emoji: '🦁', name: '狮子' },
      { emoji: '🐮', name: '牛' },
      { emoji: '🐷', name: '猪' },
      { emoji: '🐸', name: '青蛙' },
      { emoji: '🐵', name: '猴子' },
    ],
  },
]
