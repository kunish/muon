import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoleManager from '@/features/server/components/RoleManager.vue'
import ServerOverview from '@/features/server/components/ServerOverview.vue'

const serverSettingsClient = vi.hoisted(() => ({
  getRoom: vi.fn(() => ({
    currentState: {
      getStateEvents: vi.fn(() => null),
    },
  })),
  mxcUrlToHttp: vi.fn(),
  sendStateEvent: vi.fn().mockResolvedValue({}),
  setRoomName: vi.fn().mockResolvedValue(undefined),
  setRoomTopic: vi.fn().mockResolvedValue(undefined),
  uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://localhost/avatar' }),
}))

vi.mock('@/matrix/client', () => ({
  getClient: () => serverSettingsClient,
}))

function mountServerOverview() {
  return mount(ServerOverview, {
    props: {
      serverId: '!server:localhost',
      serverName: '研发空间',
      serverTopic: '团队协作',
    },
  })
}

describe('server settings localization', () => {
  beforeEach(() => {
    serverSettingsClient.getRoom.mockClear()
    serverSettingsClient.sendStateEvent.mockClear()
  })

  it('uses Chinese placeholders in the server overview form', () => {
    const wrapper = mountServerOverview()
    const textInputs = wrapper.findAll('input').filter((input) => input.attributes('type') !== 'file')

    expect(textInputs[0].attributes('placeholder')).toBe('输入服务器名称')
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('输入服务器描述')
    expect(wrapper.text()).not.toContain('Server name')
    expect(wrapper.text()).not.toContain('Tell people about your server')
  })

  it('uses Chinese default role labels and help text', async () => {
    const wrapper = mount(RoleManager, {
      props: {
        serverId: '!server:localhost',
      },
    })
    await flushPromises()

    expect(wrapper.get('input').attributes('placeholder')).toBe('输入角色名称')
    expect(wrapper.text()).toContain('拥有者')
    expect(wrapper.text()).toContain('管理员')
    expect(wrapper.text()).toContain('协管员')
    expect(wrapper.text()).toContain('成员')
    expect(wrapper.text()).toContain('默认')
    expect(wrapper.text()).toContain('较高等级可以管理较低等级的成员')
    expect(wrapper.text()).not.toContain('Role name')
    expect(wrapper.text()).not.toContain('Owner')
    expect(wrapper.text()).not.toContain('default')
    expect(wrapper.text()).not.toContain('Higher levels')
  })
})
