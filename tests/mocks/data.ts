/**
 * 集中式测试数据 — 用户、房间、消息历史
 *
 * 提供完整的 Matrix 模拟数据，覆盖：
 * - 8 个用户（含自身），中文昵称
 * - 5 个 DM 房间，各包含多条消息
 * - 3 个群聊房间，多成员 + 消息
 * - 多种消息类型：文字 / 图片 / 文件 / 回复 / 语音 / 表情 reaction
 */

// ---------------------------------------------------------------------------
// 用户
// ---------------------------------------------------------------------------
export interface MockUser {
  userId: string
  displayName: string
  avatarUrl?: string
  presence: 'online' | 'offline' | 'unavailable'
}

export const SELF_USER_ID = '@test:localhost'

export const USERS: Record<string, MockUser> = {
  '@test:localhost': { userId: '@test:localhost', displayName: '我', presence: 'online' },
  '@alice:localhost': { userId: '@alice:localhost', displayName: '小红', avatarUrl: 'mxc://localhost/avatar_alice', presence: 'online' },
  '@bob:localhost': { userId: '@bob:localhost', displayName: '小明', avatarUrl: 'mxc://localhost/avatar_bob', presence: 'offline' },
  '@charlie:localhost': { userId: '@charlie:localhost', displayName: '小刚', presence: 'online' },
  '@diana:localhost': { userId: '@diana:localhost', displayName: '小丽', avatarUrl: 'mxc://localhost/avatar_diana', presence: 'unavailable' },
  '@edward:localhost': { userId: '@edward:localhost', displayName: '小伟', presence: 'offline' },
  '@fiona:localhost': { userId: '@fiona:localhost', displayName: '小芳', avatarUrl: 'mxc://localhost/avatar_fiona', presence: 'online' },
  '@george:localhost': { userId: '@george:localhost', displayName: '小杰', presence: 'offline' },
}

export const ALL_USER_IDS = Object.keys(USERS)

// ---------------------------------------------------------------------------
// 辅助：生成事件 / 时间戳
// ---------------------------------------------------------------------------
let eventSeq = 0
function nextEventId(): string {
  return `$evt_${++eventSeq}`
}

/** 基准时间：2026-02-27 09:00 UTC+8 */
const BASE_TS = new Date('2026-02-27T01:00:00Z').getTime()

function ts(minutesAfterBase: number): number {
  return BASE_TS + minutesAfterBase * 60_000
}

// ---------------------------------------------------------------------------
// 消息事件
// ---------------------------------------------------------------------------
export interface MockEvent {
  eventId: string
  type: string
  sender: string
  ts: number
  content: Record<string, any>
  /** 若非空则此事件已被撤回 */
  redacted?: boolean
}

function textMsg(sender: string, body: string, minute: number): MockEvent {
  return {
    eventId: nextEventId(),
    type: 'm.room.message',
    sender,
    ts: ts(minute),
    content: { msgtype: 'm.text', body },
  }
}

function imageMsg(sender: string, fileName: string, mxcUrl: string, minute: number): MockEvent {
  return {
    eventId: nextEventId(),
    type: 'm.room.message',
    sender,
    ts: ts(minute),
    content: {
      msgtype: 'm.image',
      body: fileName,
      url: mxcUrl,
      info: { mimetype: 'image/jpeg', size: 204800, w: 1280, h: 720 },
    },
  }
}

function fileMsg(sender: string, fileName: string, mxcUrl: string, size: number, minute: number): MockEvent {
  return {
    eventId: nextEventId(),
    type: 'm.room.message',
    sender,
    ts: ts(minute),
    content: {
      msgtype: 'm.file',
      body: fileName,
      url: mxcUrl,
      info: { mimetype: 'application/pdf', size },
    },
  }
}

function audioMsg(sender: string, duration: number, mxcUrl: string, minute: number): MockEvent {
  return {
    eventId: nextEventId(),
    type: 'm.room.message',
    sender,
    ts: ts(minute),
    content: {
      msgtype: 'm.audio',
      body: 'Voice message',
      url: mxcUrl,
      info: { mimetype: 'audio/ogg', size: 32000, duration },
    },
  }
}

