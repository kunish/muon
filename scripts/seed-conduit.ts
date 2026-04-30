#!/usr/bin/env npx tsx
import type { LocalServiceChannel, LocalServiceMessage, LocalServiceSpace } from '../src/shared/data/localServiceMock'
import process from 'node:process'
import { LOCAL_SERVICE_MOCK_DATA } from '../src/shared/data/localServiceMock'

const BASE_URL = process.env.MUON_SEED_BASE_URL ?? 'http://127.0.0.1:6167'
const DEFAULT_USER_PASSWORD = process.env.MUON_SEED_USER_PASSWORD ?? process.env.MUON_SEED_PASSWORD ?? 'test1234'
const OWNER_PASSWORD_CANDIDATES = unique([
  process.env.MUON_SEED_OWNER_PASSWORD,
  process.env.MUON_SEED_PASSWORD,
  'test1234',
  // Older local setups used this password for @kunish:localhost.
  'Aa794613123.',
])
const OWNER_REGISTRATION_PASSWORD = OWNER_PASSWORD_CANDIDATES[0] ?? 'test1234'
const SEED_ACCOUNT_DATA_TYPE = 'im.muon.local_seed'
const MESSAGE_DELAY_MS = Number(process.env.MUON_SEED_MESSAGE_DELAY_MS ?? 20)
const FORCE_SEED = process.argv.includes('--force') || process.env.MUON_SEED_FORCE === '1'

interface MatrixErrorResponse {
  _error: true
  _status: number
  errcode?: string
  error?: string
  [key: string]: unknown
}

interface MatrixFetchOptions {
  method?: string
  body?: unknown
  token?: string
}

interface SeededUser {
  localpart: string
  userId: string
  token: string
  displayName: string
  password: string
}

interface SeedMarker {
  version: string
  serverName: string
  ownerUserId: string
  seededAt: string
  avatars: Record<string, string>
  rooms: Record<string, string>
  spaces: Record<string, string>
  categories: Record<string, string>
  channels: Record<string, string>
}

interface InitialStateEvent {
  type: string
  state_key?: string
  content: Record<string, unknown>
}

