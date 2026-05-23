import type { ICreateRoomStateEvent, MatrixEvent, Room } from 'matrix-js-sdk'
import type { SpaceChildEventContent } from 'matrix-js-sdk/lib/@types/state_events'
import type {} from './matrix-sdk.d'
import { EventType, NotificationCountType, Preset } from 'matrix-js-sdk'
import { getClient } from './client'

// ── Types ──

export interface SpaceInfo {
  spaceId: string
  name: string
  avatar?: string
  topic?: string
  memberCount: number
  /** Direct child rooms (channels) */
  childRoomIds: string[]
  /** Direct child spaces (categories) */
  childSpaceIds: string[]
}

export interface CategoryInfo {
  spaceId: string
  name: string
  /** Room IDs belonging to this category */
  childRoomIds: string[]
  /** Ordering key from space child event */
  order?: string
}

export interface ChannelInfo {
  roomId: string
  name: string
  topic?: string
  avatar?: string
  isVoice: boolean
  /** Parent category spaceId, or null if uncategorized */
  categoryId: string | null
  /** Ordering key from space child event */
  order?: string
  unreadCount: number
  highlightCount: number
  memberCount: number
}

export interface SpaceMember {
  userId: string
  displayName: string
  avatarUrl?: string
  powerLevel: number
  membership: string
}

// ── Helpers ──

/** Check if a Matrix room is a Space */
function isSpace(room: Room): boolean {
  const createEvent = room.currentState.getStateEvents('m.room.create', '')
  return createEvent?.getContent()?.type === 'm.space'
}

/** Check if a room is a voice channel */
export function isVoiceChannel(room: Room): boolean {
  const voiceEvent = room.currentState.getStateEvents('im.muon.voice_channel', '')
  return voiceEvent?.getContent()?.enabled === true
}

/** Get child rooms/spaces from a Space via m.space.child state events */
function getSpaceChildren(spaceId: string): { roomId: string, order?: string, isSpace: boolean }[] {
  const client = getClient()
  const space = client.getRoom(spaceId)
  if (!space)
    return []

  const childEvents = space.currentState.getStateEvents(EventType.SpaceChild)
  if (!Array.isArray(childEvents))
    return []

  return childEvents
    .filter((ev: MatrixEvent) => {
      const content = ev.getContent()
      // m.space.child with empty content = removed child
      return content && Object.keys(content).length > 0 && content.via
    })
    .map((ev: MatrixEvent) => {
      const childRoomId = ev.getStateKey()!
      const content = ev.getContent()
      const childRoom = client.getRoom(childRoomId)
      return {
        roomId: childRoomId,
        order: content.order,
        isSpace: childRoom ? isSpace(childRoom) : false,
      }
    })
    .sort((a, b) => (a.order || '').localeCompare(b.order || ''))
}

// ── Public API ──

/** Get all top-level Spaces (servers) the user has joined */
export function getTopLevelSpaces(): SpaceInfo[] {
  const client = getClient()
  const rooms = client.getRooms().filter(room =>
    room.getMyMembership() === 'join' && isSpace(room),
  )

  // Build a set of all child space IDs to identify non-top-level ones
  const childSpaceIds = new Set<string>()
  for (const room of rooms) {
    const children = getSpaceChildren(room.roomId)
    for (const child of children) {
      if (child.isSpace) {
        childSpaceIds.add(child.roomId)
      }
    }
  }

  // Top-level = space rooms that are NOT children of any other space
  return rooms
    .filter(room => !childSpaceIds.has(room.roomId))
    .map(room => buildSpaceInfo(room))
}

/** Build SpaceInfo for a given Space room */
function buildSpaceInfo(room: Room): SpaceInfo {
  const children = getSpaceChildren(room.roomId)
  return {
    spaceId: room.roomId,
    name: room.name || 'Unnamed Server',
    avatar: room.getMxcAvatarUrl() || undefined,
    topic: room.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic,
    memberCount: room.getJoinedMemberCount(),
    childRoomIds: children.filter(c => !c.isSpace).map(c => c.roomId),
    childSpaceIds: children.filter(c => c.isSpace).map(c => c.roomId),
  }
}

