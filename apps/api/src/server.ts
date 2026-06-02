import type { IncomingMessage } from 'node:http'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import process from 'node:process'
import { Effect } from 'effect'
import { readEnterpriseApiConfig } from './config'
import { createPostgresEnterpriseRepository } from './db/postgresRepository'
import { fromPromise, fromSync, runApiEffect } from './effect'
import { createPostgresApprovalStore } from './modules/approvals/postgresApprovalStore'
import { createPostgresDepartmentStore } from './modules/departments/postgresDepartmentStore'
import { createConduitProvisioningAdapter } from './modules/matrix/conduitAdapter'
import { createS3MediaStorage } from './modules/media/mediaStorage'
import { egressServiceFromConfig } from './modules/recordings/egressService'
import { createEnterpriseHttpEffectHandler } from './routes'

const config = readEnterpriseApiConfig()
const port = Number(new URL(config.apiBaseUrl).port || 8787)

class RequestBodyTooLargeError extends Error {}

function handleIncomingRequest(incoming: IncomingMessage) {
  return Effect.gen(function* () {
    const uploadBodyLimit = mediaUploadBodyLimit(incoming)
    const chunks = yield* readIncomingChunksEffect(incoming, uploadBodyLimit)

    const request = new Request(new URL(incoming.url ?? '/', config.apiBaseUrl), {
      body: incoming.method === 'GET' || incoming.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      headers: incoming.headers as HeadersInit,
      method: incoming.method,
    })
    return request
  })
}

function mediaUploadBodyLimit(incoming: IncomingMessage): number | undefined {
  const pathname = new URL(incoming.url ?? '/', config.apiBaseUrl).pathname
  return incoming.method === 'POST' && pathname === '/api/media/upload' ? config.maxMediaUploadBytes : undefined
}

function requestBodyTooLarge(maxBytes: number): RequestBodyTooLargeError {
  return new RequestBodyTooLargeError(`Media file exceeds ${maxBytes} bytes`)
}

function readIncomingChunksEffect(incoming: IncomingMessage, maxBytes?: number) {
  return fromPromise(
    () =>
      new Promise<Buffer[]>((resolve, reject) => {
        const chunks: Buffer[] = []
        let totalBytes = 0
        let settled = false

        function cleanup(): void {
          incoming.off('data', onData)
          incoming.off('end', onEnd)
          incoming.off('error', onError)
        }

        function rejectTooLarge(): void {
          if (settled || !maxBytes) return
          settled = true
          cleanup()
          incoming.pause()
          reject(requestBodyTooLarge(maxBytes))
        }

        function onData(chunk: Buffer | string): void {
          if (settled) return
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          totalBytes += buffer.byteLength
          if (maxBytes && totalBytes > maxBytes) {
            rejectTooLarge()
            return
          }
          chunks.push(buffer)
        }

        function onEnd(): void {
          if (settled) return
          settled = true
          cleanup()
          resolve(chunks)
        }

        function onError(error: Error): void {
          if (settled) return
          settled = true
          cleanup()
          reject(error)
        }

        const contentLength = Number(incoming.headers['content-length'] ?? '')
        if (maxBytes && Number.isFinite(contentLength) && contentLength > maxBytes) {
          rejectTooLarge()
          return
        }

        incoming.on('data', onData)
        incoming.on('end', onEnd)
        incoming.on('error', onError)
      }),
  )
}

function mainEffect() {
  return Effect.gen(function* () {
    const repository = yield* fromPromise(() => createPostgresEnterpriseRepository(config.databaseUrl))
    const approvalStore = yield* fromPromise(() => createPostgresApprovalStore(config.databaseUrl))
    const departmentStore = yield* fromPromise(() => createPostgresDepartmentStore(config.databaseUrl))
    const mediaStorage = config.mediaStorage ? createS3MediaStorage(config.mediaStorage) : undefined
    const handler = createEnterpriseHttpEffectHandler({
      corsAllowedOrigins: config.corsAllowedOrigins,
      mediaStorage,
      maxMediaUploadBytes: config.maxMediaUploadBytes,
      repository,
      approvalStore,
      departmentStore,
      matrix: createConduitProvisioningAdapter({ serverUrl: config.matrixServerUrl }),
      matrixServerUrl: config.matrixServerUrl,
      egressService: egressServiceFromConfig({
        livekitUrl: config.livekitUrl,
        apiKey: config.livekitApiKey,
        apiSecret: config.livekitApiSecret,
        storage: config.mediaStorage,
      }),
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
              if (error instanceof RequestBodyTooLargeError) {
                incoming.resume()
                if (!outgoing.headersSent)
                  outgoing.writeHead(413, { 'content-type': 'application/json; charset=utf-8' })
                outgoing.end(JSON.stringify({ error: error.message }))
                return
              }
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