function replyMsg(sender: string, body: string, replyToEventId: string, minute: number): MockEvent {
  return {
    eventId: nextEventId(),
    type: 'm.room.message',
    sender,
    ts: ts(minute),
    content: {
      'msgtype': 'm.text',
      'body': body,
      'm.relates_to': { 'm.in_reply_to': { event_id: replyToEventId } },
    },
  }
}

function reactionEvt(sender: string, targetEventId: string, emoji: string, minute: number): MockEvent {
  return {
    eventId: nextEventId(),
    type: 'm.reaction',
    sender,
    ts: ts(minute),
    content: {
      'm.relates_to': {
        rel_type: 'm.annotation',
        event_id: targetEventId,
        key: emoji,
      },
    },
  }
}

function stickerMsg(sender: string, emoji: string, minute: number): MockEvent {
  return {
    eventId: nextEventId(),
    type: 'm.sticker',
    sender,
    ts: ts(minute),
    content: {
      body: emoji,
      url: '',
      info: { mimetype: 'text/plain', 'xyz.muon.emoji': emoji },
    },
  }
}

// ---------------------------------------------------------------------------
// DM 房间
// ---------------------------------------------------------------------------
export interface MockRoom {
  roomId: string
  name: string
  isDirect: boolean
  dmUserId?: string
  members: string[]
  avatarUrl?: string
  events: MockEvent[]
  isEncrypted?: boolean
}

// 重置序号以保证确定性
eventSeq = 0

// ---- DM: test <-> alice (小红) ----
const dmAliceEvents: MockEvent[] = [
  textMsg('@alice:localhost', '在吗？有个事想问你', 0),
  textMsg('@test:localhost', '在的，怎么了？', 1),
  textMsg('@alice:localhost', '明天下午有空吗？想约你一起去看展览', 2),
  textMsg('@test:localhost', '明天下午可以啊，几点？', 3),
  textMsg('@alice:localhost', '两点半在美术馆门口集合怎么样？', 4),
  textMsg('@test:localhost', '好的没问题 👍', 5),
  imageMsg('@alice:localhost', '展览海报.jpg', 'mxc://localhost/poster_img', 6),
  textMsg('@alice:localhost', '就是这个展，看起来很不错吧', 7),
  textMsg('@test:localhost', '哇，这个看起来很有意思！我很期待', 8),
  textMsg('@alice:localhost', '对了，要不要叫上小明一起？', 10),
  textMsg('@test:localhost', '可以呀，你问问他', 11),
  textMsg('@alice:localhost', '好，我问一下他', 12),
  textMsg('@alice:localhost', '小明说他明天有事去不了 😅', 25),
  textMsg('@test:localhost', '那就咱俩去吧', 26),
  textMsg('@alice:localhost', '嗯嗯，到时候见！', 27),
  // 第二天的对话
  textMsg('@alice:localhost', '我到啦，你到哪了？', 1480),
  textMsg('@test:localhost', '马上到，还有两分钟', 1481),
  textMsg('@test:localhost', '到了到了，在入口处', 1483),
  textMsg('@alice:localhost', '看到你了！', 1484),
  // 展览后
  textMsg('@alice:localhost', '今天的展好棒啊！', 1600),
  imageMsg('@test:localhost', '打卡照片.jpg', 'mxc://localhost/photo_exhibit', 1601),
  textMsg('@test:localhost', '拍了好多照片哈哈', 1602),
  textMsg('@alice:localhost', '对对对，我也拍了好多，等下发你', 1603),
  imageMsg('@alice:localhost', '展品1.jpg', 'mxc://localhost/exhibit_1', 1605),
  imageMsg('@alice:localhost', '展品2.jpg', 'mxc://localhost/exhibit_2', 1606),
  textMsg('@test:localhost', '这两张拍得真好！', 1607),
  textMsg('@alice:localhost', '谢谢 😊 下次再一起出去玩', 1608),
  textMsg('@test:localhost', '好呀，随时约', 1609),
]
// 给一些消息加 reaction
const aliceHiEvt = dmAliceEvents[0]
dmAliceEvents.push(reactionEvt('@test:localhost', aliceHiEvt.eventId, '👋', 1))
const posterEvt = dmAliceEvents[6]
dmAliceEvents.push(reactionEvt('@test:localhost', posterEvt.eventId, '😍', 9))