/** Get the full hierarchy for a Space: categories and channels */
export function getSpaceHierarchy(spaceId: string): { categories: CategoryInfo[], uncategorizedChannels: ChannelInfo[] } {
  const client = getClient()
  const children = getSpaceChildren(spaceId)
  const categories: CategoryInfo[] = []
  const uncategorizedChannels: ChannelInfo[] = []

  for (const child of children) {
    const childRoom = client.getRoom(child.roomId)
    if (!childRoom || childRoom.getMyMembership() !== 'join')
      continue

    if (child.isSpace) {
      // This is a category (sub-space)
      const catChildren = getSpaceChildren(child.roomId)
      categories.push({
        spaceId: child.roomId,
        name: childRoom.name || 'Unnamed Category',
        childRoomIds: catChildren.filter(c => !c.isSpace).map(c => c.roomId),
        order: child.order,
      })
    }
    else {
      // Direct child room — uncategorized channel
      uncategorizedChannels.push(buildChannelInfo(childRoom, null, child.order))
    }
  }

  return { categories, uncategorizedChannels }
}

/** Build ChannelInfo for a room */
export function buildChannelInfo(room: Room, categoryId: string | null, order?: string): ChannelInfo {
  return {
    roomId: room.roomId,
    name: room.name || 'unnamed',
    topic: room.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic,
    avatar: room.getMxcAvatarUrl() || undefined,
    isVoice: isVoiceChannel(room),
    categoryId,
    order,
    unreadCount: room.getUnreadNotificationCount(NotificationCountType.Total) || 0,
    highlightCount: room.getUnreadNotificationCount(NotificationCountType.Highlight) || 0,
    memberCount: room.getJoinedMemberCount(),
  }
}

/** Helper: get notification counts safely */
export function getCategoryChannels(categorySpaceId: string): ChannelInfo[] {
  const client = getClient()
  const children = getSpaceChildren(categorySpaceId)
  const channels: ChannelInfo[] = []

  for (const child of children) {
    if (child.isSpace)
      continue
    const room = client.getRoom(child.roomId)
    if (!room || room.getMyMembership() !== 'join')
      continue
    channels.push(buildChannelInfo(room, categorySpaceId, child.order))
  }

  return channels
}

/** Create a new Space (server or category) */
export async function createSpace(name: string, opts: {
  topic?: string
  avatar?: string
  isPublic?: boolean
  parentSpaceId?: string
} = {}): Promise<string> {
  const client = getClient()

  const { room_id } = await client.createRoom({
    name,
    topic: opts.topic,
    preset: opts.isPublic ? Preset.PublicChat : Preset.PrivateChat,
    creation_content: { type: 'm.space' },
    initial_state: opts.avatar
      ? [{ type: 'm.room.avatar', content: { url: opts.avatar } }]
      : [],
    power_level_content_override: {
      events_default: 0,
      invite: 50,
      kick: 50,
      ban: 50,
      redact: 50,
      state_default: 50,
    },
  })

  // If this is a sub-space (category), add it as a child of the parent
  if (opts.parentSpaceId) {
    await addRoomToSpace(opts.parentSpaceId, room_id)
  }

  return room_id
}

/** Add a room as a child of a Space */
export async function addRoomToSpace(spaceId: string, roomId: string, opts: {
  order?: string
  suggested?: boolean
} = {}): Promise<void> {
  const client = getClient()
  const homeserver = client.getDomain() ?? ''
  await client.sendStateEvent(spaceId, EventType.SpaceChild, {
    via: [homeserver],
    order: opts.order,
    suggested: opts.suggested ?? true,
  }, roomId)
}

/** Remove a room from a Space */
export async function removeRoomFromSpace(spaceId: string, roomId: string): Promise<void> {
  const client = getClient()
  // Sending empty content removes the child relationship
  await client.sendStateEvent(spaceId, EventType.SpaceChild, {} as SpaceChildEventContent, roomId)
}

