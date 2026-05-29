import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DeviceList from '@/features/settings/components/DeviceList.vue'

const getDevices = vi.hoisted(() => vi.fn())

vi.mock('@matrix/verification', () => ({
  getDevices,
  getCurrentDeviceId: () => 'DEV1',
}))

describe('device list', () => {
  it('shows a loading state then the resolved device list', async () => {
    let resolve!: (value: unknown) => void
    getDevices.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r
      }),
    )

    const wrapper = mount(DeviceList)
    expect(wrapper.find('[data-testid="device-list-loading"]').exists()).toBe(true)

    resolve([{ device_id: 'DEV1', display_name: 'My Mac' }])
    await flushPromises()

    expect(wrapper.find('[data-testid="device-list-loading"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('My Mac')
  })

  it('shows an empty state when there are no devices', async () => {
    getDevices.mockResolvedValueOnce([])
    const wrapper = mount(DeviceList)
    await flushPromises()
    expect(wrapper.find('[data-testid="device-list-empty"]').exists()).toBe(true)
  })

  it('falls back to the empty state when device loading fails', async () => {
    getDevices.mockRejectedValueOnce(new Error('network'))
    const wrapper = mount(DeviceList)
    await flushPromises()
    expect(wrapper.find('[data-testid="device-list-empty"]').exists()).toBe(true)
  })
})
