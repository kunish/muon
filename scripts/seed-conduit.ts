#!/usr/bin/env npx tsx
import process from 'node:process'
/**
 * Seed 脚本 — 在本地 Conduit 上创建测试用户、DM 房间、群聊房间并发送消息
 *
 * 用法:  npx tsx scripts/seed-conduit.ts
 *
 * 需要:
 *   - 本地 Conduit 运行在 http://127.0.0.1:6167
 *   - allow_registration = true
 *   - kunish 账号已存在
 */

const BASE_URL = 'http://127.0.0.1:6167'
const KUNISH_PASSWORD = 'Aa794613123.'
const TEST_USER_PASSWORD = 'test1234'

// ───────────────────────────── 用户定义 ─────────────────────────────
interface UserDef {
  localpart: string
  displayName: string
}

const TEST_USERS: UserDef[] = [
  { localpart: 'xiaohong', displayName: '小红' },
  { localpart: 'xiaoming', displayName: '小明' },
  { localpart: 'xiaogang', displayName: '小刚' },
  { localpart: 'xiaoli', displayName: '小丽' },
  { localpart: 'xiaowei', displayName: '小伟' },
  { localpart: 'xiaofang', displayName: '小芳' },
  { localpart: 'xiaojie', displayName: '小杰' },
]

// ───────────────────────────── 消息定义 ─────────────────────────────
// sender 用 localpart 或 'kunish' 表示
interface MsgDef {
  sender: string // localpart
  body: string
  delayMs?: number // 消息之间的延迟（默认 50ms）
}

interface DmRoomDef {
  peer: string // localpart of the other user
  messages: MsgDef[]
}

interface GroupRoomDef {
  name: string
  topic?: string
  members: string[] // localpart list (不含 kunish，他是创建者)
  messages: MsgDef[]
}

