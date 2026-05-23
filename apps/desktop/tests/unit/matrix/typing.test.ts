import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

describe('matrix typing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send typing indicator to the Matrix client', async () => {
    const { sendTyping } = await import('@/matrix/typing')
    await sendTyping('!room:localhost', true, 5000)

    expect(mockClient.sendTyping).toHaveBeenCalledWith('!room:localhost', true, 5000)
  })

  it('should send stopped-typing indicator with default timeout', async () => {
    const { sendTyping } = await import('@/matrix/typing')
    await sendTyping('!room:localhost', false)

    expect(mockClient.sendTyping).toHaveBeenCalledWith('!room:localhost', false, 5000)
  })

  it('should send typing with a custom timeout', async () => {
    const { sendTyping } = await import('@/matrix/typing')
    await sendTyping('!dm_alice:localhost', true, 15000)

    expect(mockClient.sendTyping).toHaveBeenCalledWith('!dm_alice:localhost', true, 15000)
  })
})
