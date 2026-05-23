const MATRIX_HTML_FORMAT = 'org.matrix.custom.html' as const

export interface LocalServiceUser {
  localpart: string
  displayName: string
  avatarUrl?: string
}

export type LocalServiceMessageContent =
  | {
      msgtype: 'm.text' | 'm.notice'
      body: string
      format?: typeof MATRIX_HTML_FORMAT
      formatted_body?: string
      'm.mentions'?: { user_ids: string[] }
    }
  | {
      msgtype: 'm.image'
      body: string
      url: string
      info: { mimetype: string; size: number; w: number; h: number }
    }
  | {
      msgtype: 'm.file'
      body: string
      url: string
      info: { mimetype: string; size: number }
    }
  | {
      msgtype: 'm.audio'
      body: string
      url: string
      info: { mimetype: string; size: number; duration: number }
    }
  | {
      msgtype: 'im.muon.contact_card'
      body: string
      'im.muon.contact_card': {
        user_id: string
        display_name: string
        avatar_url?: string
      }
    }

export interface LocalServiceMessage {
  sender: string
  content: LocalServiceMessageContent
  delayMs?: number
}

export interface LocalServiceDmRoom {
  key: string
  peer: string
  messages: LocalServiceMessage[]
}

export interface LocalServiceGroupRoom {
  key: string
  name: string
  topic?: string
  members: string[]
  messages: LocalServiceMessage[]
}

export interface LocalServiceChannel {
  key: string
  name: string
  topic?: string
  order?: string
  isVoice?: boolean
  members: string[]
  messages: LocalServiceMessage[]
}

export interface LocalServiceCategory {
  key: string
  name: string
  order?: string
  channels: LocalServiceChannel[]
}

export interface LocalServiceSpace {
  key: string
  name: string
  topic?: string
  members: string[]
  channels: LocalServiceChannel[]
  categories: LocalServiceCategory[]
}

export interface LocalServiceMockData {
  version: string
  serverName: string
  owner: LocalServiceUser
  users: LocalServiceUser[]
  profileUsers: LocalServiceUser[]
  dmRooms: LocalServiceDmRoom[]
  groupRooms: LocalServiceGroupRoom[]
  spaces: LocalServiceSpace[]
}

function userId(localpart: string, serverName = 'localhost'): string {
  return `@${localpart}:${serverName}`
}

function text(sender: string, body: string, delayMs?: number): LocalServiceMessage {
  return {
    sender,
    content: { msgtype: 'm.text', body },
    delayMs,
  }
}

function richText(
  sender: string,
  body: string,
  formattedBody: string,
  mentionLocalparts: string[] = [],
): LocalServiceMessage {
  return {
    sender,
    content: {
      msgtype: 'm.text',
      body,
      format: MATRIX_HTML_FORMAT,
      formatted_body: formattedBody,
      ...(mentionLocalparts.length
        ? { 'm.mentions': { user_ids: mentionLocalparts.map((localpart) => userId(localpart)) } }
        : {}),
    },
  }
}

function image(sender: string, body: string, mediaId: string, w: number, h: number): LocalServiceMessage {
  return {
    sender,
    content: {
      msgtype: 'm.image',
      body,
      url: `mxc://localhost/${mediaId}`,
      info: { mimetype: 'image/png', size: 256_000, w, h },
    },
  }
}

function file(sender: string, body: string, mediaId: string, mimetype: string, size: number): LocalServiceMessage {
  return {
    sender,
    content: {
      msgtype: 'm.file',
      body,
      url: `mxc://localhost/${mediaId}`,
      info: { mimetype, size },
    },
  }
}

function audio(sender: string, duration: number, mediaId: string): LocalServiceMessage {
  return {
    sender,
    content: {
      msgtype: 'm.audio',
      body: 'Voice message',
      url: `mxc://localhost/${mediaId}`,
      info: { mimetype: 'audio/ogg', size: 38_400, duration },
    },
  }
}

function contactCard(sender: string, localpart: string, displayName: string): LocalServiceMessage {
  return {
    sender,
    content: {
      msgtype: 'im.muon.contact_card',
      body: `[Contact] ${displayName}`,
      'im.muon.contact_card': {
        user_id: userId(localpart),
        display_name: displayName,
        avatar_url: `mxc://localhost/avatar_${localpart}`,
      },
    },
  }
}

const PROJECT_MEMBERS = ['xiaohong', 'xiaoming', 'xiaogang', 'xiaoli', 'xiaowei', 'muyang']
const SERVICE_MEMBERS = ['xiaohong', 'xiaoming', 'xiaogang', 'xiaoli', 'xiaowei', 'xiaofang', 'xiaojie', 'muyang']

