import { describe, expect, it } from 'vitest'
import { readEnterpriseApiConfig } from '../../../../api/src/config'

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
  })

  it('keeps S3 media storage disabled until credentials are configured', () => {
    const config = readEnterpriseApiConfig({
      MUON_S3_BUCKET: 'muon-media',
      MUON_S3_ENDPOINT: 'https://s3.kunish.eu.org',
    })

    expect(config.mediaStorage).toBeNull()
  })
})
