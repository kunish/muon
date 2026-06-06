import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ForwardDialog from '@/features/chat/components/ForwardDialog.vue'
import MessageActionBar from '@/features/chat/components/MessageActionBar.vue'
import TaskComposerDialog from '@/features/chat/components/TaskComposerDialog.vue'
import { chatStore, isHidden, isMessageSelected, resetChatStore } from '@/features/chat/stores/chatStore'
import {
  deferStore,
  resetDeferStore,
  resolveReminderDueAt,
  selectActiveDeferItems,
} from '@/features/chat/stores/deferStore'
import { resetTaskStore } from '@/features/chat/stores/taskStore'
import * as taskStoreModule from '@/features/chat/stores/taskStore'

const clipboardMocks = vi.hoisted(() => ({
  writeText: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}))

const matrixMocks = vi.hoisted(() => ({
  sendReaction: vi.fn(async () => {}),
  starMessage: vi.fn(async () => {}),
  unstarMessage: vi.fn(async () => {}),
  isMessageStarred: vi.fn(() => false),
  redactMessage: vi.fn(async () => {}),
}))

const askMock = vi.hoisted(() => vi.fn(async () => true))

vi.mock('@/desktop/dialog', () => ({
  ask: askMock,
}))

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getUserId: vi.fn(() => '@me:localhost'),
    getRooms: vi.fn(() => []),
  })),
}))

vi.mock('@matrix/index', () => ({
  redactMessage: matrixMocks.redactMessage,
  sendReaction: matrixMocks.sendReaction,
}))

vi.mock('@matrix/rooms', () => ({
  isMessagePinned: vi.fn(() => false),
  pinMessage: vi.fn(async () => {}),
  unpinMessage: vi.fn(async () => {}),
  isMessageStarred: matrixMocks.isMessageStarred,
  starMessage: matrixMocks.starMessage,
  unstarMessage: matrixMocks.unstarMessage,
}))

vi.mock('@matrix/messages', () => ({
  forwardMessages: vi.fn(async () => {}),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastMocks.error,
    success: toastMocks.success,
  },
}))

function createEventMock() {
  return {
    getSender: () => '@alice:localhost',
    getId: () => '$event-1',
    getContent: () => ({ body: 'hello world' }),
  }
}

function getBodyElement<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.body.querySelector(selector)
  expect(element).not.toBeNull()
  return element as T
}

async function clickBodyElement(selector: string) {
  getBodyElement(selector).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await nextTick()
  await flushPromises()
}

async function clickBodyButtonByText(text: string) {
  const button = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((element) =>
    element.textContent?.includes(text),
  )
  expect(button).not.toBeNull()
  button!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await nextTick()
  await flushPromises()
}

async function setBodyInputValue(selector: string, value: string) {
  const input = getBodyElement<HTMLInputElement>(selector)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  await flushPromises()
}