// ---- DM: test <-> bob (小明) ----
const dmBobEvents: MockEvent[] = [
  textMsg('@bob:localhost', '兄弟，新版本的代码你看了吗？', 30),
  textMsg('@test:localhost', '还没来得及，今天晚上看', 32),
  textMsg('@bob:localhost', '好的，里面有几个 bug 需要修一下', 33),
  textMsg('@test:localhost', '什么 bug？', 34),
  textMsg('@bob:localhost', '登录页面在 Safari 上样式有问题，还有一个数据请求的竞态条件', 35),
  textMsg('@test:localhost', '了解，我先处理 Safari 的问题', 36),
  fileMsg('@bob:localhost', 'bug_report.pdf', 'mxc://localhost/bug_report', 125000, 37),
  textMsg('@bob:localhost', '这是详细的 bug 报告，你看看', 38),
  textMsg('@test:localhost', '收到，我看一下', 39),
  textMsg('@test:localhost', 'Safari 的问题找到了，是 flex gap 的兼容性问题', 120),
  textMsg('@bob:localhost', '果然，Safari 老毛病了', 121),
  textMsg('@test:localhost', '已经修好了，你帮我测一下', 122),
  textMsg('@bob:localhost', '好，我测一下', 123),
  textMsg('@bob:localhost', 'Safari 上没问题了 ✅', 145),
  textMsg('@test:localhost', '太好了，竞态条件我明天处理', 146),
  textMsg('@bob:localhost', '不着急，这个周末前搞定就行', 147),
  audioMsg('@bob:localhost', 8500, 'mxc://localhost/voice_bob_1', 148),
  textMsg('@test:localhost', '收到，周末前一定搞定', 149),
  // 后续对话
  textMsg('@bob:localhost', '竞态条件的 bug 你搞定了吗？', 2000),
  textMsg('@test:localhost', '搞定了，用 AbortController 解决的', 2001),
  textMsg('@bob:localhost', '代码发我看看？', 2002),
  textMsg('@test:localhost', '```\nconst controller = new AbortController()\nfetch(url, { signal: controller.signal })\n```', 2003),
  textMsg('@bob:localhost', '不错不错，这个方案简洁', 2004),
]
const bugReportEvt = dmBobEvents[6]
dmBobEvents.push(reactionEvt('@test:localhost', bugReportEvt.eventId, '👍', 40))

// ---- DM: test <-> charlie (小刚) ----
const dmCharlieEvents: MockEvent[] = [
  textMsg('@charlie:localhost', '哥，周末一起打球不？', 50),
  textMsg('@test:localhost', '什么球？', 51),
  textMsg('@charlie:localhost', '羽毛球呗，上次那个场地', 52),
  textMsg('@test:localhost', '行啊，周六下午怎么样？', 53),
  textMsg('@charlie:localhost', '周六下午三点，我去订场地', 54),
  textMsg('@test:localhost', '好的 💪', 55),
  textMsg('@charlie:localhost', '场地订好了，3号场', 200),
  textMsg('@test:localhost', '收到', 201),
  textMsg('@charlie:localhost', '对了，带上你那个新拍子', 202),
  textMsg('@test:localhost', '没问题', 203),
  stickerMsg('@charlie:localhost', '🏸', 204),
  textMsg('@charlie:localhost', '到了说一声', 1500),
  textMsg('@test:localhost', '快了快了，堵车 🚗', 1501),
  textMsg('@charlie:localhost', '哈哈哈行，我先热身', 1502),
  textMsg('@test:localhost', '到了！', 1520),
]

// ---- DM: test <-> diana (小丽) ----
const dmDianaEvents: MockEvent[] = [
  textMsg('@diana:localhost', '请问这个项目的设计稿在哪里可以看？', 60),
  textMsg('@test:localhost', '在 Figma 上，我把链接发给你', 61),
  textMsg('@test:localhost', 'https://figma.com/file/xxx/muon-design', 62),
  textMsg('@diana:localhost', '收到，谢谢！', 63),
  textMsg('@diana:localhost', '设计稿看了，有几个页面的交互想和你讨论一下', 300),
  textMsg('@test:localhost', '好的，具体是哪些？', 301),
  textMsg('@diana:localhost', '主要是聊天页面的右键菜单和设置面板的动画', 302),
  imageMsg('@diana:localhost', '设计标注.png', 'mxc://localhost/design_annotation', 303),
  textMsg('@test:localhost', '明白了，右键菜单我可以加个弹出动画', 304),
  textMsg('@diana:localhost', '嗯嗯，可以参考 Telegram 的效果', 305),
]

