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

export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text()
  return text ? JSON.parse(text) : {}
}