describe('messageActionBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetChatStore()
    localStorage.clear()
    resetTaskStore()
    resetDeferStore()
    document.body.innerHTML = ''
    clipboardMocks.writeText.mockReset()
    clipboardMocks.writeText.mockResolvedValue(undefined)
    toastMocks.error.mockReset()
    toastMocks.success.mockReset()
    matrixMocks.sendReaction.mockClear()
    matrixMocks.starMessage.mockClear()
    matrixMocks.unstarMessage.mockClear()
    matrixMocks.redactMessage.mockClear()
    matrixMocks.isMessageStarred.mockReset()
    matrixMocks.isMessageStarred.mockReturnValue(false)
    askMock.mockClear()
    askMock.mockResolvedValue(true)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardMocks.writeText,
      },
    })
  })

  it('opens the more menu without clipping it inside the toolbar', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('[data-testid="message-defer-trigger"]')).not.toBeNull()
    expect(wrapper.get('.action-bar').classes()).not.toContain('overflow-hidden')
  })

  it('flips the more menu above the trigger when bottom space is limited', async () => {
    const originalInnerHeight = window.innerHeight
    const originalInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })

    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const el = this as HTMLElement
      if (el.matches('[data-testid="message-more-trigger"]')) {
        return {
          x: 720,
          y: 560,
          left: 720,
          top: 560,
          right: 752,
          bottom: 592,
          width: 32,
          height: 32,
          toJSON: () => ({}),
        } as DOMRect
      }
      if (el.querySelector('[data-testid="message-defer-trigger"]')) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 180,
          bottom: 260,
          width: 180,
          height: 260,
          toJSON: () => ({}),
        } as DOMRect
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect
    })

    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    try {
      await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
      await flushPromises()

      const menu = document.body.querySelector('[data-testid="message-more-menu"]') as HTMLElement | null
      expect(menu).not.toBeNull()
      expect(menu?.classList.contains('fixed')).toBe(true)

      const top = Number.parseFloat(menu?.style.top || '')
      expect(top).toBeLessThan(560)
      expect(top + 260).toBeLessThanOrEqual(628)
    } finally {
      rectSpy.mockRestore()
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
      wrapper.unmount()
    }
  })

  it('keeps the teleported more menu hidden until its position is measured', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    wrapper
      .find('[data-testid="message-more-trigger"]')
      .element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    const openingMenu = getBodyElement('[data-testid="message-more-menu"]')

    expect(openingMenu.classList.contains('opacity-0')).toBe(true)
    expect(openingMenu.classList.contains('pointer-events-none')).toBe(true)

    await flushPromises()

    const positionedMenu = getBodyElement('[data-testid="message-more-menu"]')
    expect(positionedMenu.classList.contains('opacity-100')).toBe(true)
    expect(positionedMenu.classList.contains('pointer-events-auto')).toBe(true)
  })

  it('creates deferred item from more menu and keeps source room/event', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-defer-trigger"]')
    await clickBodyElement('[data-testid="message-defer-preset-tomorrow"]')

    const activeItems = selectActiveDeferItems(deferStore.state)
    expect(activeItems.length).toBe(1)
    expect(activeItems[0]).toMatchObject({
      roomId: '!room:test',
      eventId: '$event-1',
      status: 'deferred',
    })
  })

  it('opens the defer submenu in a dedicated fly-in panel', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-defer-trigger"]')

    const trigger = getBodyElement<HTMLButtonElement>('[data-testid="message-defer-trigger"]')
    const submenu = getBodyElement('[data-testid="message-defer-submenu"]')

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(submenu.classList.contains('origin-top-right')).toBe(true)
    expect(submenu.classList.contains('will-change-transform')).toBe(true)
    expect(submenu.classList.contains('transform-gpu')).toBe(true)
  })

  it('confirms when the message link is copied', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyButtonByText('复制消息链接')

    expect(clipboardMocks.writeText).toHaveBeenCalledWith('https://matrix.to/#/!room:test/$event-1')
    expect(toastMocks.success).toHaveBeenCalledWith('消息链接已复制')
  })

  it('confirms when the message text is copied', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyButtonByText('复制文本')

    expect(clipboardMocks.writeText).toHaveBeenCalledWith('hello world')
    expect(toastMocks.success).toHaveBeenCalledWith('消息文本已复制')
  })

  it('shows a visible error when the message link cannot be copied', async () => {
    clipboardMocks.writeText.mockRejectedValueOnce(new Error('permission denied'))
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyButtonByText('复制消息链接')

    expect(toastMocks.error).toHaveBeenCalledWith('无法复制消息链接')
  })

  it('shows a visible error when the message text cannot be copied', async () => {
    clipboardMocks.writeText.mockRejectedValueOnce(new Error('permission denied'))
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyButtonByText('复制文本')

    expect(toastMocks.error).toHaveBeenCalledWith('无法复制消息文本')
  })

  it('uses shared preset/custom defer time logic', async () => {
    const now = new Date('2026-03-05T08:00:00Z').getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)

    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-defer-trigger"]')
    await clickBodyElement('[data-testid="message-defer-preset-1h"]')

    expect(selectActiveDeferItems(deferStore.state).length).toBe(1)
    expect(selectActiveDeferItems(deferStore.state)[0]?.dueAt).toBe(resolveReminderDueAt({ preset: 'in-1-hour' }, now))

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-defer-trigger"]')
    await clickBodyElement('[data-testid="message-defer-custom-toggle"]')
    await setBodyInputValue('[data-testid="message-defer-custom-input"]', '2026-03-06T10:30')
    await clickBodyElement('[data-testid="message-defer-custom-submit"]')

    expect(selectActiveDeferItems(deferStore.state).length).toBe(2)
    const latestItem = selectActiveDeferItems(deferStore.state)[1]
    expect(latestItem).toBeTruthy()
    expect(Math.abs((latestItem?.dueAt ?? 0) - new Date('2026-03-06T10:30:00').getTime())).toBeLessThan(60_000)

    nowSpy.mockRestore()
  })

  it('create task from message opens task composer dialog', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-convert-task-trigger"]')

    expect(document.body.querySelector('[data-testid="task-composer-dialog"]')).not.toBeNull()
  })

  it('create task from message submits assignee/dueAt/status/sourceRef', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    const createTaskSpy = vi.spyOn(taskStoreModule, 'createTask')

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-convert-task-trigger"]')

    const composer = wrapper.findComponent(TaskComposerDialog)
    composer.vm.$emit('submit', {
      title: 'hello world',
      assignee: '@alice:localhost',
      dueAt: '2026-03-06T10:30',
      status: 'todo',
    })
    await nextTick()

    expect(createTaskSpy).toHaveBeenCalledTimes(1)
    expect(createTaskSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'hello world',
        assignee: '@alice:localhost',
        dueAt: '2026-03-06T10:30',
        status: 'todo',
        sourceRef: {
          roomId: '!room:test',
          eventId: '$event-1',
        },
      }),
    )

    createTaskSpy.mockRestore()
  })

  it('create task from message prevents duplicate submission while pending', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    let _resolveCreateTask: ((value: unknown) => void) | null = null
    const createTaskSpy = vi.spyOn(taskStoreModule, 'createTask').mockImplementation(() => {
      return new Promise((resolve) => {
        _resolveCreateTask = resolve
      }) as any
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-convert-task-trigger"]')

    const composer = wrapper.findComponent(TaskComposerDialog)
    const payload = {
      title: 'hello world',
      assignee: '@alice:localhost',
      dueAt: '2026-03-06T10:30',
      status: 'todo' as const,
    }
    composer.vm.$emit('submit', payload)
    composer.vm.$emit('submit', payload)
    await nextTick()

    expect(createTaskSpy).toHaveBeenCalledTimes(1)

    createTaskSpy.mockRestore()
  })

  it('sends a reaction when picking a quick emoji from the popover', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    // The first toolbar button is the quick-react popover toggle.
    await wrapper.find('.action-bar button').trigger('click')
    await flushPromises()

    const thumbsUp = wrapper.findAll('button').find((button) => button.text() === '👍')
    expect(thumbsUp).toBeTruthy()
    await thumbsUp!.trigger('click')
    await flushPromises()

    expect(matrixMocks.sendReaction).toHaveBeenCalledWith('!room:test', '$event-1', '👍')
  })

  it('opens the forward dialog from the toolbar', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="message-forward-trigger"]').trigger('click')
    await flushPromises()

    expect(wrapper.findComponent(ForwardDialog).exists()).toBe(true)
  })

  it('stars a message from the more menu', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-star-trigger"]')

    expect(matrixMocks.starMessage).toHaveBeenCalledWith('!room:test', '$event-1')
  })

  it('enters multi-select and selects the message from the more menu', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })
    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-multiselect-trigger"]')

    expect(chatStore.state.multiSelectMode).toBe(true)
    expect(isMessageSelected('$event-1')).toBe(true)
  })

  it('hides a message for me from the more menu', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })
    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-hide-trigger"]')

    expect(isHidden('$event-1')).toBe(true)
  })

  it('recalls own message after confirmation from the more menu', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: { ...createEventMock(), getSender: () => '@me:localhost' },
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-recall-trigger"]')

    expect(askMock).toHaveBeenCalled()
    expect(matrixMocks.redactMessage).toHaveBeenCalledWith('!room:test', '$event-1')
  })

  it('emits translate from the more menu for text messages', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
        canTranslate: true,
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()
    await clickBodyElement('[data-testid="message-translate-trigger"]')

    expect(wrapper.emitted('translate')).toBeTruthy()
  })

  it('hides the translate action for non-text messages', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('[data-testid="message-translate-trigger"]')).toBeNull()
  })
})
