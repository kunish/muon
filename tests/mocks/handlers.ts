import { http, HttpResponse } from 'msw'
import { ALL_ROOMS, M_DIRECT_CONTENT, SELF_USER_ID, USERS } from './data'

const BASE = 'https://matrix.localhost/_matrix'

// ---------------------------------------------------------------------------
// 构建 /sync 响应中的 rooms.join 数据
// ---------------------------------------------------------------------------
function buildSyncJoinRooms() {
  const join: Record<string, any> = {}

  for (const room of ALL_ROOMS) {
    // timeline events
    const timelineEvents = room.events.map(evt => ({
      type: evt.type,
      event_id: evt.eventId,
      sender: evt.sender,
      origin_server_ts: evt.ts,
      content: evt.content,
    }))

    // state events
    const stateEvents = [
      {
        type: 'm.room.create',
        event_id: `$create_${room.roomId}`,
        sender: SELF_USER_ID,
        origin_server_ts: room.events[0]?.ts ?? Date.now(),
        state_key: '',
        content: { room_version: '10', creator: SELF_USER_ID },
      },
      {
        type: 'm.room.name',
        event_id: `$name_${room.roomId}`,
        sender: SELF_USER_ID,
        origin_server_ts: room.events[0]?.ts ?? Date.now(),
        state_key: '',
        content: { name: room.name },
      },
      // join_rules
      {
        type: 'm.room.join_rules',
        event_id: `$joinrules_${room.roomId}`,
        sender: SELF_USER_ID,
        origin_server_ts: room.events[0]?.ts ?? Date.now(),
        state_key: '',
        content: { join_rule: room.isDirect ? 'invite' : 'public' },
      },
      // 成员事件
      ...room.members.map(userId => ({
        type: 'm.room.member',
        event_id: `$member_${room.roomId}_${userId}`,
        sender: userId,
        origin_server_ts: room.events[0]?.ts ?? Date.now(),
        state_key: userId,
        content: {
          membership: 'join',
          displayname: USERS[userId]?.displayName ?? userId,
          avatar_url: USERS[userId]?.avatarUrl ?? null,
        },
      })),
    ]

    join[room.roomId] = {
      timeline: { events: timelineEvents, limited: false, prev_batch: `batch_${room.roomId}` },
      state: { events: stateEvents },
      account_data: { events: [] },
      ephemeral: { events: [] },
      unread_notifications: {
        notification_count: room.roomId === '!dm_alice:localhost' ? 3 : room.roomId === '!group_project:localhost' ? 5 : 0,
        highlight_count: 0,
      },
    }
  }

  return join
}

// ---------------------------------------------------------------------------
// 构建 presence 数据
// ---------------------------------------------------------------------------
function buildPresenceEvents() {
  return Object.values(USERS)
    .filter(u => u.userId !== SELF_USER_ID)
    .map(u => ({
      type: 'm.presence',
      sender: u.userId,
      content: {
        presence: u.presence,
        currently_active: u.presence === 'online',
        last_active_ago: u.presence === 'online' ? 0 : 3600000,
        displayname: u.displayName,
        avatar_url: u.avatarUrl ?? null,
      },
    }))
}