// ---- DM: test <-> edward (小伟) ----
const dmEdwardEvents: MockEvent[] = [
  textMsg('@edward:localhost', '大佬，问个技术问题', 70),
  textMsg('@test:localhost', '你说', 71),
  textMsg('@edward:localhost', 'Vue 3 的 shallowRef 和 ref 有什么区别？', 72),
  textMsg('@test:localhost', 'ref 会深度追踪响应性，shallowRef 只追踪 .value 本身的变化。如果你放的是大数组或复杂对象，用 shallowRef 性能更好', 73),
  textMsg('@edward:localhost', '懂了，那我列表数据应该用 shallowRef？', 74),
  textMsg('@test:localhost', '对，替换整个数组触发更新，内部变化用 triggerRef', 75),
  textMsg('@edward:localhost', '太有帮助了，谢谢大佬！', 76),
]

// ---------------------------------------------------------------------------
// 群聊房间
// ---------------------------------------------------------------------------

// ---- 群聊: 项目讨论组 ----
const groupProjectEvents: MockEvent[] = [
  textMsg('@test:localhost', '大家早上好，今天的站会推迟到 10 点', 80),
  textMsg('@alice:localhost', '好的收到', 81),
  textMsg('@bob:localhost', '收到 👌', 82),
  textMsg('@charlie:localhost', 'OK', 83),
  textMsg('@diana:localhost', '好的', 84),
  textMsg('@test:localhost', '站会开始，大家依次说一下昨天的进度', 140),
  textMsg('@alice:localhost', '我昨天完成了用户资料页的样式调整', 141),
  textMsg('@bob:localhost', '我修了两个前端 bug，还在处理第三个', 142),
  textMsg('@charlie:localhost', '后端 API 已经部署到测试环境了', 143),
  textMsg('@diana:localhost', '设计稿已经更新到最新版本', 144),
  textMsg('@test:localhost', '很好，进度不错。今天的重点是准备下周的 demo', 145),
  textMsg('@alice:localhost', '需要我准备哪些页面的截图？', 146),
  textMsg('@test:localhost', '主要是聊天页面、联系人页面、设置页面这三个', 147),
  textMsg('@alice:localhost', '好的，下班前发出来', 148),
  textMsg('@bob:localhost', '性能优化的数据我也整理一下', 149),
  textMsg('@test:localhost', '那今天就这样，大家加油 💪', 150),
  // 后续讨论
  textMsg('@bob:localhost', '@test:localhost 消息列表的虚拟滚动要不要加？数据量大的时候有卡顿', 400),
  textMsg('@test:localhost', '先不加，等遇到实际性能问题再说。过早优化是万恶之源', 401),
  textMsg('@charlie:localhost', '赞同，先保证功能正确', 402),
  textMsg('@alice:localhost', '页面截图好了，发在这里大家看看', 410),
  imageMsg('@alice:localhost', '聊天页面.png', 'mxc://localhost/screenshot_chat', 411),
  imageMsg('@alice:localhost', '联系人页面.png', 'mxc://localhost/screenshot_contacts', 412),
  imageMsg('@alice:localhost', '设置页面.png', 'mxc://localhost/screenshot_settings', 413),
  textMsg('@test:localhost', '截图很完美，辛苦了！', 414),
  textMsg('@diana:localhost', '小红做的截图真好看 ✨', 415),
]
const demoMsgEvt = groupProjectEvents[10]
groupProjectEvents.push(reactionEvt('@alice:localhost', demoMsgEvt.eventId, '👍', 151))
groupProjectEvents.push(reactionEvt('@bob:localhost', demoMsgEvt.eventId, '💪', 152))

