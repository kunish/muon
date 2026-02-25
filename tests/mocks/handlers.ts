import { http, HttpResponse } from 'msw'

const BASE = 'https://matrix.localhost/_matrix'

export const handlers = [
  http.post(`${BASE}/client/v3/login`, () => {
    return HttpResponse.json({
      access_token: 'mock_token',
      user_id: '@test:localhost',
      device_id: 'MOCK_DEVICE',
    })
  }),

  http.get(`${BASE}/client/v3/sync`, () => {
    return HttpResponse.json({
      next_batch: 'mock_batch_1',
      rooms: { join: {}, invite: {}, leave: {} },
      presence: { events: [] },
    })
  }),

  http.put(`${BASE}/client/v3/rooms/:roomId/send/:eventType/:txnId`, () => {
    return HttpResponse.json({ event_id: `$${Date.now()}` })
  }),

  http.post(`${BASE}/media/v3/upload`, () => {
    return HttpResponse.json({ content_uri: 'mxc://localhost/mock_media' })
  }),

  http.post(`${BASE}/client/v3/user_directory/search`, () => {
    return HttpResponse.json({
      results: [
        { user_id: '@alice:localhost', display_name: 'Alice', avatar_url: null },
      ],
      limited: false,
    })
  }),
]
