export { login, logout, register, restoreSession } from './auth'
export { createClient, destroyClient, getClient } from './client'
export { createEncryptedRoom, initCrypto, isRoomEncrypted } from './crypto'
export { bindClientEvents, matrixEvents, unbindClientEvents } from './events'
export { downloadMedia, getThumbnailUrl, mxcToHttp, uploadMedia } from './media'
export {
  editMessage,
  getTimeline,
  paginateBack,
  redactMessage,
  replyToMessage,
  sendAudioMessage,
  sendFileMessage,
  sendImageMessage,
  sendTextMessage,
  sendVideoMessage,
} from './messages'
export { sendReadReceipt } from './receipts'
export { getRoom, getRooms, getRoomSummaries } from './rooms'
export { startSync, stopSync, syncState } from './sync'
export type { LoginCredentials, MatrixConfig, MessageContent, RegisterParams, RoomSummary, SyncState } from './types'
export { sendTyping } from './typing'
export { cancelVerification, confirmVerification, getDevices, isDeviceVerified, startVerification } from './verification'