/** Get members of a Space with their power levels */
export function getSpaceMembers(spaceId: string): SpaceMember[] {
  const client = getClient()
  const room = client.getRoom(spaceId)
  if (!room)
    return []

  const powerLevelsEvent = room.currentState.getStateEvents('m.room.power_levels', '')
  const powerLevels: Record<string, number> = powerLevelsEvent?.getContent()?.users || {}
  const defaultPowerLevel = powerLevelsEvent?.getContent()?.users_default ?? 0

  return room.getJoinedMembers().map(member => ({
    userId: member.userId,
    displayName: member.name || member.userId.split(':')[0].slice(1),
    avatarUrl: member.getMxcAvatarUrl() || undefined,
    powerLevel: powerLevels[member.userId] ?? defaultPowerLevel,
    membership: 'join',
  }))
}

/** Set a user's power level in a Space */
export async function setSpacePowerLevel(spaceId: string, userId: string, level: number): Promise<void> {
  const client = getClient()
  const room = client.getRoom(spaceId)
  if (!room)
    throw new Error(`Space ${spaceId} not found`)

  const powerLevelsEvent = room.currentState.getStateEvents('m.room.power_levels', '')
  const content = powerLevelsEvent?.getContent() || {}
  const users: Record<string, number> = { ...(content.users || {}) }
  users[userId] = level

  await client.sendStateEvent(spaceId, EventType.RoomPowerLevels, {
    ...content,
    users,
  })
}

/** Create a channel (room) within a Space */
export async function createChannel(spaceId: string, name: string, opts: {
  topic?: string
  isVoice?: boolean
  isPrivate?: boolean
  categoryId?: string
} = {}): Promise<string> {
  const client = getClient()
  const homeserver = client.getDomain() ?? ''

  const initialState: ICreateRoomStateEvent[] = []
  // Mark as voice channel if requested
  if (opts.isVoice) {
    initialState.push({
      type: 'im.muon.voice_channel',
      content: { enabled: true },
      state_key: '',
    })
  }

  // Set parent space
  const parentId = opts.categoryId || spaceId
  initialState.push({
    type: 'm.space.parent',
    content: { via: [homeserver], canonical: true },
    state_key: parentId,
  })

  const { room_id } = await client.createRoom({
    name,
    topic: opts.topic,
    preset: opts.isPrivate ? Preset.PrivateChat : Preset.PublicChat,
    initial_state: initialState,
  })

  // Add as child of the parent space/category
  await addRoomToSpace(parentId, room_id)

  // Also add to the top-level space if created under a category
  if (opts.categoryId && opts.categoryId !== spaceId) {
    // The room is already linked to the category, which is linked to the server
    // No additional linking needed for hierarchy traversal
  }

  return room_id
}

/** Get rooms that don't belong to any Space (orphan rooms for "uncategorized" server) */
export function getOrphanRooms(): Room[] {
  const client = getClient()
  const allRooms = client.getRooms().filter(r => r.getMyMembership() === 'join')

  // Collect all rooms that are children of some space
  const spaceManagedRoomIds = new Set<string>()
  for (const room of allRooms) {
    if (!isSpace(room))
      continue
    const children = getSpaceChildren(room.roomId)
    for (const child of children) {
      spaceManagedRoomIds.add(child.roomId)
    }
  }

  // Also check m.space.parent on rooms
  for (const room of allRooms) {
    const parentEvents = room.currentState.getStateEvents(EventType.SpaceParent)
    if (Array.isArray(parentEvents) && parentEvents.length > 0) {
      spaceManagedRoomIds.add(room.roomId)
    }
  }

  // DM rooms are excluded from "orphan" classification
  const directEvent = client.getAccountData(EventType.Direct)
  const directContent: Record<string, string[]> = directEvent?.getContent() ?? {}
  const dmRoomIds = new Set<string>()
  for (const roomIds of Object.values(directContent)) {
    if (Array.isArray(roomIds)) {
      for (const rid of roomIds) {
        dmRoomIds.add(rid)
      }
    }
  }

  return allRooms.filter(room =>
    !isSpace(room)
    && !spaceManagedRoomIds.has(room.roomId)
    && !dmRoomIds.has(room.roomId),
  )
}
