import type { SerializedFetchBody, SerializedFetchRequest, SerializedFetchResponse } from './bridge'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { getDesktopBridge } from './bridge'

type DesktopRequestInit = RequestInit & {
  connectTimeout?: number
}

function mergeHeaders(input?: HeadersInit, init?: HeadersInit): Array<[string, string]> | undefined {
  const headers = new Headers(input)
  if (init) {
    new Headers(init).forEach((value, key) => {
      headers.set(key, value)
    })
  }

  const entries = Array.from(headers.entries())
  return entries.length > 0 ? entries : undefined
}

function cloneArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function serializeBodyEffect(body: BodyInit | null | undefined): DesktopEffect<SerializedFetchBody | undefined> {
  return Effect.gen(function* () {
    if (body == null) return undefined

    if (typeof body === 'string') return { kind: 'text', value: body }

    if (body instanceof URLSearchParams) return { kind: 'text', value: body.toString() }

    if (body instanceof Blob) return { kind: 'bytes', value: yield* fromPromise(() => body.arrayBuffer()) }

    if (body instanceof ArrayBuffer) return { kind: 'bytes', value: body }

    if (ArrayBuffer.isView(body)) return { kind: 'bytes', value: cloneArrayBuffer(body) }

    const request = new Request('https://muon.local/', { body, method: 'POST' })
    return { kind: 'bytes', value: yield* fromPromise(() => request.arrayBuffer()) }
  })
}

function serializeRequestEffect(
  input: RequestInfo | URL,
  init?: DesktopRequestInit,
): DesktopEffect<SerializedFetchRequest> {
  return Effect.gen(function* () {
    const request = input instanceof Request ? input : undefined
    const url = request?.url ?? input.toString()
    const requestBody =
      request && request.method !== 'GET' && request.method !== 'HEAD'
        ? yield* fromPromise(() => request.clone().blob())
        : undefined
    const body = yield* serializeBodyEffect(init?.body ?? requestBody)
    const headers = mergeHeaders(request?.headers, init?.headers)

    return {
      init: {
        body,
        headers,
        method: init?.method ?? request?.method,
        redirect: init?.redirect ?? request?.redirect,
      },
      url,
    }
  })
}

function responseFromSerialized(response: SerializedFetchResponse): Response {
  return new Response(response.body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function withAbortEffect<T>(promise: Promise<T>, signal?: AbortSignal | null): DesktopEffect<T> {
  if (!signal) return fromPromise(() => promise)

  if (signal.aborted)
    return fromSync(() => {
      throw new DOMException('The operation was aborted.', 'AbortError')
    })

  return fromPromise(
    () =>
      new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
        signal.addEventListener('abort', onAbort, { once: true })
        promise.then(resolve, reject).finally(() => {
          signal.removeEventListener('abort', onAbort)
        })
      }),
  )
}

export function fetchEffect(input: RequestInfo | URL, init?: DesktopRequestInit): DesktopEffect<Response> {
  return Effect.gen(function* () {
    const bridge = getDesktopBridge()
    if (!bridge) return yield* fromPromise(() => globalThis.fetch(input, init))

    const request = yield* serializeRequestEffect(input, init)
    const response = yield* withAbortEffect(bridge.fetch(request), init?.signal)
    return responseFromSerialized(response)
  })
}

export function fetch(input: RequestInfo | URL, init?: DesktopRequestInit): Promise<Response> {
  return runDesktopEffect(fetchEffect(input, init))
}
