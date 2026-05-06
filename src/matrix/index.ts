export { completeEnterpriseLogin, isEnterpriseAuthConfigured, login, logout, parseEnterpriseAuthCallback, register, restoreSession, startEnterpriseLogin } from './auth'
export { blockUser, getBlockedUsers, isUserBlocked, unblockUser } from './blocking'
export { createClient, destroyClient, getClient } from './client'
export { createEncryptedRoom, initCrypto } from './crypto'
export { materializeOfflineDigest } from './digest'
export {
  citationRefSchema,
  compareDigestEntries,
  createDigestCitation,
  deriveDigestRelevance,
  DIGEST_RELEVANCE,
  DIGEST_RELEVANCE_PRIORITY,
  digestEntrySchema,
  toCitationEventIds,
  toDigestEntry,
} from './digestTypes'
export type {
  CitationRef,
  DigestEntry,
  DigestFilter,
  DigestRelevance,
  DigestRoomSignal,
  DigestSession,
  DigestSourceEvent,
} from './digestTypes'
export { bindClientEvents, matrixEvents, unbindClientEvents } from './events'
export { loadInboxEventContext } from './inbox'
export type { InboxEventContext } from './inbox'
export { downloadMedia, extractImageMeta, extractVideoMeta, fetchMediaBlobUrl, uploadMedia } from './media'
export {
  canMergeSystemEvents,
  editMessage,
  forwardMessages,
  getReactions,
  getSystemEventInfo,
  getThreadReplies,
  getTimeline,
  getTimelineRelationSummaries,
  isSystemEvent,
  paginateBack,
  redactMessage,
  replyToMessage,
  sendAudioMessage,
  sendContactCard,
  sendFileMessage,
  sendGifMessage,
  sendImageMessage,
  sendImageStickerMessage,
  sendLocationMessage,
  sendReaction,
  sendStickerMessage,
  sendTextMessage,
  sendThreadReply,
  sendVideoMessage,
} from './messages'
export type { ReactionSummary, SystemEventInfo, TimelineRelationSummaries } from './messages'
export { clearMyStatus, getMyAvatarUrl, getMyDisplayName, getMyStatus, getUserPresenceInfo, setMyAvatar, setMyDisplayName, setMyStatus } from './profile'
export { isProjectSyncEvent, parseProjectSyncPayload, sendProjectSyncEvent } from './projects'
export { getReadMarkerEventId, getReadUsers, sendReadReceipt } from './receipts'
export { backPaginateRoomEventsSearch, searchRoomEvents } from './retrieval'
export type { RetrievalItem, RetrievalPage, RetrievalSession } from './retrieval'
export { findOrCreateDm, getRoom, getRoomAnnouncement, getRoomSummaries, getRoomTopic, invalidateRoomSummariesCache, isMessagePinned, isMessageStarred, leaveRoom, markRoomAsRead, pinMessage, setRoomAnnouncement, setRoomName, setRoomTopic, starMessage, toggleRoomMute, toggleRoomPin, unpinMessage, unstarMessage } from './rooms'
export { isDirectRoom, normalizeRoomId } from './roomUtils'
export {
  addRoomToSpace,
  buildChannelInfo,
  createChannel,
  createSpace,
  getCategoryChannels,
  getOrphanRooms,
  getSpaceHierarchy,
  getSpaceMembers,
  getTopLevelSpaces,
  isVoiceChannel,
  removeRoomFromSpace,
  setSpacePowerLevel,
} from './spaces'
export type { CategoryInfo, ChannelInfo, SpaceInfo, SpaceMember } from './spaces'
export { startSync, stopSync, syncState } from './sync'
export type { RoomSummary } from './types'
export { sendTyping } from './typing'
export { getCurrentDeviceId, getDevices } from './verification'
