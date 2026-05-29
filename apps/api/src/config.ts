import process from 'node:process'

export interface S3MediaStorageConfig {
  accessKeyId: string
  bucket: string
  endpoint: string
  forcePathStyle: boolean
  prefix?: string
  publicBaseUrl: string
  region: string
  secretAccessKey: string
}

export interface EnterpriseApiConfig {
  adminBaseUrl: string
  apiBaseUrl: string
  corsAllowedOrigins: string[]
  databaseUrl: string
  matrixAdapter: 'conduit'
  matrixAdminToken: string
  matrixServerUrl: string
  maxMediaUploadBytes: number
  mediaStorage: S3MediaStorageConfig | null
  livekitUrl: string | null
  livekitApiKey: string | null
  livekitApiSecret: string | null
  sessionSecret: string
}

const DEFAULT_MAX_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024
const DEFAULT_LOCAL_ORIGINS = ['http://127.0.0.1:1420', 'http://localhost:1420', 'http://localhost:4174']

function envValue(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

function envBoolean(value: string | undefined, defaultValue: boolean): boolean {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function envPositiveInteger(value: string | undefined, defaultValue: number): number {
  const normalized = value?.trim()
  if (!normalized) return defaultValue

  const parsed = Number(normalized)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : defaultValue
}

function originFromUrl(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function readCorsAllowedOrigins(env: Record<string, string | undefined>, adminBaseUrl: string): string[] {
  const configured = envValue(env.MUON_CORS_ALLOWED_ORIGINS)
  const values = configured ? configured.split(',') : [adminBaseUrl, ...DEFAULT_LOCAL_ORIGINS]
  const origins = values.map((value) => originFromUrl(value.trim())).filter((value): value is string => Boolean(value))
  return Array.from(new Set(origins))
}

function readS3MediaStorageConfig(env: Record<string, string | undefined>): S3MediaStorageConfig | null {
  const accessKeyId = envValue(env.MUON_S3_ACCESS_KEY_ID)
  const secretAccessKey = envValue(env.MUON_S3_SECRET_ACCESS_KEY)
  if (!accessKeyId || !secretAccessKey) return null

  const endpoint = envValue(env.MUON_S3_ENDPOINT) ?? 'https://s3.kunish.eu.org'
  const bucket = envValue(env.MUON_S3_BUCKET) ?? 'muon-media'
  const publicBaseUrl = envValue(env.MUON_S3_PUBLIC_BASE_URL) ?? `${endpoint.replace(/\/+$/g, '')}/${bucket}`
  const prefix = envValue(env.MUON_S3_PREFIX)

  return {
    accessKeyId,
    bucket,
    endpoint,
    forcePathStyle: envBoolean(env.MUON_S3_FORCE_PATH_STYLE, true),
    ...(prefix ? { prefix } : {}),
    publicBaseUrl,
    region: envValue(env.MUON_S3_REGION) ?? 'auto',
    secretAccessKey,
  }
}

export function readEnterpriseApiConfig(env: Record<string, string | undefined> = process.env): EnterpriseApiConfig {
  const adminBaseUrl = envValue(env.MUON_ADMIN_BASE_URL) ?? 'http://127.0.0.1:4174'
  const apiBaseUrl = envValue(env.MUON_API_BASE_URL) ?? 'http://127.0.0.1:8787'

  return {
    adminBaseUrl,
    apiBaseUrl,
    corsAllowedOrigins: readCorsAllowedOrigins(env, adminBaseUrl),
    databaseUrl: envValue(env.MUON_DATABASE_URL) ?? 'postgres://muon:muon@127.0.0.1:5432/muon',
    matrixAdapter: 'conduit',
    matrixAdminToken: envValue(env.MUON_MATRIX_ADMIN_TOKEN) ?? '',
    matrixServerUrl: envValue(env.MUON_MATRIX_SERVER_URL) ?? 'http://127.0.0.1:6167',
    maxMediaUploadBytes: envPositiveInteger(env.MUON_MAX_MEDIA_UPLOAD_BYTES, DEFAULT_MAX_MEDIA_UPLOAD_BYTES),
    mediaStorage: readS3MediaStorageConfig(env),
    livekitUrl: envValue(env.MUON_LIVEKIT_URL),
    livekitApiKey: envValue(env.MUON_LIVEKIT_API_KEY),
    livekitApiSecret: envValue(env.MUON_LIVEKIT_API_SECRET),
    sessionSecret: envValue(env.MUON_SESSION_SECRET) ?? 'development-session-secret',
  }
}
