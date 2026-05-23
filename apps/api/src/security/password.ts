import { Buffer } from 'node:buffer'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { Effect } from 'effect'
import { fromPromise, runApiEffect } from '../effect'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

export function hashPasswordEffect(password: string) {
  return Effect.gen(function* () {
    const salt = randomBytes(16).toString('base64url')
    const derived = yield* fromPromise(() => scrypt(password, salt, KEY_LENGTH))
    return `scrypt$${salt}$${Buffer.from(derived as Buffer).toString('base64url')}`
  })
}

export function hashPassword(password: string): Promise<string> {
  return runApiEffect(hashPasswordEffect(password))
}

export function verifyPasswordEffect(password: string, hash: string) {
  return Effect.gen(function* () {
    const [scheme, salt, encoded] = hash.split('$')
    if (scheme !== 'scrypt' || !salt || !encoded) return false

    const derived = yield* fromPromise(() => scrypt(password, salt, KEY_LENGTH))
    const expected = Buffer.from(encoded, 'base64url')
    const actual = Buffer.from(derived as Buffer)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  })
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return runApiEffect(verifyPasswordEffect(password, hash))
}