// ---------------------------------------------------------------------------
// MSW Handlers
// ---------------------------------------------------------------------------
export const handlers = [
  // ---- 登录 ----
  http.post(`${BASE}/client/v3/login`, () => {
    return HttpResponse.json({
      access_token: 'mock_token',
      user_id: SELF_USER_ID,
      device_id: 'MOCK_DEVICE',
    })
  }),

  // ---- 注册 ----
  http.post(`${BASE}/client/v3/register`, () => {
    return HttpResponse.json({
      access_token: 'mock_token',
      user_id: SELF_USER_ID,
      device_id: 'MOCK_DEVICE',
    })
  }),

  // ---- 同步（含完整房间、消息和在线状态） ----
  http.get(`${BASE}/client/v3/sync`, () => {
    return HttpResponse.json({
      next_batch: 'mock_batch_1',
      rooms: {
        join: buildSyncJoinRooms(),
        invite: {},
        leave: {},
      },
      presence: { events: buildPresenceEvents() },
      account_data: {
        events: [
          { type: 'm.direct', content: M_DIRECT_CONTENT },
        ],
      },
    })
  }),

  // ---- 发送消息 ----
  http.put(`${BASE}/client/v3/rooms/:roomId/send/:eventType/:txnId`, () => {
    return HttpResponse.json({ event_id: `$${Date.now()}` })
  }),

  // ---- 发送状态事件 ----
  http.put(`${BASE}/client/v3/rooms/:roomId/state/:eventType/:stateKey`, () => {
    return HttpResponse.json({ event_id: `$state_${Date.now()}` })
  }),
  http.put(`${BASE}/client/v3/rooms/:roomId/state/:eventType`, () => {
    return HttpResponse.json({ event_id: `$state_${Date.now()}` })
  }),

  // ---- 上传媒体 ----
  http.post(`${BASE}/media/v3/upload`, () => {
    return HttpResponse.json({ content_uri: 'mxc://localhost/mock_media' })
  }),

  // ---- 媒体下载（返回空图片） ----
  http.get(`${BASE}/media/v3/download/:serverName/:mediaId`, () => {
    return new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
      headers: { 'Content-Type': 'image/png' },
    })
  }),

  // ---- 缩略图 ----
  http.get(`${BASE}/media/v3/thumbnail/:serverName/:mediaId`, () => {
    return new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
      headers: { 'Content-Type': 'image/png' },
    })
  }),

  // ---- 用户搜索（返回全部非自身用户） ----
  http.post(`${BASE}/client/v3/user_directory/search`, async ({ request }) => {
    const body = await request.json() as { search_term?: string }
    const term = (body.search_term ?? '').toLowerCase()

    const results = Object.values(USERS)
      .filter(u => u.userId !== SELF_USER_ID)
      .filter(u =>
        !term
        || u.displayName.toLowerCase().includes(term)
        || u.userId.toLowerCase().includes(term),
      )
      .map(u => ({
        user_id: u.userId,
        display_name: u.displayName,
        avatar_url: u.avatarUrl ?? null,
      }))

    return HttpResponse.json({ results, limited: false })
  }),

  // ---- 用户 Profile ----
  http.get(`${BASE}/client/v3/profile/:userId`, ({ params }) => {
    const userId = params.userId as string
    const user = USERS[userId]
    if (!user) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json({
      displayname: user.displayName,
      avatar_url: user.avatarUrl ?? null,
    })
  }),

  // ---- 创建房间 ----
  http.post(`${BASE}/client/v3/createRoom`, () => {
    return HttpResponse.json({ room_id: `!new_${Date.now()}:localhost` })
  }),

  // ---- 加入房间 ----
  http.post(`${BASE}/client/v3/join/:roomId`, ({ params }) => {
    return HttpResponse.json({ room_id: params.roomId })
  }),

  // ---- 离开房间 ----
  http.post(`${BASE}/client/v3/rooms/:roomId/leave`, () => {
    return HttpResponse.json({})
  }),

  // ---- 邀请 ----
  http.post(`${BASE}/client/v3/rooms/:roomId/invite`, () => {
    return HttpResponse.json({})
  }),

  // ---- 踢人 ----
  http.post(`${BASE}/client/v3/rooms/:roomId/kick`, () => {
    return HttpResponse.json({})
  }),

  // ---- 消息分页（向前加载历史） ----
  http.get(`${BASE}/client/v3/rooms/:roomId/messages`, ({ params }) => {
    const roomId = params.roomId as string
    const room = ALL_ROOMS.find(r => r.roomId === roomId)
    if (!room) {
      return HttpResponse.json({ chunk: [], start: '', end: '' })
    }
    const chunk = room.events.map(evt => ({
      type: evt.type,
      event_id: evt.eventId,
      sender: evt.sender,
      origin_server_ts: evt.ts,
      content: evt.content,
    }))
    return HttpResponse.json({ chunk, start: 'start_token', end: '' })
  }),

  // ---- 已读回执 ----
  http.post(`${BASE}/client/v3/rooms/:roomId/receipt/:receiptType/:eventId`, () => {
    return HttpResponse.json({})
  }),

  // ---- Room Tags ----
  http.put(`${BASE}/client/v3/user/:userId/rooms/:roomId/tags/:tag`, () => {
    return HttpResponse.json({})
  }),
  http.delete(`${BASE}/client/v3/user/:userId/rooms/:roomId/tags/:tag`, () => {
    return HttpResponse.json({})
  }),

  // ---- Push Rules ----
  http.put(`${BASE}/client/v3/pushrules/:scope/:kind/:ruleId`, () => {
    return HttpResponse.json({})
  }),
  http.delete(`${BASE}/client/v3/pushrules/:scope/:kind/:ruleId`, () => {
    return HttpResponse.json({})
  }),

  // ---- Account Data ----
  http.put(`${BASE}/client/v3/user/:userId/account_data/:type`, () => {
    return HttpResponse.json({})
  }),

  // ---- Presence ----
  http.put(`${BASE}/client/v3/presence/:userId/status`, () => {
    return HttpResponse.json({})
  }),
  http.get(`${BASE}/client/v3/presence/:userId/status`, ({ params }) => {
    const userId = params.userId as string
    const user = USERS[userId]
    return HttpResponse.json({
      presence: user?.presence ?? 'offline',
      currently_active: user?.presence === 'online',
      last_active_ago: user?.presence === 'online' ? 0 : 3600000,
    })
  }),
]
