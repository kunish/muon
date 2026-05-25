import type { S3MediaStorageConfig } from '../../config'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export interface MediaUploadInput {
  bytes: ArrayBuffer
  contentType: string
  fileName: string
}

export interface MediaUploadResult {
  key: string
  url: string
}

export interface MediaStorageService {
  upload: (input: MediaUploadInput) => Promise<MediaUploadResult>
}

const SAFE_FILE_NAME_RE = /[^\w.-]+/g

function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() ?? ''
  const safeName = baseName.replace(SAFE_FILE_NAME_RE, '-').replace(/^-+|-+$/g, '')
  return safeName || 'upload'
}

function encodeKeyForUrl(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

function buildObjectKey(prefix: string | undefined, fileName: string, now = new Date()): string {
  const safeName = sanitizeFileName(fileName)
  const year = String(now.getUTCFullYear())
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const cleanPrefix = (prefix ?? 'media').replace(/^\/+|\/+$/g, '') || 'media'
  return `${cleanPrefix}/${year}/${month}/${randomUUID()}-${safeName}`
}

function buildPublicUrl(publicBaseUrl: string, key: string): string {
  return `${publicBaseUrl.replace(/\/+$/g, '')}/${encodeKeyForUrl(key)}`
}

export function createS3MediaStorage(config: S3MediaStorageConfig): MediaStorageService {
  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    region: config.region,
  })

  return {
    async upload(input) {
      const body = Buffer.from(input.bytes)
      const key = buildObjectKey(config.prefix, input.fileName)
      await client.send(
        new PutObjectCommand({
          Body: body,
          Bucket: config.bucket,
          ContentLength: body.byteLength,
          ContentType: input.contentType || 'application/octet-stream',
          Key: key,
        }),
      )

      return {
        key,
        url: buildPublicUrl(config.publicBaseUrl, key),
      }
    },
  }
}
