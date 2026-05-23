import type { SerializedFetchBody, SerializedFetchRequest, SerializedFetchResponse } from './bridge'
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

async function serializeBody(body: BodyInit | null | undefined): Promise<SerializedFetchBody | undefined> {
  if (body == null)
    return undefined

  if (typeof body === 'string')
    return { kind: 'text', value: body }

  if (body instanceof URLSearchParams)
    return { kind: 'text', value: body.toString() }

  if (body instanceof Blob)
    return { kind: 'bytes', value: await body.arrayBuffer() }

  if (body instanceof ArrayBuffer)
    return { kind: 'bytes', value: body }

  if (ArrayBuffer.isView(body))
    return { kind: 'bytes', value: cloneArrayBuffer(body) }

  const request = new Request('https://muon.local/', { body, method: 'POST' })
  return { kind: 'bytes', value: await request.arrayBuffer() }
}

async function serializeRequest(input: RequestInfo | URL, init?: DesktopRequestInit): Promise<SerializedFetchRequest> {
  const request = input instanceof Request ? input : undefined
  const url = request?.url ?? input.toString()
  const requestBody = request && request.method !== 'GET' && request.method !== 'HEAD'
    ? await request.clone().blob()
    : undefined
  const body = await serializeBody(init?.body ?? requestBody)
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
}

function responseFromSerialized(response: SerializedFetchResponse): Response {
  return new Response(response.body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  })
}

async function withAbort<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal)
    return promise

  if (signal.aborted)
    throw new DOMException('The operation was aborted.', 'AbortError')

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort)
    })
  })
}

export async function fetch(input: RequestInfo | URL, init?: DesktopRequestInit): Promise<Response> {
  const bridge = getDesktopBridge()
  if (!bridge)
    return globalThis.fetch(input, init)

  const request = await serializeRequest(input, init)
  const response = await withAbort(bridge.fetch(request), init?.signal)
  return responseFromSerialized(response)
}
