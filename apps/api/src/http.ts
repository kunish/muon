import { Effect } from 'effect'
import { fromPromise, fromSync } from './effect'

export interface JsonResponseInit extends ResponseInit {
  status?: number
}

export function jsonResponse(body: unknown, init: JsonResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })
}

export function readJsonBodyEffect(request: Request) {
  return Effect.gen(function* () {
    const text = yield* fromPromise(() => request.text())
    return text ? yield* fromSync(() => JSON.parse(text) as unknown) : {}
  })
}
