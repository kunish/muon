import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('electron security config', () => {
  it('declares a renderer CSP that avoids Electron unsafe-eval warnings', () => {
    const indexHtml = readSource('index.html')
    const csp = indexHtml.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/)?.[1]

    expect(csp).toBeDefined()
    expect(csp).toContain('default-src \'self\'')
    expect(csp).toContain('script-src \'self\'')
    expect(csp).toContain('connect-src \'self\' http: https: ws: wss:')
    expect(csp).toContain('object-src \'none\'')
    expect(csp).not.toContain('unsafe-eval')
  })

  it('keeps renderer access behind the Electron preload bridge', () => {
    const mainProcess = readSource('electron/main.ts')

    expect(mainProcess).toContain('contextIsolation: true')
    expect(mainProcess).toContain('nodeIntegration: false')
    expect(mainProcess).toContain('preload: getPreloadEntry()')
  })

  it('handles manual redirects without using net.fetch manual mode directly', () => {
    const mainProcess = readSource('electron/main.ts')

    expect(mainProcess).toContain('fetchManualRedirectResponse')
    expect(mainProcess).toContain('request.init?.redirect === \'manual\'')
    expect(mainProcess).toContain('manualRequest.on(\'redirect\'')
    expect(mainProcess).not.toContain('net.fetch(request.url, normalizeFetchInit(request.init))')
  })
})
