import { describe, expect, it } from 'vitest'
import { readDesktopSource } from '../helpers/paths'

describe('electron security config', () => {
  it('declares a renderer CSP that avoids Electron unsafe-eval warnings', () => {
    const indexHtml = readDesktopSource('index.html')
    const csp = indexHtml.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/)?.[1]

    expect(csp).toBeDefined()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("connect-src 'self' http: https: ws: wss:")
    expect(csp).toContain("object-src 'none'")
    expect(csp).not.toContain('unsafe-eval')
  })

  it('keeps renderer access behind the Electron preload bridge', () => {
    const mainProcess = readDesktopSource('electron/main.ts')

    expect(mainProcess).toContain('contextIsolation: true')
    expect(mainProcess).toContain('nodeIntegration: false')
    expect(mainProcess).toContain('sandbox: true')
    expect(mainProcess).toContain('preload: getPreloadEntry()')
  })

  it('handles manual redirects without using net.fetch manual mode directly', () => {
    const mainProcess = readDesktopSource('electron/main.ts')

    expect(mainProcess).toContain('fetchManualRedirectResponse')
    expect(mainProcess).toContain("request.init?.redirect === 'manual'")
    expect(mainProcess).toContain("manualRequest.on('redirect'")
    expect(mainProcess).not.toContain('net.fetch(request.url, normalizeFetchInit(request.init))')
  })

  it('validates external URLs and blocks dangerous protocols', () => {
    const mainProcess = readDesktopSource('electron/main.ts')

    expect(mainProcess).toContain('isValidExternalUrl')
    expect(mainProcess).toContain('http:')
    expect(mainProcess).toContain('https:')
    expect(mainProcess).toContain('Blocked opening URL with disallowed protocol')
  })

  it('validates file paths against path traversal', () => {
    const mainProcess = readDesktopSource('electron/main.ts')

    expect(mainProcess).toContain('validateFilePath')
    expect(mainProcess).toContain('Path traversal is not allowed')
  })

  it('disables DevTools in production', () => {
    const mainProcess = readDesktopSource('electron/main.ts')

    expect(mainProcess).toContain('devtools-opened')
    expect(mainProcess).toContain('closeDevTools()')
  })

  it('enforces session-level CSP in production', () => {
    const mainProcess = readDesktopSource('electron/main.ts')

    expect(mainProcess).toContain('content-security-policy')
    expect(mainProcess).toContain('object-src')
    expect(mainProcess).toContain('frame-src')
    expect(mainProcess).toContain('onHeadersReceived')
  })
})
