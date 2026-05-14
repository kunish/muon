import { MsgType } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendTextMessage } from '@/matrix/messages/senders'

const sendMessage = vi.fn(async () => ({ event_id: '$evt:localhost' }))

vi.mock('@/matrix/client', () => ({
  getClient: () => ({ sendMessage }),
}))

describe('sendTextMessage silent option', () => {
  beforeEach(() => {
    sendMessage.mockClear()
  })

  it('does not include the silent flag when option is omitted', async () => {
    await sendTextMessage('!room:localhost', 'hello')

    expect(sendMessage).toHaveBeenCalledTimes(1)
    const [, content] = sendMessage.mock.calls[0]!
    expect(content).toMatchObject({ msgtype: MsgType.Text, body: 'hello' })
    expect((content as Record<string, unknown>)['org.matrix.msc4019.silent']).toBeUndefined()
  })

  it('attaches org.matrix.msc4019.silent: true when silent is true', async () => {
    await sendTextMessage('!room:localhost', 'hello', undefined, { silent: true })

    const [, content] = sendMessage.mock.calls[0]!
    expect((content as Record<string, unknown>)['org.matrix.msc4019.silent']).toBe(true)
  })

  it('preserves formatted_body alongside silent flag', async () => {
    await sendTextMessage('!room:localhost', 'hi', '<p><strong>hi</strong></p>', { silent: true })

    const [, content] = sendMessage.mock.calls[0]!
    expect(content).toMatchObject({
      'msgtype': MsgType.Text,
      'body': 'hi',
      'format': 'org.matrix.custom.html',
      'org.matrix.msc4019.silent': true,
    })
    expect((content as Record<string, string>).formatted_body).toContain('<strong>hi</strong>')
  })
})
