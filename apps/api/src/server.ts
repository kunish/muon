import type { IncomingMessage } from 'node:http'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import process from 'node:process'
import { Effect } from 'effect'
import { readEnterpriseApiConfig } from './config'
import { createPostgresEnterpriseRepository } from './db/postgresRepository'
import { fromPromise, fromSync, runApiEffect } from './effect'
import { createConduitProvisioningAdapter } from './modules/matrix/conduitAdapter'
import { createS3MediaStorage } from './modules/media/mediaStorage'
import { createEnterpriseHttpEffectHandler } from './routes'

const config = readEnterpriseApiConfig()
const port = Number(new URL(config.apiBaseUrl).port || 8787)

function handleIncomingRequest(incoming: IncomingMessage) {
  return Effect.gen(function* () {
    const chunks = yield* readIncomingChunksEffect(incoming)

    const request = new Request(new URL(incoming.url ?? '/', config.apiBaseUrl), {
      body: incoming.method === 'GET' || incoming.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      headers: incoming.headers as HeadersInit,
      method: incoming.method,
    })
    return request
  })
}

function readIncomingChunksEffect(incoming: IncomingMessage) {
  return fromPromise(
    () =>
      new Promise<Buffer[]>((resolve, reject) => {
        const chunks: Buffer[] = []
        incoming.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        incoming.on('end', () => resolve(chunks))
        incoming.on('error', reject)
      }),
  )
}

function mainEffect() {
  return Effect.gen(function* () {
    const repository = yield* fromPromise(() => createPostgresEnterpriseRepository(config.databaseUrl))
    const mediaStorage = config.mediaStorage ? createS3MediaStorage(config.mediaStorage) : undefined
    const handler = createEnterpriseHttpEffectHandler({
      mediaStorage,
      repository,
      matrix: createConduitProvisioningAdapter({ serverUrl: config.matrixServerUrl }),
      matrixServerUrl: config.matrixServerUrl,
    })

    createServer((incoming, outgoing) => {
      void runApiEffect(
        Effect.gen(function* () {
          const request = yield* handleIncomingRequest(incoming)
          const response = yield* handler.fetch(request)
          outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()))
          outgoing.end(Buffer.from(yield* fromPromise(() => response.arrayBuffer())))
        }).pipe(
          Effect.catchAll((error) =>
            fromSync(() => {
              console.error('[Muon API] request failed', error)
              if (!outgoing.headersSent) outgoing.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
              outgoing.end(JSON.stringify({ error: 'Internal server error' }))
            }),
          ),
        ),
      )
    }).listen(port, () => {
      console.warn(`Muon API listening on ${config.apiBaseUrl}`)
    })
  })
}

void runApiEffect(
  mainEffect().pipe(
    Effect.catchAll((error) =>
      fromSync(() => {
        console.error('[Muon API] failed to start', error)
        process.exitCode = 1
      }),
    ),
  ),
)