export const LOCAL_SERVICE_MOCK_DATA: LocalServiceMockData = {
  version: '2026-04-30.2',
  serverName: 'localhost',
  owner: { localpart: 'kunish', displayName: 'Kunish', avatarUrl: 'mxc://localhost/avatar_kunish' },
  users: [
    { localpart: 'xiaohong', displayName: '小红', avatarUrl: 'mxc://localhost/avatar_xiaohong' },
    { localpart: 'xiaoming', displayName: '小明', avatarUrl: 'mxc://localhost/avatar_xiaoming' },
    { localpart: 'xiaogang', displayName: '小刚', avatarUrl: 'mxc://localhost/avatar_xiaogang' },
    { localpart: 'xiaoli', displayName: '小丽', avatarUrl: 'mxc://localhost/avatar_xiaoli' },
    { localpart: 'xiaowei', displayName: '小伟', avatarUrl: 'mxc://localhost/avatar_xiaowei' },
    { localpart: 'xiaofang', displayName: '小芳', avatarUrl: 'mxc://localhost/avatar_xiaofang' },
    { localpart: 'xiaojie', displayName: '小杰', avatarUrl: 'mxc://localhost/avatar_xiaojie' },
    { localpart: 'muyang', displayName: '牧阳', avatarUrl: 'mxc://localhost/avatar_muyang' },
  ],
  profileUsers: [
    { localpart: 'alice', displayName: 'Alice Wang', avatarUrl: 'mxc://localhost/avatar_alice' },
    { localpart: 'bob', displayName: 'Bob Li', avatarUrl: 'mxc://localhost/avatar_bob' },
    { localpart: 'charlie', displayName: 'Charlie Zhang', avatarUrl: 'mxc://localhost/avatar_charlie' },
    { localpart: 'diana', displayName: 'Diana Chen', avatarUrl: 'mxc://localhost/avatar_diana' },
    { localpart: 'eve', displayName: 'Eve Liu', avatarUrl: 'mxc://localhost/avatar_eve' },
  ],
  dmRooms: [
    {
      key: 'dm-xiaohong',
      peer: 'xiaohong',
      messages: [
        text('xiaohong', '在吗？有个事想问你'),
        text('kunish', '在的，怎么了？'),
        text('xiaohong', '明天下午有空吗？想约你一起去看展览'),
        text('kunish', '明天下午可以啊，几点？'),
        image('xiaohong', '展览海报.png', 'local_exhibit_poster', 1280, 720),
        text('xiaohong', '两点半在美术馆门口集合怎么样？'),
        text('kunish', '好的没问题 👍'),
        text('xiaohong', '到时候见！'),
      ],
    },
    {
      key: 'dm-xiaoming',
      peer: 'xiaoming',
      messages: [
        text('xiaoming', '新版本的代码你看了吗？'),
        text('kunish', '还没来得及，今天晚上看'),
        text('xiaoming', '里面有几个 bug 需要修一下'),
        file('xiaoming', 'bug_report.pdf', 'local_bug_report', 'application/pdf', 125_000),
        richText(
          'kunish',
          'Safari 的问题找到了，是 flex gap 的兼容性问题',
          '<p>Safari 的问题找到了，是 <code>flex gap</code> 的兼容性问题</p>',
        ),
        text('xiaoming', '收到，我测一下'),
        text('xiaoming', 'Safari 上没问题了 ✅'),
      ],
    },
    {
      key: 'dm-xiaogang',
      peer: 'xiaogang',
      messages: [
        text('xiaogang', '周末一起打球不？'),
        text('kunish', '羽毛球？'),
        text('xiaogang', '对，上次那个场地，周六下午三点'),
        text('kunish', '行，我带新拍子'),
        audio('xiaogang', 8_500, 'local_voice_court'),
      ],
    },
    {
      key: 'dm-xiaoli',
      peer: 'xiaoli',
      messages: [
        text('xiaoli', '设计稿看了，有几个页面交互想讨论一下'),
        text('kunish', '好的，主要是哪些页面？'),
        image('xiaoli', '聊天页标注.png', 'local_design_annotation', 1440, 1080),
        text('xiaoli', '主要是右键菜单、设置面板和输入框状态'),
        text('kunish', '我把交互状态补到本地数据里，方便你验收'),
      ],
    },
    {
      key: 'dm-xiaowei',
      peer: 'xiaowei',
      messages: [
        text('xiaowei', 'Vue 3 的 shallowRef 和 ref 有什么区别？'),
        richText(
          'kunish',
          'ref 会深度追踪，shallowRef 只追踪 .value 本身变化',
          '<p><code>ref</code> 会深度追踪，<code>shallowRef</code> 只追踪 <code>.value</code> 本身变化。</p>',
        ),
        text('xiaowei', '那大列表用 shallowRef 会更稳？'),
        text('kunish', '对，列表整体替换时触发更新，内部变化再手动控制'),
      ],
    },
  ],
  groupRooms: [
    {
      key: 'group-project',
      name: '项目讨论组',
      topic: 'Muon 项目日常讨论',
      members: ['xiaohong', 'xiaoming', 'xiaogang', 'xiaoli', 'xiaowei'],
      messages: [
        text('kunish', '大家早上好，今天站会推迟到 10 点'),
        text('xiaohong', '收到'),
        text('xiaoming', '收到 👌'),
        richText(
          'kunish',
          '@xiaoming 本地服务 mock 数据也需要覆盖消息列表、联系人和设置页入口',
          '<p><a href="https://matrix.to/#/@xiaoming:localhost">小明</a> 本地服务 mock 数据也需要覆盖消息列表、联系人和设置页入口</p>',
          ['xiaoming'],
        ),
        text('xiaoli', '我补一份设计验收场景清单'),
        text('xiaogang', '后端联调环境今天下午可用'),
      ],
    },
    {
      key: 'group-local-services',
      name: '本地服务联调',
      topic: 'Conduit / LiveKit / MinIO 本地联调',
      members: SERVICE_MEMBERS,
      messages: [
        text('xiaogang', 'Conduit 已经起来了，端口 6167'),
        text('muyang', 'LiveKit ws://localhost:7881 也正常'),
        text('kunish', 'MinIO bucket 已创建：muon-media'),
        file('xiaoming', 'local-service-checklist.md', 'local_service_checklist', 'text/markdown', 18_200),
        text('xiaohong', '我会用这组数据检查侧边栏和附件列表'),
      ],
    },
    {
      key: 'group-family',
      name: '家庭群',
      topic: '生活化聊天场景',
      members: ['xiaohong', 'xiaofang', 'xiaojie'],
      messages: [
        text('xiaofang', '周末谁来吃饭呀？'),
        text('kunish', '我来！'),
        text('xiaojie', '我带点水果过去'),
        image('xiaofang', '今天的菜.png', 'local_family_dinner', 1024, 768),
        text('xiaohong', '看起来好丰盛 😋'),
      ],
    },
  ],
  spaces: [
    {
      key: 'space-muon-product',
      name: 'Muon 产品研发',
      topic: '产品、设计、前端、客户端和发布协作',
      members: PROJECT_MEMBERS,
      channels: [
        {
          key: 'channel-announcements',
          name: '公告',
          topic: '项目公告和发布提醒',
          order: 'a',
          members: PROJECT_MEMBERS,
          messages: [
            richText(
              'kunish',
              '本地服务数据已升级：包含 DM、群聊、Space、分类、文本频道和语音频道',
              '<p><strong>本地服务数据已升级</strong>：包含 DM、群聊、Space、分类、文本频道和语音频道。</p>',
            ),
            text('xiaoli', '公告频道可以作为新会话列表的验收入口'),
          ],
        },
        {
          key: 'channel-daily-standup',
          name: '站会',
          topic: '每日同步',
          order: 'b',
          members: PROJECT_MEMBERS,
          messages: [
            text('xiaohong', '昨天完成联系人页空状态和列表态截图'),
            text('xiaoming', '今天处理消息列表滚动和富文本输入'),
            text('xiaogang', '我这边看本地服务 seed 是否稳定可重复运行'),
          ],
        },
        {
          key: 'voice-daily-room',
          name: '日常会议',
          topic: '站会和临时讨论',
          order: 'c',
          isVoice: true,
          members: PROJECT_MEMBERS,
          messages: [],
        },
      ],
      categories: [
        {
          key: 'category-development',
          name: '研发',
          order: 'd',
          channels: [
            {
              key: 'channel-frontend',
              name: '前端',
              topic: 'Vue / Electron 前端协作',
              order: 'a',
              members: PROJECT_MEMBERS,
              messages: [
                richText(
                  'xiaowei',
                  '@kunish 输入框 markdown 的 formatted_body 我用下面这条消息测',
                  '<p><a href="https://matrix.to/#/@kunish:localhost">Kunish</a> 输入框 <code>markdown</code> 的 <code>formatted_body</code> 我用下面这条消息测</p>',
                  ['kunish'],
                ),
                richText(
                  'kunish',
                  '测试点：粗体、代码块、链接、提及和换行',
                  '<p><strong>测试点</strong>：粗体、代码块、<a href="https://matrix.org">链接</a>、提及和换行。</p><pre><code>pnpm services:up</code></pre>',
                ),
              ],
            },
            {
              key: 'channel-client',
              name: '客户端',
              topic: 'Electron 桌面端集成',
              order: 'b',
              members: PROJECT_MEMBERS,
              messages: [
                text('xiaoming', 'Electron 窗口和通知权限本地要再测一次'),
                file('kunish', 'desktop-release-notes.pdf', 'local_desktop_release_notes', 'application/pdf', 82_000),
              ],
            },
            {
              key: 'channel-api-integration',
              name: '后端联调',
              topic: 'Matrix API 和本地服务联调',
              order: 'c',
              members: PROJECT_MEMBERS,
              messages: [
                text('xiaogang', 'createRoom / join / m.direct 都已经纳入 seed 流程'),
                text('kunish', '后面如果数据结构变化，只更新 seed version 即可重新灌数据'),
              ],
            },
          ],
        },
        {
          key: 'category-product-design',
          name: '产品设计',
          order: 'e',
          channels: [
            {
              key: 'channel-requirements',
              name: '需求评审',
              topic: '需求整理与验收点',
              order: 'a',
              members: PROJECT_MEMBERS,
              messages: [
                text('xiaohong', '本地服务场景需要覆盖未读、附件、富文本和名片'),
                contactCard('kunish', 'xiaoli', '小丽'),
              ],
            },
            {
              key: 'channel-design-review',
              name: '设计评审',
              topic: '视觉走查和交互确认',
              order: 'b',
              members: PROJECT_MEMBERS,
              messages: [
                image('xiaoli', '侧边栏走查.png', 'local_sidebar_review', 1280, 960),
                text('xiaoli', '这张图用于检查频道列表、hover 和选中态'),
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'space-local-services',
      name: '本地服务演示',
      topic: '用于验证 Conduit / LiveKit / MinIO 与 mock 数据',
      members: SERVICE_MEMBERS,
      channels: [
        {
          key: 'channel-service-status',
          name: '服务状态',
          topic: '本地服务启动和健康检查',
          order: 'a',
          members: SERVICE_MEMBERS,
          messages: [
            text('muyang', 'Conduit: http://localhost:6167'),
            text('muyang', 'LiveKit: ws://localhost:7881'),
            text('muyang', 'MinIO console: http://localhost:9001'),
          ],
        },
        {
          key: 'channel-mock-data',
          name: 'mock 数据',
          topic: '本地 seed 数据覆盖面',
          order: 'b',
          members: SERVICE_MEMBERS,
          messages: [
            richText(
              'kunish',
              '这组数据用于本地开发，不依赖线上 Matrix 账号',
              '<p>这组数据用于本地开发，不依赖线上 Matrix 账号。重复运行 <code>pnpm services:seed</code> 会根据 seed marker 跳过已灌数据。</p>',
            ),
            contactCard('xiaohong', 'muyang', '牧阳'),
          ],
        },
        {
          key: 'voice-debug-room',
          name: '语音调试',
          topic: 'LiveKit 本地语音调试',
          order: 'c',
          isVoice: true,
          members: SERVICE_MEMBERS,
          messages: [],
        },
      ],
      categories: [
        {
          key: 'category-qa-scenes',
          name: '验收场景',
          order: 'd',
          channels: [
            {
              key: 'channel-pagination',
              name: '分页与历史',
              topic: '长列表和历史消息加载',
              order: 'a',
              members: SERVICE_MEMBERS,
              messages: [
                text('xiaoming', '这个频道保留多段历史，用来检查滚动和分页'),
                text('kunish', '需要更多历史时，只补这个 channel 的 messages 即可'),
              ],
            },
            {
              key: 'channel-media-preview',
              name: '媒体预览',
              topic: '图片、文件、语音消息预览',
              order: 'b',
              members: SERVICE_MEMBERS,
              messages: [
                image('xiaofang', '媒体预览.png', 'local_media_preview', 1200, 800),
                file(
                  'xiaojie',
                  '验收记录.xlsx',
                  'local_acceptance_sheet',
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  42_000,
                ),
                audio('xiaogang', 6_200, 'local_voice_preview'),
              ],
            },
            {
              key: 'channel-mentions',
              name: '提及与名片',
              topic: 'mention、matrix.to 和联系人卡片',
              order: 'c',
              members: SERVICE_MEMBERS,
              messages: [
                richText(
                  'xiaoli',
                  '@xiaohong 帮忙看下联系人卡片的布局',
                  '<p><a href="https://matrix.to/#/@xiaohong:localhost">小红</a> 帮忙看下联系人卡片的布局</p>',
                  ['xiaohong'],
                ),
                contactCard('xiaoli', 'xiaohong', '小红'),
              ],
            },
          ],
        },
      ],
    },
  ],
}