const DM_ROOMS: DmRoomDef[] = [
  {
    peer: 'xiaohong',
    messages: [
      { sender: 'xiaohong', body: '在吗？有个事想问你' },
      { sender: 'kunish', body: '在的，怎么了？' },
      { sender: 'xiaohong', body: '明天下午有空吗？想约你一起去看展览' },
      { sender: 'kunish', body: '明天下午可以啊，几点？' },
      { sender: 'xiaohong', body: '两点半在美术馆门口集合怎么样？' },
      { sender: 'kunish', body: '好的没问题 👍' },
      { sender: 'xiaohong', body: '就是这个展，看起来很不错吧' },
      { sender: 'kunish', body: '哇，这个看起来很有意思！我很期待' },
      { sender: 'xiaohong', body: '对了，要不要叫上小明一起？' },
      { sender: 'kunish', body: '可以呀，你问问他' },
      { sender: 'xiaohong', body: '好，我问一下他' },
      { sender: 'xiaohong', body: '小明说他明天有事去不了 😅' },
      { sender: 'kunish', body: '那就咱俩去吧' },
      { sender: 'xiaohong', body: '嗯嗯，到时候见！' },
      { sender: 'xiaohong', body: '我到啦，你到哪了？' },
      { sender: 'kunish', body: '马上到，还有两分钟' },
      { sender: 'kunish', body: '到了到了，在入口处' },
      { sender: 'xiaohong', body: '看到你了！' },
      { sender: 'xiaohong', body: '今天的展好棒啊！' },
      { sender: 'kunish', body: '拍了好多照片哈哈' },
      { sender: 'xiaohong', body: '对对对，我也拍了好多，等下发你' },
      { sender: 'kunish', body: '这两张拍得真好！' },
      { sender: 'xiaohong', body: '谢谢 😊 下次再一起出去玩' },
      { sender: 'kunish', body: '好呀，随时约' },
    ],
  },
  {
    peer: 'xiaoming',
    messages: [
      { sender: 'xiaoming', body: '兄弟，新版本的代码你看了吗？' },
      { sender: 'kunish', body: '还没来得及，今天晚上看' },
      { sender: 'xiaoming', body: '好的，里面有几个 bug 需要修一下' },
      { sender: 'kunish', body: '什么 bug？' },
      { sender: 'xiaoming', body: '登录页面在 Safari 上样式有问题，还有一个数据请求的竞态条件' },
      { sender: 'kunish', body: '了解，我先处理 Safari 的问题' },
      { sender: 'xiaoming', body: '这是详细的 bug 报告，你看看' },
      { sender: 'kunish', body: '收到，我看一下' },
      { sender: 'kunish', body: 'Safari 的问题找到了，是 flex gap 的兼容性问题' },
      { sender: 'xiaoming', body: '果然，Safari 老毛病了' },
      { sender: 'kunish', body: '已经修好了，你帮我测一下' },
      { sender: 'xiaoming', body: '好，我测一下' },
      { sender: 'xiaoming', body: 'Safari 上没问题了 ✅' },
      { sender: 'kunish', body: '太好了，竞态条件我明天处理' },
      { sender: 'xiaoming', body: '不着急，这个周末前搞定就行' },
      { sender: 'kunish', body: '收到，周末前一定搞定' },
      { sender: 'xiaoming', body: '竞态条件的 bug 你搞定了吗？' },
      { sender: 'kunish', body: '搞定了，用 AbortController 解决的' },
      { sender: 'xiaoming', body: '代码发我看看？' },
      { sender: 'kunish', body: '```\nconst controller = new AbortController()\nfetch(url, { signal: controller.signal })\n```' },
      { sender: 'xiaoming', body: '不错不错，这个方案简洁' },
    ],
  },
  {
    peer: 'xiaogang',
    messages: [
      { sender: 'xiaogang', body: '哥，周末一起打球不？' },
      { sender: 'kunish', body: '什么球？' },
      { sender: 'xiaogang', body: '羽毛球呗，上次那个场地' },
      { sender: 'kunish', body: '行啊，周六下午怎么样？' },
      { sender: 'xiaogang', body: '周六下午三点，我去订场地' },
      { sender: 'kunish', body: '好的 💪' },
      { sender: 'xiaogang', body: '场地订好了，3号场' },
      { sender: 'kunish', body: '收到' },
      { sender: 'xiaogang', body: '对了，带上你那个新拍子' },
      { sender: 'kunish', body: '没问题' },
      { sender: 'xiaogang', body: '🏸' },
      { sender: 'xiaogang', body: '到了说一声' },
      { sender: 'kunish', body: '快了快了，堵车 🚗' },
      { sender: 'xiaogang', body: '哈哈哈行，我先热身' },
      { sender: 'kunish', body: '到了！' },
    ],
  },
  {
    peer: 'xiaoli',
    messages: [
      { sender: 'xiaoli', body: '请问这个项目的设计稿在哪里可以看？' },
      { sender: 'kunish', body: '在 Figma 上，我把链接发给你' },
      { sender: 'kunish', body: 'https://figma.com/file/xxx/muon-design' },
      { sender: 'xiaoli', body: '收到，谢谢！' },
      { sender: 'xiaoli', body: '设计稿看了，有几个页面的交互想和你讨论一下' },
      { sender: 'kunish', body: '好的，具体是哪些？' },
      { sender: 'xiaoli', body: '主要是聊天页面的右键菜单和设置面板的动画' },
      { sender: 'kunish', body: '明白了，右键菜单我可以加个弹出动画' },
      { sender: 'xiaoli', body: '嗯嗯，可以参考 Telegram 的效果' },
    ],
  },
  {
    peer: 'xiaowei',
    messages: [
      { sender: 'xiaowei', body: '大佬，问个技术问题' },
      { sender: 'kunish', body: '你说' },
      { sender: 'xiaowei', body: 'Vue 3 的 shallowRef 和 ref 有什么区别？' },
      { sender: 'kunish', body: 'ref 会深度追踪响应性，shallowRef 只追踪 .value 本身的变化。如果你放的是大数组或复杂对象，用 shallowRef 性能更好' },
      { sender: 'xiaowei', body: '懂了，那我列表数据应该用 shallowRef？' },
      { sender: 'kunish', body: '对，替换整个数组触发更新，内部变化用 triggerRef' },
      { sender: 'xiaowei', body: '太有帮助了，谢谢大佬！' },
    ],
  },
]