// ---- 群聊: 家庭群 ----
const groupFamilyEvents: MockEvent[] = [
  textMsg('@fiona:localhost', '周末谁来吃饭呀？', 90),
  textMsg('@test:localhost', '我来！', 91),
  textMsg('@george:localhost', '我也来，带点水果过去', 92),
  textMsg('@alice:localhost', '算我一个～', 93),
  textMsg('@fiona:localhost', '太好了，那我准备四个人的菜', 94),
  textMsg('@fiona:localhost', '想吃什么？提前说，我好买菜', 95),
  textMsg('@test:localhost', '红烧肉！', 96),
  textMsg('@george:localhost', '鱼香茄子 🍆', 97),
  textMsg('@alice:localhost', '西红柿炒蛋就行 😋', 98),
  textMsg('@fiona:localhost', '好的好的，都记下了', 99),
  textMsg('@fiona:localhost', '菜买好了！', 500),
  imageMsg('@fiona:localhost', '今天的菜.jpg', 'mxc://localhost/groceries', 501),
  textMsg('@test:localhost', '看起来好丰盛', 502),
  textMsg('@george:localhost', '我买了西瓜和葡萄，一会到', 503),
  textMsg('@fiona:localhost', '快来吧，已经开始做了', 504),
]

// ---- 群聊: 技术交流群 ----
const groupTechEvents: MockEvent[] = [
  textMsg('@bob:localhost', '有人用过 Tauri 2.0 吗？', 100),
  textMsg('@test:localhost', '我正在用，有什么问题？', 101),
  textMsg('@edward:localhost', '我也在研究', 102),
  textMsg('@bob:localhost', '跨平台打包的时候遇到点问题', 103),
  textMsg('@test:localhost', '什么问题？贴一下错误日志', 104),
  textMsg('@bob:localhost', '```\nerror[E0433]: failed to resolve: use of undeclared crate\n```', 105),
  textMsg('@test:localhost', '这个是 Rust 依赖没装好，检查一下 Cargo.toml', 106),
  textMsg('@bob:localhost', '果然，少了一个 dependency，加上就好了', 120),
  textMsg('@edward:localhost', 'Tauri 2 比 Electron 快多了，二进制文件才 8MB', 121),
  textMsg('@test:localhost', '是的，而且内存占用也小很多', 122),
  textMsg('@charlie:localhost', '有没有人测过 Tauri 的 IPC 性能？', 600),
  textMsg('@test:localhost', '我测过，JSON 序列化大概 0.1ms，比 Electron 的 IPC 快 3 倍左右', 601),
  textMsg('@charlie:localhost', '这么快？有 benchmark 数据吗？', 602),
  textMsg('@test:localhost', '有的，我整理一下发出来', 603),
  fileMsg('@test:localhost', 'tauri_benchmark.pdf', 'mxc://localhost/benchmark_pdf', 85000, 604),
  textMsg('@charlie:localhost', '太棒了，这个数据正好写技术报告用', 605),
  textMsg('@fiona:localhost', '推荐一个好用的 VS Code 插件：Tauri 官方的那个', 610),
  textMsg('@edward:localhost', '已经装了，自动补全确实方便', 611),
  textMsg('@bob:localhost', '感谢推荐，装上了 👍', 612),
  textMsg('@george:localhost', '大家有没有研究过 WebView2 的限制？', 620),
  textMsg('@test:localhost', '主要是 Windows 上的 WebView2 版本问题，但 Tauri 2 做了很好的兼容', 621),
]

// ---------------------------------------------------------------------------
// 房间汇总
// ---------------------------------------------------------------------------
export const DM_ROOMS: MockRoom[] = [
  {
    roomId: '!dm_alice:localhost',
    name: '小红',
    isDirect: true,
    dmUserId: '@alice:localhost',
    members: ['@test:localhost', '@alice:localhost'],
    avatarUrl: 'mxc://localhost/avatar_alice',
    events: dmAliceEvents,
  },
  {
    roomId: '!dm_bob:localhost',
    name: '小明',
    isDirect: true,
    dmUserId: '@bob:localhost',
    members: ['@test:localhost', '@bob:localhost'],
    avatarUrl: 'mxc://localhost/avatar_bob',
    events: dmBobEvents,
  },
  {
    roomId: '!dm_charlie:localhost',
    name: '小刚',
    isDirect: true,
    dmUserId: '@charlie:localhost',
    members: ['@test:localhost', '@charlie:localhost'],
    events: dmCharlieEvents,
  },
  {
    roomId: '!dm_diana:localhost',
    name: '小丽',
    isDirect: true,
    dmUserId: '@diana:localhost',
    members: ['@test:localhost', '@diana:localhost'],
    avatarUrl: 'mxc://localhost/avatar_diana',
    events: dmDianaEvents,
  },
  {
    roomId: '!dm_edward:localhost',
    name: '小伟',
    isDirect: true,
    dmUserId: '@edward:localhost',
    members: ['@test:localhost', '@edward:localhost'],
    events: dmEdwardEvents,
  },
]

