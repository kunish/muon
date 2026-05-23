import type { MatrixSession } from '@muon/enterprise-contracts'

export type SignOutReason = 'user-initiated' | 'enterprise-revoked' | 'app-shutdown'

export interface SignInEvent {
  session: MatrixSession
}

export interface SignOutEvent {
  reason: SignOutReason
}

export interface SessionSubscriber {
  onSignIn?: (event: SignInEvent) => void | Promise<void>
  onSignOut?: (event: SignOutEvent) => void | Promise<void>
}

const subscribers = new Set<SessionSubscriber>()
let currentSession: MatrixSession | null = null

function notifySubscriber<Event>(
  subscriber: SessionSubscriber,
  handler: ((event: Event) => void | Promise<void>) | undefined,
  event: Event,
): void {
  if (!handler)
    return

  try {
    const result = handler.call(subscriber, event)
    if (result instanceof Promise) {
      result.catch((err) => {
        console.warn('[auth] session lifecycle subscriber failed', err)
      })
    }
  }
  catch (err) {
    console.warn('[auth] session lifecycle subscriber failed', err)
  }
}

export function registerSessionSubscriber(subscriber: SessionSubscriber): () => void {
  subscribers.add(subscriber)

  if (currentSession) {
    notifySubscriber(subscriber, subscriber.onSignIn, {
      session: currentSession,
    })
  }

  return () => {
    subscribers.delete(subscriber)
  }
}

export function emitSignIn(session: MatrixSession): void {
  currentSession = session
  for (const subscriber of [...subscribers]) {
    notifySubscriber(subscriber, subscriber.onSignIn, { session })
  }
}

export function emitSignOut(reason: SignOutReason): void {
  currentSession = null
  for (const subscriber of [...subscribers]) {
    notifySubscriber(subscriber, subscriber.onSignOut, { reason })
  }
}

export function __resetLifecycleEventsForTests(): void {
  subscribers.clear()
  currentSession = null
}