const GROUP_ROOMS: GroupRoomDef[] = [
  {
    name: '项目讨论组',
    topic: 'Muon 项目日常讨论',
    members: ['xiaohong', 'xiaoming', 'xiaogang', 'xiaoli'],
    messages: [
      { sender: 'kunish', body: '大家早上好，今天的站会推迟到 10 点' },
      { sender: 'xiaohong', body: '好的收到' },
      { sender: 'xiaoming', body: '收到 👌' },
      { sender: 'xiaogang', body: 'OK' },
      { sender: 'xiaoli', body: '好的' },
      { sender: 'kunish', body: '站会开始，大家依次说一下昨天的进度' },
      { sender: 'xiaohong', body: '我昨天完成了用户资料页的样式调整' },
      { sender: 'xiaoming', body: '我修了两个前端 bug，还在处理第三个' },
      { sender: 'xiaogang', body: '后端 API 已经部署到测试环境了' },
      { sender: 'xiaoli', body: '设计稿已经更新到最新版本' },
      { sender: 'kunish', body: '很好，进度不错。今天的重点是准备下周的 demo' },
      { sender: 'xiaohong', body: '需要我准备哪些页面的截图？' },
      { sender: 'kunish', body: '主要是聊天页面、联系人页面、设置页面这三个' },
      { sender: 'xiaohong', body: '好的，下班前发出来' },
      { sender: 'xiaoming', body: '性能优化的数据我也整理一下' },
      { sender: 'kunish', body: '那今天就这样，大家加油 💪' },
      { sender: 'xiaoming', body: '@kunish 消息列表的虚拟滚动要不要加？数据量大的时候有卡顿' },
      { sender: 'kunish', body: '先不加，等遇到实际性能问题再说。过早优化是万恶之源' },
      { sender: 'xiaogang', body: '赞同，先保证功能正确' },
      { sender: 'xiaohong', body: '页面截图好了，发在这里大家看看' },
      { sender: 'kunish', body: '截图很完美，辛苦了！' },
      { sender: 'xiaoli', body: '小红做的截图真好看 ✨' },
    ],
  },
  {
    name: '家庭群',
    topic: '家人们的日常',
    members: ['xiaohong', 'xiaofang', 'xiaojie'],
    messages: [
      { sender: 'xiaofang', body: '周末谁来吃饭呀？' },
      { sender: 'kunish', body: '我来！' },
      { sender: 'xiaojie', body: '我也来，带点水果过去' },
      { sender: 'xiaohong', body: '算我一个～' },
      { sender: 'xiaofang', body: '太好了，那我准备四个人的菜' },
      { sender: 'xiaofang', body: '想吃什么？提前说，我好买菜' },
      { sender: 'kunish', body: '红烧肉！' },
      { sender: 'xiaojie', body: '鱼香茄子 🍆' },
      { sender: 'xiaohong', body: '西红柿炒蛋就行 😋' },
      { sender: 'xiaofang', body: '好的好的，都记下了' },
      { sender: 'xiaofang', body: '菜买好了！' },
      { sender: 'kunish', body: '看起来好丰盛' },
      { sender: 'xiaojie', body: '我买了西瓜和葡萄，一会到' },
      { sender: 'xiaofang', body: '快来吧，已经开始做了' },
    ],
  },
  {
    name: '技术交流群',
    topic: '技术分享与讨论',
    members: ['xiaoming', 'xiaogang', 'xiaowei', 'xiaofang', 'xiaojie'],
    messages: [
      { sender: 'xiaoming', body: '有人用过 Tauri 2.0 吗？' },
      { sender: 'kunish', body: '我正在用，有什么问题？' },
      { sender: 'xiaowei', body: '我也在研究' },
      { sender: 'xiaoming', body: '跨平台打包的时候遇到点问题' },
      { sender: 'kunish', body: '什么问题？贴一下错误日志' },
      { sender: 'xiaoming', body: '```\nerror[E0433]: failed to resolve: use of undeclared crate\n```' },
      { sender: 'kunish', body: '这个是 Rust 依赖没装好，检查一下 Cargo.toml' },
      { sender: 'xiaoming', body: '果然，少了一个 dependency，加上就好了' },
      { sender: 'xiaowei', body: 'Tauri 2 比 Electron 快多了，二进制文件才 8MB' },
      { sender: 'kunish', body: '是的，而且内存占用也小很多' },
      { sender: 'xiaogang', body: '有没有人测过 Tauri 的 IPC 性能？' },
      { sender: 'kunish', body: '我测过，JSON 序列化大概 0.1ms，比 Electron 的 IPC 快 3 倍左右' },
      { sender: 'xiaogang', body: '这么快？有 benchmark 数据吗？' },
      { sender: 'kunish', body: '有的，我整理一下发出来' },
      { sender: 'xiaogang', body: '太棒了，这个数据正好写技术报告用' },
      { sender: 'xiaofang', body: '推荐一个好用的 VS Code 插件：Tauri 官方的那个' },
      { sender: 'xiaowei', body: '已经装了，自动补全确实方便' },
      { sender: 'xiaoming', body: '感谢推荐，装上了 👍' },
      { sender: 'xiaojie', body: '大家有没有研究过 WebView2 的限制？' },
      { sender: 'kunish', body: '主要是 Windows 上的 WebView2 版本问题，但 Tauri 2 做了很好的兼容' },
    ],
  },
]

