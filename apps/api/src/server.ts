import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import process from 'node:process'
import { readEnterpriseApiConfig } from './config'
import { createPostgresEnterpriseRepository } from './db/postgresRepository'
import { createConduitProvisioningAdapter } from './modules/matrix/conduitAdapter'
import { createEnterpriseHttpHandler } from './routes'

const config = readEnterpriseApiConfig()
const port = Number(new URL(config.apiBaseUrl).port || 8787)

async function main(): Promise<void> {
  const repository = await createPostgresEnterpriseRepository(config.databaseUrl)
  const handler = createEnterpriseHttpHandler({
    repository,
    matrix: createConduitProvisioningAdapter({ serverUrl: config.matrixServerUrl }),
    matrixServerUrl: config.matrixServerUrl,
  })

  createServer(async (incoming, outgoing) => {
    const chunks: Buffer[] = []
    for await (const chunk of incoming)
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))

    const request = new Request(new URL(incoming.url ?? '/', config.apiBaseUrl), {
      body: incoming.method === 'GET' || incoming.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      headers: incoming.headers as HeadersInit,
      method: incoming.method,
    })
    const response = await handler.fetch(request)
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    outgoing.end(Buffer.from(await response.arrayBuffer()))
  }).listen(port, () => {
    console.warn(`Muon API listening on ${config.apiBaseUrl}`)
  })
}

void main().catch((error) => {
  console.error('[Muon API] failed to start', error)
  process.exitCode = 1
})
