import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorkItemAssigneePicker from '@/features/projects/components/WorkItemAssigneePicker.vue'
import { mockClient } from '../mocks/matrix'

describe('workItemAssigneePicker', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockClient.searchUserDirectory.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('selects an assignee from the local contact list', async () => {
    const wrapper = mount(WorkItemAssigneePicker)

    await flushPromises()
    await wrapper.get('[data-testid="project-assignee-search"]').trigger('focus')

    await wrapper.get('[data-testid="project-assignee-option-@alice:localhost"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['@alice:localhost']])
  })

  it('clears the selected assignee', async () => {
    const wrapper = mount(WorkItemAssigneePicker, {
      props: {
        modelValue: '@alice:localhost',
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-testid="project-assignee-selected"]').text()).toContain('小红')

    await wrapper.get('[data-testid="project-assignee-clear"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[undefined]])
  })

  it('searches the Matrix directory before selecting an assignee', async () => {
    vi.useFakeTimers()
    mockClient.searchUserDirectory.mockResolvedValueOnce({
      results: [
        {
          user_id: '@zoe:localhost',
          display_name: 'Zoe',
          avatar_url: null,
        },
      ],
      limited: false,
    })

    const wrapper = mount(WorkItemAssigneePicker)

    await wrapper.get('[data-testid="project-assignee-search"]').trigger('focus')
    await wrapper.get('[data-testid="project-assignee-search"]').setValue('Zoe')
    await vi.advanceTimersByTimeAsync(210)
    await flushPromises()

    await wrapper.get('[data-testid="project-assignee-option-@zoe:localhost"]').trigger('click')

    expect(mockClient.searchUserDirectory).toHaveBeenCalledWith({ term: 'Zoe', limit: 8 })
    expect(wrapper.emitted('update:modelValue')).toEqual([['@zoe:localhost']])
  })
})
