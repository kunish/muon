import type { S3MediaStorageConfig } from '../../config'
import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from 'livekit-server-sdk'

export interface RecordingResult {
  egressId: string
  /** 录制文件在对象存储上的可访问回放 URL（由 publicBaseUrl + 确定性 key 构造） */
  fileUrl: string
}

export interface EgressService {
  /** 是否已配置可用的录制后端 */
  available: () => boolean
  startRoomRecording: (roomName: string) => Promise<RecordingResult>
  stopRoomRecording: (egressId: string) => Promise<void>
}

export interface LiveKitEgressConfig {
  livekitUrl: string
  apiKey: string
  apiSecret: string
  storage: S3MediaStorageConfig
}

/** 未配置 LiveKit/对象存储时的占位实现:诚实报错,不伪造成功 */
export function createDisabledEgressService(): EgressService {
  const fail = (): never => {
    throw new Error('Cloud recording is not configured')
  }
  return {
    available: () => false,
    startRoomRecording: () => Promise.resolve(fail()),
    stopRoomRecording: () => Promise.resolve(fail()),
  }
}

function sanitizeRoomNameForKey(roomName: string): string {
  return roomName.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'room'
}

/** 真实云录制:LiveKit Egress 录制房间合成画面并上传至 S3 兼容对象存储 */
export function createLiveKitEgressService(config: LiveKitEgressConfig): EgressService {
  const client = new EgressClient(config.livekitUrl, config.apiKey, config.apiSecret)

  // 确定性 key（服务端时间戳，不用 LiveKit 的 {time} 占位），便于在 start 时即返回可访问回放 URL
  function recordingKey(roomName: string, startedAt: number): string {
    const prefix = config.storage.prefix ? `${config.storage.prefix.replace(/\/+$/g, '')}/` : ''
    return `${prefix}recordings/${sanitizeRoomNameForKey(roomName)}-${startedAt}.mp4`
  }

  function fileUrlFor(key: string): string {
    return `${config.storage.publicBaseUrl.replace(/\/+$/g, '')}/${key}`
  }

  function fileOutput(key: string): EncodedFileOutput {
    return new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: key,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: config.storage.accessKeyId,
          secret: config.storage.secretAccessKey,
          region: config.storage.region,
          endpoint: config.storage.endpoint,
          bucket: config.storage.bucket,
          forcePathStyle: config.storage.forcePathStyle,
        }),
      },
    })
  }

  return {
    available: () => true,
    async startRoomRecording(roomName) {
      const key = recordingKey(roomName, Date.now())
      const info = await client.startRoomCompositeEgress(roomName, fileOutput(key))
      return { egressId: info.egressId, fileUrl: fileUrlFor(key) }
    },
    async stopRoomRecording(egressId) {
      await client.stopEgress(egressId)
    },
  }
}

/** 根据运行配置构造录制后端;缺少 LiveKit/存储配置时返回禁用实现 */
export function egressServiceFromConfig(params: {
  livekitUrl: string | null
  apiKey: string | null
  apiSecret: string | null
  storage: S3MediaStorageConfig | null
}): EgressService {
  if (!params.livekitUrl || !params.apiKey || !params.apiSecret || !params.storage) {
    return createDisabledEgressService()
  }
  return createLiveKitEgressService({
    livekitUrl: params.livekitUrl,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    storage: params.storage,
  })
}
