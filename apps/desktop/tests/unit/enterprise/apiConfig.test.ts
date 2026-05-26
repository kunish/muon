import { describe, expect, it } from 'vitest'
import { readEnterpriseApiConfig } from '../../../../api/src/config'
import { readRepoSource } from '../../helpers/paths'

describe('enterprise api config', () => {
  it('reads S3-compatible media storage configuration from server env', () => {
    const config = readEnterpriseApiConfig({
      MUON_S3_ACCESS_KEY_ID: 'local-access-key',
      MUON_S3_BUCKET: 'muon-media',
      MUON_S3_ENDPOINT: 'https://s3.kunish.eu.org',
      MUON_S3_FORCE_PATH_STYLE: 'true',
      MUON_S3_PUBLIC_BASE_URL: 'https://s3.kunish.eu.org/muon-media',
      MUON_S3_REGION: 'auto',
      MUON_S3_SECRET_ACCESS_KEY: 'local-secret-key',
    })

    expect(config.mediaStorage).toEqual({
      accessKeyId: 'local-access-key',
      bucket: 'muon-media',
      endpoint: 'https://s3.kunish.eu.org',
      forcePathStyle: true,
      publicBaseUrl: 'https://s3.kunish.eu.org/muon-media',
      region: 'auto',
      secretAccessKey: 'local-secret-key',
    })
    expect(config.maxMediaUploadBytes).toBe(25 * 1024 * 1024)
  })

  it('keeps S3 media storage disabled until credentials are configured', () => {
    const config = readEnterpriseApiConfig({
      MUON_S3_BUCKET: 'muon-media',
      MUON_S3_ENDPOINT: 'https://s3.kunish.eu.org',
    })

    expect(config.mediaStorage).toBeNull()
  })

  it('normalizes CORS origins and media upload limits from server env', () => {
    const config = readEnterpriseApiConfig({
      MUON_ADMIN_BASE_URL: ' http://127.0.0.1:4174/admin ',
      MUON_CORS_ALLOWED_ORIGINS: ' https://admin.example.com/app,not-a-url,https://admin.example.com ',
      MUON_MAX_MEDIA_UPLOAD_BYTES: '1024',
    })

    expect(config.adminBaseUrl).toBe('http://127.0.0.1:4174/admin')
    expect(config.corsAllowedOrigins).toEqual(['https://admin.example.com'])
    expect(config.maxMediaUploadBytes).toBe(1024)
  })

  it('falls back to safe local CORS origins and media size when env values are invalid', () => {
    const config = readEnterpriseApiConfig({
      MUON_ADMIN_BASE_URL: 'http://localhost:4174',
      MUON_MAX_MEDIA_UPLOAD_BYTES: '-1',
    })

    expect(config.corsAllowedOrigins).toEqual([
      'http://localhost:4174',
      'http://127.0.0.1:1420',
      'http://localhost:1420',
    ])
    expect(config.maxMediaUploadBytes).toBe(25 * 1024 * 1024)
  })

  it('checks media upload body size before buffering production server requests', () => {
    const serverSource = readRepoSource('apps/api/src/server.ts')

    expect(serverSource).toContain('function mediaUploadBodyLimit')
    expect(serverSource).toContain('readIncomingChunksEffect(incoming, uploadBodyLimit)')
    expect(serverSource).toContain('totalBytes += buffer.byteLength')
    expect(serverSource).toContain('totalBytes > maxBytes')
    expect(serverSource).toContain('incoming.pause()')
    expect(serverSource).toContain('incoming.resume()')
    expect(serverSource).toContain('writeHead(413')
  })
})
