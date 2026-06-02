import { MsgType } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendTextMessage } from '@/matrix/messages/senders'

const sendMessage = vi.fn(async () => ({ event_id: '$evt:localhost' }))

vi.mock('@/matrix/client', () => ({
  getClient: () => ({ sendMessage }),
}))

describe('sendTextMessage urgent option', () => {
  beforeEach(() => {
    sendMessage.mockClear()
  })

  it('does not include the urgent flag when option is omitted', async () => {
    await sendTextMessage('!room:localhost', 'hello')

    const [, content] = sendMessage.mock.calls[0]!
    expect((content as Record<string, unknown>)['xyz.muon.urgent']).toBeUndefined()
  })

  it('attaches xyz.muon.urgent: true when urgent is true', async () => {
    await sendTextMessage('!room:localhost', 'deploy now', undefined, { urgent: true })

    const [, content] = sendMessage.mock.calls[0]!
    expect((content as Record<string, unknown>)['xyz.muon.urgent']).toBe(true)
  })

  it('preserves formatted_body alongside the urgent flag', async () => {
    await sendTextMessage('!room:localhost', 'hi', '<p><strong>hi</strong></p>', { urgent: true })

    const [, content] = sendMessage.mock.calls[0]!
    expect(content).toMatchObject({
      msgtype: MsgType.Text,
      body: 'hi',
      format: 'org.matrix.custom.html',
      'xyz.muon.urgent': true,
    })
    expect((content as Record<string, string>).formatted_body).toContain('<strong>hi</strong>')
  })
})