export const GROUP_ROOMS: MockRoom[] = [
  {
    roomId: '!group_project:localhost',
    name: '项目讨论组',
    isDirect: false,
    members: ['@test:localhost', '@alice:localhost', '@bob:localhost', '@charlie:localhost', '@diana:localhost'],
    events: groupProjectEvents,
  },
  {
    roomId: '!group_family:localhost',
    name: '家庭群',
    isDirect: false,
    members: ['@test:localhost', '@alice:localhost', '@fiona:localhost', '@george:localhost'],
    events: groupFamilyEvents,
  },
  {
    roomId: '!group_tech:localhost',
    name: '技术交流群',
    isDirect: false,
    members: ['@test:localhost', '@bob:localhost', '@charlie:localhost', '@edward:localhost', '@fiona:localhost', '@george:localhost'],
    events: groupTechEvents,
  },
]

export const ALL_ROOMS: MockRoom[] = [...DM_ROOMS, ...GROUP_ROOMS]

// ---------------------------------------------------------------------------
// m.direct account data (userId → roomId[])
// ---------------------------------------------------------------------------
export const M_DIRECT_CONTENT: Record<string, string[]> = {}
for (const room of DM_ROOMS) {
  if (room.dmUserId) {
    M_DIRECT_CONTENT[room.dmUserId] = [room.roomId]
  }
}

// ---------------------------------------------------------------------------
// 工厂函数：构建 mock Room 对象（模拟 matrix-js-sdk Room 接口）
// ---------------------------------------------------------------------------

/** 创建一个模拟的 MatrixEvent 对象 */
export function createMockEvent(evt: MockEvent) {
  return {
    getId: () => evt.eventId,
    getType: () => evt.type,
    getSender: () => evt.sender,
    getTs: () => evt.ts,
    getDate: () => new Date(evt.ts),
    getContent: () => ({ ...evt.content }),
    isRedacted: () => !!evt.redacted,
    event: { type: evt.type, content: evt.content, sender: evt.sender, event_id: evt.eventId, origin_server_ts: evt.ts },
  }
}

/** 创建一个模拟的 RoomMember 对象 */
export function createMockMember(userId: string, roomId?: string) {
  const user = USERS[userId]
  return {
    userId,
    name: user?.displayName ?? userId.split(':')[0].slice(1),
    getMxcAvatarUrl: () => user?.avatarUrl ?? null,
    getAvatarUrl: () => user?.avatarUrl ?? null,
    membership: 'join',
    powerLevel: userId === '@test:localhost' ? 50 : 0,
  }
}

/** 创建一个模拟的 Room 对象 */
export function createMockRoom(room: MockRoom) {
  const events = room.events.map(createMockEvent)
  const members = room.members.map(uid => createMockMember(uid, room.roomId))

  return {
    roomId: room.roomId,
    name: room.name,
    timeline: events,
    tags: {} as Record<string, any>,

    getMyMembership: () => 'join',
    getJoinedMembers: () => members,
    getJoinedMemberCount: () => members.length,
    getMember: (userId: string) => members.find(m => m.userId === userId) ?? null,
    getMxcAvatarUrl: () => room.avatarUrl ?? null,
    getLiveTimeline: () => ({
      getEvents: () => events,
    }),
    getUnreadNotificationCount: (type?: string) => {
      // DM 房间模拟 1-3 条未读
      if (room.isDirect && room.roomId === '!dm_alice:localhost') return 3
      if (room.roomId === '!group_project:localhost') return 5
      return 0
    },
    currentState: {
      getStateEvents: (_type: string, _key: string) => null,
    },
  }
}

// ---------------------------------------------------------------------------
// 预构建的 mock Room 对象
// ---------------------------------------------------------------------------
export const MOCK_ROOM_OBJECTS = ALL_ROOMS.map(createMockRoom)

export function getMockRoomById(roomId: string) {
  return MOCK_ROOM_OBJECTS.find(r => r.roomId === roomId) ?? null
}
