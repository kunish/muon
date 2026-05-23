import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const helpersDir = dirname(fileURLToPath(import.meta.url))

export const desktopRoot = resolve(helpersDir, '..', '..')
export const repoRoot = resolve(desktopRoot, '..', '..')

export function readDesktopSource(path: string): string {
  return readFileSync(resolve(desktopRoot, path), 'utf8')
}

export function readRepoSource(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8')
}

export function readDesktopJson<T = unknown>(path: string): T {
  return JSON.parse(readDesktopSource(path)) as T
}

export function readRepoJson<T = unknown>(path: string): T {
  return JSON.parse(readRepoSource(path)) as T
}