interface CreateRoomBody {
  name?: string
  topic?: string
  invite?: string[]
  is_direct?: boolean
  preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat'
  creation_content?: Record<string, unknown>
  initial_state?: InitialStateEvent[]
  power_level_content_override?: Record<string, unknown>
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMatrixError(value: unknown): value is MatrixErrorResponse {
  return isRecord(value) && value._error === true
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function createEmptyMarker(ownerUserId: string): SeedMarker {
  return {
    version: LOCAL_SERVICE_MOCK_DATA.version,
    serverName: LOCAL_SERVICE_MOCK_DATA.serverName,
    ownerUserId,
    seededAt: new Date().toISOString(),
    avatars: {},
    rooms: {},
    spaces: {},
    categories: {},
    channels: {},
  }
}

function isCurrentSeedMarker(value: unknown): value is SeedMarker {
  return isRecord(value)
    && value.version === LOCAL_SERVICE_MOCK_DATA.version
    && value.serverName === LOCAL_SERVICE_MOCK_DATA.serverName
}

function normalizeSeedMarker(marker: SeedMarker): SeedMarker {
  marker.avatars ??= {}
  marker.rooms ??= {}
  marker.spaces ??= {}
  marker.categories ??= {}
  marker.channels ??= {}
  return marker
}

function expectedSeedKeys() {
  const rooms = [
    ...LOCAL_SERVICE_MOCK_DATA.dmRooms.map(room => room.key),
    ...LOCAL_SERVICE_MOCK_DATA.groupRooms.map(room => room.key),
  ]
  const spaces = LOCAL_SERVICE_MOCK_DATA.spaces.map(space => space.key)
  const categories = LOCAL_SERVICE_MOCK_DATA.spaces.flatMap(space => space.categories.map(category => category.key))
  const channels = LOCAL_SERVICE_MOCK_DATA.spaces.flatMap(space => [
    ...space.channels.map(channel => channel.key),
    ...space.categories.flatMap(category => category.channels.map(channel => channel.key)),
  ])
  const avatars = [
    LOCAL_SERVICE_MOCK_DATA.owner.localpart,
    ...LOCAL_SERVICE_MOCK_DATA.users.map(user => user.localpart),
    ...LOCAL_SERVICE_MOCK_DATA.profileUsers.map(user => user.localpart),
  ]

  return { avatars, rooms, spaces, categories, channels }
}

function isCompleteSeedMarker(marker: SeedMarker): boolean {
  const expected = expectedSeedKeys()
  return expected.avatars.every(key => !!marker.avatars[key])
    && expected.rooms.every(key => !!marker.rooms[key])
    && expected.spaces.every(key => !!marker.spaces[key])
    && expected.categories.every(key => !!marker.categories[key])
    && expected.channels.every(key => !!marker.channels[key])
}

async function matrixFetch<T extends Record<string, unknown> = Record<string, unknown>>(
  path: string,
  opts: MatrixFetchOptions = {},
): Promise<T | MatrixErrorResponse> {
  const { method = 'GET', body, token } = opts
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token)
    headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let payload: unknown = {}
  if (text) {
    try {
      payload = JSON.parse(text)
    }
    catch {
      payload = { error: text }
    }
  }

  const json = isRecord(payload) ? payload : { value: payload }
  if (!res.ok) {
    return {
      _error: true,
      _status: res.status,
      ...json,
    }
  }
  return json as T
}

async function uploadAvatarMedia(user: SeededUser): Promise<string | null> {
  const svg = createAvatarSvg(user)
  const res = await fetch(
    `${BASE_URL}/_matrix/media/v3/upload?filename=${encodeURIComponent(`${user.localpart}-avatar.svg`)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'image/svg+xml',
        'Authorization': `Bearer ${user.token}`,
      },
      body: svg,
    },
  )
  const text = await res.text()
  let payload: unknown = {}
  if (text) {
    try {
      payload = JSON.parse(text)
    }
    catch {
      payload = { error: text }
    }
  }

  if (!res.ok || !isRecord(payload) || typeof payload.content_uri !== 'string') {
    console.error(`  WARN upload avatar ${user.localpart} failed:`, payload)
    return null
  }

  return payload.content_uri
}

function createAvatarSvg(user: SeededUser): string {
  const hue = hashHue(user.userId)
  const label = escapeXml((user.displayName || user.localpart).slice(0, 2).toUpperCase())
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">',
    '<defs>',
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue} 72% 58%)"/><stop offset="100%" stop-color="hsl(${(hue + 42) % 360} 70% 42%)"/></linearGradient>`,
    '</defs>',
    '<rect width="128" height="128" rx="64" fill="url(#g)"/>',
    '<circle cx="94" cy="32" r="22" fill="rgba(255,255,255,0.18)"/>',
    '<circle cx="32" cy="100" r="28" fill="rgba(0,0,0,0.08)"/>',
    `<text x="64" y="76" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#fff">${label}</text>`,
    '</svg>',
  ].join('')
}

function hashHue(value: string): number {
  let hash = 0
  for (const ch of value)
    hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return Math.abs(hash) % 360
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

async function loginWithPassword(localpart: string, password: string): Promise<SeededUser | MatrixErrorResponse> {
  const loginRes = await matrixFetch('/_matrix/client/v3/login', {
    method: 'POST',
    body: {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: localpart },
      password,
    },
  })
  if (isMatrixError(loginRes))
    return loginRes

  if (typeof loginRes.access_token !== 'string' || typeof loginRes.user_id !== 'string') {
    return {
      _error: true,
      _status: 500,
      error: `Login response for ${localpart} did not include access_token/user_id`,
    }
  }

  return {
    localpart,
    userId: loginRes.user_id,
    token: loginRes.access_token,
    displayName: localpart,
    password,
  }
}

async function loginWithCandidates(localpart: string, passwords: string[]): Promise<SeededUser | MatrixErrorResponse> {
  let lastError: MatrixErrorResponse | null = null
  for (const password of passwords) {
    const loginRes = await loginWithPassword(localpart, password)
    if (!isMatrixError(loginRes))
      return loginRes
    lastError = loginRes
  }
  return lastError ?? { _error: true, _status: 500, error: `No password candidate for ${localpart}` }
}

async function ensureUser(
  localpart: string,
  displayName: string,
  passwords: string[],
  registrationPassword: string,
): Promise<SeededUser | null> {
  const regResult = await matrixFetch('/_matrix/client/v3/register', {
    method: 'POST',
    body: {
      auth: { type: 'm.login.dummy' },
      username: localpart,
      password: registrationPassword,
    },
  })

  let user: SeededUser | MatrixErrorResponse
  if (isMatrixError(regResult)) {
    if (regResult.errcode !== 'M_USER_IN_USE') {
      console.error(`  FAIL register ${localpart}:`, regResult.error ?? regResult)
      return null
    }
    user = await loginWithCandidates(localpart, passwords)
  }
  else if (typeof regResult.access_token === 'string' && typeof regResult.user_id === 'string') {
    user = {
      localpart,
      userId: regResult.user_id,
      token: regResult.access_token,
      displayName,
      password: registrationPassword,
    }
  }
  else {
    console.error(`  FAIL register ${localpart}: invalid registration response`)
    return null
  }

  if (isMatrixError(user)) {
    console.error(`  FAIL login ${localpart}:`, user.error ?? user)
    return null
  }

  user.displayName = displayName
  await setProfile(user, displayName)
  return user
}

async function setProfile(user: SeededUser, displayName: string, avatarUrl?: string): Promise<void> {
  await matrixFetch(`/_matrix/client/v3/profile/${encodeURIComponent(user.userId)}/displayname`, {
    method: 'PUT',
    token: user.token,
    body: { displayname: displayName },
  })

  if (avatarUrl) {
    await matrixFetch(`/_matrix/client/v3/profile/${encodeURIComponent(user.userId)}/avatar_url`, {
      method: 'PUT',
      token: user.token,
      body: { avatar_url: avatarUrl },
    })
  }
}

async function ensureUserAvatar(user: SeededUser, marker: SeedMarker): Promise<void> {
  let avatarUrl = !FORCE_SEED ? marker.avatars[user.localpart] : undefined
  if (!avatarUrl) {
    avatarUrl = await uploadAvatarMedia(user) ?? undefined
    if (!avatarUrl)
      return
    marker.avatars[user.localpart] = avatarUrl
    console.log(`  OK avatar ${user.localpart}: ${avatarUrl}`)
  }

  await setProfile(user, user.displayName, avatarUrl)
}

async function getAccountData(user: SeededUser, type: string): Promise<unknown> {
  const res = await matrixFetch(
    `/_matrix/client/v3/user/${encodeURIComponent(user.userId)}/account_data/${encodeURIComponent(type)}`,
    { token: user.token },
  )
  return isMatrixError(res) ? null : res
}

async function setAccountData(user: SeededUser, type: string, content: Record<string, unknown>): Promise<void> {
  const res = await matrixFetch(
    `/_matrix/client/v3/user/${encodeURIComponent(user.userId)}/account_data/${encodeURIComponent(type)}`,
    { method: 'PUT', token: user.token, body: content },
  )
  if (isMatrixError(res))
    console.error(`  WARN set account data ${type} failed:`, res.error ?? res)
}

async function upsertDirectRoom(owner: SeededUser, peer: SeededUser, roomId: string): Promise<void> {
  await upsertDirectAccountData(owner, peer.userId, roomId)
  await upsertDirectAccountData(peer, owner.userId, roomId)
}

async function upsertDirectAccountData(user: SeededUser, peerUserId: string, roomId: string): Promise<void> {
  const existing = await getAccountData(user, 'm.direct')
  const directContent = isRecord(existing) ? { ...existing } : {}
  const roomIds = readStringArray(directContent[peerUserId])
  if (!roomIds.includes(roomId))
    roomIds.push(roomId)
  directContent[peerUserId] = roomIds
  await setAccountData(user, 'm.direct', directContent)
}

async function createMatrixRoom(owner: SeededUser, body: CreateRoomBody): Promise<string | null> {
  const createRes = await matrixFetch('/_matrix/client/v3/createRoom', {
    method: 'POST',
    token: owner.token,
    body,
  })
  if (isMatrixError(createRes)) {
    console.error(`  FAIL create room ${body.name ?? '(unnamed)'}:`, createRes.error ?? createRes)
    return null
  }
  return typeof createRes.room_id === 'string' ? createRes.room_id : null
}

async function joinRoom(roomId: string, user: SeededUser): Promise<void> {
  const res = await matrixFetch(`/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {
    method: 'POST',
    token: user.token,
    body: {},
  })
  if (isMatrixError(res))
    console.error(`    WARN ${user.localpart} join ${roomId} failed:`, res.error ?? res)
}

async function joinMembers(roomId: string, members: string[], users: Map<string, SeededUser>): Promise<void> {
  for (const localpart of members) {
    const user = users.get(localpart)
    if (user)
      await joinRoom(roomId, user)
  }
}

async function sendStateEvent(
  roomId: string,
  eventType: string,
  stateKey: string,
  content: Record<string, unknown>,
  owner: SeededUser,
): Promise<void> {
  const res = await matrixFetch(
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(eventType)}/${encodeURIComponent(stateKey)}`,
    { method: 'PUT', token: owner.token, body: content },
  )
  if (isMatrixError(res))
    console.error(`    WARN state ${eventType} on ${roomId} failed:`, res.error ?? res)
}

async function syncSeededMemberProfiles(users: Map<string, SeededUser>, marker: SeedMarker): Promise<void> {
  console.log('7. Sync seeded member avatars')
  let updated = 0

  async function updateRoomMembers(roomId: string | undefined, members: string[]): Promise<void> {
    if (!roomId)
      return
    for (const localpart of ['kunish', ...members]) {
      const user = users.get(localpart)
      const avatarUrl = marker.avatars[localpart]
      if (!user || !avatarUrl)
        continue

      const res = await matrixFetch(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.member/${encodeURIComponent(user.userId)}`,
        {
          method: 'PUT',
          token: user.token,
          body: {
            membership: 'join',
            displayname: user.displayName,
            avatar_url: avatarUrl,
          },
        },
      )
      if (isMatrixError(res)) {
        console.error(`    WARN member avatar ${user.localpart} in ${roomId} failed:`, res.error ?? res)
        continue
      }
      updated += 1
    }
  }

  for (const dm of LOCAL_SERVICE_MOCK_DATA.dmRooms)
    await updateRoomMembers(marker.rooms[dm.key], [dm.peer])

  for (const room of LOCAL_SERVICE_MOCK_DATA.groupRooms)
    await updateRoomMembers(marker.rooms[room.key], room.members)

  for (const space of LOCAL_SERVICE_MOCK_DATA.spaces) {
    await updateRoomMembers(marker.spaces[space.key], space.members)
    for (const channel of space.channels)
      await updateRoomMembers(marker.channels[channel.key], channel.members)
    for (const category of space.categories) {
      await updateRoomMembers(marker.categories[category.key], space.members)
      for (const channel of category.channels)
        await updateRoomMembers(marker.channels[channel.key], channel.members)
    }
  }

  console.log(`  OK synced ${updated} member profile states`)
}

async function sendRoomMessages(
  roomId: string,
  roomKey: string,
  messages: LocalServiceMessage[],
  users: Map<string, SeededUser>,
): Promise<number> {
  let sent = 0
  for (const [index, message] of messages.entries()) {
    const sender = users.get(message.sender)
    if (!sender) {
      console.error(`    WARN skip message ${roomKey}/${index}: unknown sender ${message.sender}`)
      continue
    }

    const txnId = encodeURIComponent(`${roomKey}-${index}-${Date.now()}`)
    const res = await matrixFetch(
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
      {
        method: 'PUT',
        token: sender.token,
        body: message.content,
      },
    )
    if (isMatrixError(res)) {
      console.error(`    WARN message ${roomKey}/${index} failed:`, res.error ?? res)
      continue
    }
    sent += 1
    await sleep(message.delayMs ?? MESSAGE_DELAY_MS)
  }
  return sent
}

function resolveMemberIds(members: string[], users: Map<string, SeededUser>): string[] {
  return members
    .map(localpart => users.get(localpart)?.userId)
    .filter((userId): userId is string => !!userId)
}

async function seedDirectRooms(owner: SeededUser, users: Map<string, SeededUser>, marker: SeedMarker): Promise<void> {
  console.log('4. Seed DM rooms')
  for (const dm of LOCAL_SERVICE_MOCK_DATA.dmRooms) {
    if (!FORCE_SEED && marker.rooms[dm.key]) {
      console.log(`  SKIP ${dm.peer}: ${marker.rooms[dm.key]}`)
      continue
    }

    const peer = users.get(dm.peer)
    if (!peer) {
      console.error(`  FAIL ${dm.key}: peer ${dm.peer} not available`)
      continue
    }

    const roomId = await createMatrixRoom(owner, {
      is_direct: true,
      invite: [peer.userId],
      preset: 'trusted_private_chat',
    })
    if (!roomId)
      continue

    await joinRoom(roomId, peer)
    await upsertDirectRoom(owner, peer, roomId)
    const sent = await sendRoomMessages(roomId, dm.key, dm.messages, users)
    marker.rooms[dm.key] = roomId
    console.log(`  OK ${dm.peer}: ${roomId} (${sent} messages)`)
  }
}

async function seedGroupRooms(owner: SeededUser, users: Map<string, SeededUser>, marker: SeedMarker): Promise<void> {
  console.log('5. Seed group rooms')
  for (const room of LOCAL_SERVICE_MOCK_DATA.groupRooms) {
    if (!FORCE_SEED && marker.rooms[room.key]) {
      console.log(`  SKIP ${room.name}: ${marker.rooms[room.key]}`)
      continue
    }

    const roomId = await createMatrixRoom(owner, {
      name: room.name,
      topic: room.topic,
      invite: resolveMemberIds(room.members, users),
      preset: 'private_chat',
    })
    if (!roomId)
      continue

    await joinMembers(roomId, room.members, users)
    const sent = await sendRoomMessages(roomId, room.key, room.messages, users)
    marker.rooms[room.key] = roomId
    console.log(`  OK ${room.name}: ${roomId} (${sent} messages)`)
  }
}

async function seedSpaces(owner: SeededUser, users: Map<string, SeededUser>, marker: SeedMarker): Promise<void> {
  console.log('6. Seed spaces and channels')
  for (const space of LOCAL_SERVICE_MOCK_DATA.spaces) {
    let spaceId: string | undefined = marker.spaces[space.key]
    if (!FORCE_SEED && spaceId) {
      console.log(`  SKIP ${space.name}: ${spaceId}`)
    }
    else {
      spaceId = await createSpace(owner, users, space) ?? undefined
    }
    if (!spaceId)
      continue
    marker.spaces[space.key] = spaceId

    await seedChannels(owner, users, marker, spaceId, space.channels)

    for (const category of space.categories) {
      let categoryId: string | undefined = marker.categories[category.key]
      if (!FORCE_SEED && categoryId) {
        console.log(`    SKIP ${category.name}: ${categoryId}`)
      }
      else {
        categoryId = await createSpace(owner, users, {
          key: category.key,
          name: category.name,
          members: space.members,
          channels: [],
          categories: [],
        }, spaceId, category.order) ?? undefined
      }
      if (!categoryId)
        continue
      marker.categories[category.key] = categoryId
      await seedChannels(owner, users, marker, categoryId, category.channels)
    }

    console.log(`  OK ${space.name}: ${spaceId}`)
  }
}

async function createSpace(
  owner: SeededUser,
  users: Map<string, SeededUser>,
  space: LocalServiceSpace,
  parentSpaceId?: string,
  order?: string,
): Promise<string | null> {
  const initialState: InitialStateEvent[] = parentSpaceId
    ? [{
        type: 'm.space.parent',
        state_key: parentSpaceId,
        content: { via: [LOCAL_SERVICE_MOCK_DATA.serverName], canonical: true },
      }]
    : []

  const spaceId = await createMatrixRoom(owner, {
    name: space.name,
    topic: space.topic,
    invite: resolveMemberIds(space.members, users),
    preset: 'private_chat',
    creation_content: { type: 'm.space' },
    initial_state: initialState,
  })
  if (!spaceId)
    return null

  await joinMembers(spaceId, space.members, users)

  if (parentSpaceId) {
    await sendStateEvent(parentSpaceId, 'm.space.child', spaceId, {
      via: [LOCAL_SERVICE_MOCK_DATA.serverName],
      suggested: true,
      order,
    }, owner)
  }

  return spaceId
}

async function seedChannels(
  owner: SeededUser,
  users: Map<string, SeededUser>,
  marker: SeedMarker,
  parentSpaceId: string,
  channels: LocalServiceChannel[],
): Promise<void> {
  for (const channel of channels) {
    if (!FORCE_SEED && marker.channels[channel.key]) {
      console.log(`    SKIP #${channel.name}: ${marker.channels[channel.key]}`)
      continue
    }

    const initialState: InitialStateEvent[] = [
      {
        type: 'm.space.parent',
        state_key: parentSpaceId,
        content: { via: [LOCAL_SERVICE_MOCK_DATA.serverName], canonical: true },
      },
    ]
    if (channel.isVoice) {
      initialState.push({
        type: 'im.muon.voice_channel',
        state_key: '',
        content: { enabled: true },
      })
    }

    const roomId = await createMatrixRoom(owner, {
      name: channel.name,
      topic: channel.topic,
      invite: resolveMemberIds(channel.members, users),
      preset: 'private_chat',
      initial_state: initialState,
    })
    if (!roomId)
      continue

    await joinMembers(roomId, channel.members, users)
    await sendStateEvent(parentSpaceId, 'm.space.child', roomId, {
      via: [LOCAL_SERVICE_MOCK_DATA.serverName],
      suggested: true,
      order: channel.order,
    }, owner)

    const sent = await sendRoomMessages(roomId, channel.key, channel.messages, users)
    marker.channels[channel.key] = roomId
    console.log(`    OK #${channel.name}: ${roomId}${channel.isVoice ? ' (voice)' : ` (${sent} messages)`}`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  console.log('=== Muon local service seed ===')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Seed version: ${LOCAL_SERVICE_MOCK_DATA.version}`)
  if (FORCE_SEED)
    console.log('Force mode: enabled')
  console.log()

  console.log('1. Ensure users')
  const users = new Map<string, SeededUser>()
  const owner = await ensureUser(
    LOCAL_SERVICE_MOCK_DATA.owner.localpart,
    LOCAL_SERVICE_MOCK_DATA.owner.displayName,
    OWNER_PASSWORD_CANDIDATES,
    OWNER_REGISTRATION_PASSWORD,
  )
  if (!owner) {
    console.error('Owner account is unavailable; aborting seed.')
    process.exit(1)
  }
  users.set(owner.localpart, owner)
  console.log(`  OK owner ${owner.userId}`)

  for (const userDef of LOCAL_SERVICE_MOCK_DATA.users) {
    const user = await ensureUser(
      userDef.localpart,
      userDef.displayName,
      [DEFAULT_USER_PASSWORD],
      DEFAULT_USER_PASSWORD,
    )
    if (user) {
      users.set(user.localpart, user)
      console.log(`  OK ${user.userId}`)
    }
  }

  for (const userDef of LOCAL_SERVICE_MOCK_DATA.profileUsers) {
    const user = await ensureUser(
      userDef.localpart,
      userDef.displayName,
      [DEFAULT_USER_PASSWORD],
      DEFAULT_USER_PASSWORD,
    )
    if (user) {
      users.set(user.localpart, user)
      console.log(`  OK ${user.userId}`)
    }
  }
  console.log()

  console.log('2. Check seed marker')
  const existingMarker = await getAccountData(owner, SEED_ACCOUNT_DATA_TYPE)
  const marker = isCurrentSeedMarker(existingMarker) && !FORCE_SEED
    ? normalizeSeedMarker(existingMarker)
    : createEmptyMarker(owner.userId)

  console.log('3. Ensure uploaded avatars')
  for (const user of users.values())
    await ensureUserAvatar(user, marker)

  if (isCurrentSeedMarker(existingMarker) && isCompleteSeedMarker(marker) && !FORCE_SEED) {
    console.log(`  OK already seeded for version ${existingMarker.version}; skip.`)
    await syncSeededMemberProfiles(users, marker)
    await setAccountData(owner, SEED_ACCOUNT_DATA_TYPE, marker as unknown as Record<string, unknown>)
    console.log('  Run `pnpm services:seed -- --force` to create a fresh dataset.')
    return
  }
  if (isCurrentSeedMarker(existingMarker) && !FORCE_SEED)
    console.log('  Existing seed marker is incomplete; missing data will be filled.')
  else
    console.log('  Continue seeding local mock data')

  await seedDirectRooms(owner, users, marker)
  await seedGroupRooms(owner, users, marker)
  await seedSpaces(owner, users, marker)
  await syncSeededMemberProfiles(users, marker)

  await setAccountData(owner, SEED_ACCOUNT_DATA_TYPE, marker as unknown as Record<string, unknown>)

  console.log('\n=== Seed complete ===')
  console.log(`Owner: ${owner.userId}`)
  console.log(`Owner password: ${owner.password === 'Aa794613123.' ? '(existing local password)' : owner.password}`)
  console.log(`Mock users password: ${DEFAULT_USER_PASSWORD}`)
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
