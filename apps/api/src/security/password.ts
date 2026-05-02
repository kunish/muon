import { Buffer } from 'node:buffer'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url')
  const derived = await scrypt(password, salt, KEY_LENGTH)
  return `scrypt$${salt}$${Buffer.from(derived as Buffer).toString('base64url')}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [scheme, salt, encoded] = hash.split('$')
  if (scheme !== 'scrypt' || !salt || !encoded)
    return false

  const derived = await scrypt(password, salt, KEY_LENGTH)
  const expected = Buffer.from(encoded, 'base64url')
  const actual = Buffer.from(derived as Buffer)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
