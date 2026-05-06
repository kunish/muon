import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

describe('matrix verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should retrieve the device list from the Matrix client', async () => {
    vi.mocked(mockClient.getDevices).mockResolvedValue({
      devices: [
        { device_id: 'DEV1', display_name: 'Chrome' },
        { device_id: 'DEV2', display_name: 'Firefox' },
      ],
    } as any)

    const { getDevices } = await import('@/matrix/verification')
    const devices = await getDevices()

    expect(mockClient.getDevices).toHaveBeenCalledOnce()
    expect(devices).toEqual([
      { device_id: 'DEV1', display_name: 'Chrome' },
      { device_id: 'DEV2', display_name: 'Firefox' },
    ])
  })

  it('should return an empty array when no devices exist', async () => {
    vi.mocked(mockClient.getDevices).mockResolvedValue({ devices: null } as any)

    const { getDevices } = await import('@/matrix/verification')
    const devices = await getDevices()

    expect(devices).toEqual([])
  })

  it('should return the current device ID', async () => {
    vi.mocked(mockClient.getDeviceId).mockReturnValue('MOCK_DEVICE')

    const { getCurrentDeviceId } = await import('@/matrix/verification')
    const deviceId = getCurrentDeviceId()

    expect(deviceId).toBe('MOCK_DEVICE')
    expect(mockClient.getDeviceId).toHaveBeenCalledOnce()
  })

  it('should return null when no device ID is available', async () => {
    vi.mocked(mockClient.getDeviceId).mockReturnValue(null)

    const { getCurrentDeviceId } = await import('@/matrix/verification')
    const deviceId = getCurrentDeviceId()

    expect(deviceId).toBeNull()
  })
})