// ───────────────────────────── HTTP 工具 ─────────────────────────────

async function matrixFetch(
  path: string,
  opts: { method?: string, body?: any, token?: string } = {},
): Promise<any> {
  const { method = 'GET', body, token } = opts
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token)
    headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok && json.errcode) {
    // 不抛错，让调用方决定
    return { _error: true, ...json }
  }
  return json
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ───────────────────────────── 主流程 ─────────────────────────────

async function main() {
  console.log('=== Muon Conduit Seed 脚本 ===\n')

  // 1. 登录 kunish
  console.log('1. 登录 kunish...')
  const kunishLogin = await matrixFetch('/_matrix/client/v3/login', {
    method: 'POST',
    body: {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: 'kunish' },
      password: KUNISH_PASSWORD,
    },
  })
  if (kunishLogin._error) {
    console.error('   kunish 登录失败:', kunishLogin)
    process.exit(1)
  }
  const kunishToken = kunishLogin.access_token
  const kunishUserId = kunishLogin.user_id
  console.log(`   ✓ kunish 登录成功: ${kunishUserId}\n`)

  // 2. 注册测试用户
  console.log('2. 注册测试用户...')
  const userTokens: Record<string, string> = { kunish: kunishToken }
  const userIds: Record<string, string> = { kunish: kunishUserId }

  for (const u of TEST_USERS) {
    const regResult = await matrixFetch('/_matrix/client/v3/register', {
      method: 'POST',
      body: {
        auth: { type: 'm.login.dummy' },
        username: u.localpart,
        password: TEST_USER_PASSWORD,
      },
    })

    if (regResult._error) {
      if (regResult.errcode === 'M_USER_IN_USE') {
        console.log(`   ⦿ ${u.localpart} 已存在，尝试登录...`)
        const loginRes = await matrixFetch('/_matrix/client/v3/login', {
          method: 'POST',
          body: {
            type: 'm.login.password',
            identifier: { type: 'm.id.user', user: u.localpart },
            password: TEST_USER_PASSWORD,
          },
        })
        if (loginRes._error) {
          console.error(`   ✗ ${u.localpart} 登录失败:`, loginRes)
          continue
        }
        userTokens[u.localpart] = loginRes.access_token
        userIds[u.localpart] = loginRes.user_id
      }
      else {
        console.error(`   ✗ ${u.localpart} 注册失败:`, regResult)
        continue
      }
    }
    else {
      userTokens[u.localpart] = regResult.access_token
      userIds[u.localpart] = regResult.user_id
      console.log(`   ✓ ${u.localpart} 注册成功: ${regResult.user_id}`)
    }

    // 设置显示名
    await matrixFetch(`/_matrix/client/v3/profile/${userIds[u.localpart]}/displayname`, {
      method: 'PUT',
      token: userTokens[u.localpart],
      body: { displayname: u.displayName },
    })
    console.log(`   ✓ ${u.localpart} 显示名设置为 "${u.displayName}"`)
  }
  console.log()

  // 3. 创建 DM 房间
  console.log('3. 创建 DM 房间...')
  const dmRoomIds: Record<string, string> = {}

  for (const dm of DM_ROOMS) {
    if (!userIds[dm.peer]) {
      console.error(`   ✗ 跳过 DM ${dm.peer}: 用户未注册成功`)
      continue
    }

    // kunish 创建 DM 房间并邀请对方
    const createRes = await matrixFetch('/_matrix/client/v3/createRoom', {
      method: 'POST',
      token: kunishToken,
      body: {
        is_direct: true,
        invite: [userIds[dm.peer]],
        preset: 'trusted_private_chat',
      },
    })
    if (createRes._error) {
      console.error(`   ✗ 创建 DM ${dm.peer} 失败:`, createRes)
      continue
    }
    const roomId = createRes.room_id
    dmRoomIds[dm.peer] = roomId
    console.log(`   ✓ DM ${dm.peer}: ${roomId}`)

    // 对方加入房间
    const peerToken = userTokens[dm.peer]
    const joinRes = await matrixFetch(`/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {
      method: 'POST',
      token: peerToken,
      body: {},
    })
    if (joinRes._error) {
      console.error(`     ✗ ${dm.peer} 加入失败:`, joinRes)
    }
    else {
      console.log(`     ✓ ${dm.peer} 已加入`)
    }

    // 设置 m.direct account data (kunish 端)
    // 先读取现有的
    const existingDirect = await matrixFetch(
      `/_matrix/client/v3/user/${encodeURIComponent(kunishUserId)}/account_data/m.direct`,
      { token: kunishToken },
    )
    const directContent = existingDirect._error ? {} : existingDirect
    const peerId = userIds[dm.peer]
    if (!directContent[peerId])
      directContent[peerId] = []
    if (!directContent[peerId].includes(roomId))
      directContent[peerId].push(roomId)
    await matrixFetch(
      `/_matrix/client/v3/user/${encodeURIComponent(kunishUserId)}/account_data/m.direct`,
      { method: 'PUT', token: kunishToken, body: directContent },
    )

    // 发送消息
    let txnId = 0
    for (const msg of dm.messages) {
      const senderToken = msg.sender === 'kunish' ? kunishToken : userTokens[msg.sender]
      if (!senderToken)
        continue

      await matrixFetch(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId++}`,
        {
          method: 'PUT',
          token: senderToken,
          body: { msgtype: 'm.text', body: msg.body },
        },
      )
      await sleep(30) // 避免过快发送
    }
    console.log(`     ✓ 发送了 ${dm.messages.length} 条消息`)
  }
  console.log()

  // 4. 创建群聊房间
  console.log('4. 创建群聊房间...')

  for (const group of GROUP_ROOMS) {
    const inviteIds = group.members
      .map(m => userIds[m])
      .filter(Boolean)

    const createRes = await matrixFetch('/_matrix/client/v3/createRoom', {
      method: 'POST',
      token: kunishToken,
      body: {
        name: group.name,
        topic: group.topic || '',
        invite: inviteIds,
        preset: 'private_chat',
      },
    })
    if (createRes._error) {
      console.error(`   ✗ 创建群 "${group.name}" 失败:`, createRes)
      continue
    }
    const roomId = createRes.room_id
    console.log(`   ✓ 群 "${group.name}": ${roomId}`)

    // 成员加入
    for (const member of group.members) {
      const memberToken = userTokens[member]
      if (!memberToken)
        continue
      const joinRes = await matrixFetch(
        `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`,
        { method: 'POST', token: memberToken, body: {} },
      )
      if (joinRes._error) {
        console.error(`     ✗ ${member} 加入失败:`, joinRes)
      }
    }
    console.log(`     ✓ ${group.members.length} 位成员已加入`)

    // 发送消息
    let txnId = 0
    for (const msg of group.messages) {
      const senderToken = msg.sender === 'kunish' ? kunishToken : userTokens[msg.sender]
      if (!senderToken)
        continue

      await matrixFetch(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId++}`,
        {
          method: 'PUT',
          token: senderToken,
          body: { msgtype: 'm.text', body: msg.body },
        },
      )
      await sleep(30)
    }
    console.log(`     ✓ 发送了 ${group.messages.length} 条消息`)
  }

  console.log('\n=== Seed 完成! ===')
  console.log(`\n用户密码统一为: ${TEST_USER_PASSWORD}`)
  console.log('kunish 账号可以在 Muon 中登录查看所有对话\n')
}

main().catch((e) => {
  console.error('脚本执行出错:', e)
  process.exit(1)
})
