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
  databaseUrl: string
  matrixAdapter: 'conduit'
  matrixAdminToken: string
  matrixServerUrl: string
  mediaStorage: S3MediaStorageConfig | null
  sessionSecret: string
}

function envValue(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

function envBoolean(value: string | undefined, defaultValue: boolean): boolean {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(normalized)
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
  return {
    adminBaseUrl: env.MUON_ADMIN_BASE_URL ?? 'http://127.0.0.1:4174',
    apiBaseUrl: env.MUON_API_BASE_URL ?? 'http://127.0.0.1:8787',
    databaseUrl: env.MUON_DATABASE_URL ?? 'postgres://muon:muon@127.0.0.1:5432/muon',
    matrixAdapter: 'conduit',
    matrixAdminToken: env.MUON_MATRIX_ADMIN_TOKEN ?? '',
    matrixServerUrl: env.MUON_MATRIX_SERVER_URL ?? 'http://127.0.0.1:6167',
    mediaStorage: readS3MediaStorageConfig(env),
    sessionSecret: env.MUON_SESSION_SECRET ?? 'development-session-secret',
  }
}
