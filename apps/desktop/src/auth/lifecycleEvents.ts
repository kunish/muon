import type { MatrixSession } from '@muon/enterprise-contracts'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopSync } from '@/shared/lib/effect'

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

function notifySubscriberEffect<Event>(
  subscriber: SessionSubscriber,
  handler: ((event: Event) => void | Promise<void>) | undefined,
  event: Event,
): DesktopEffect<void> {
  return Effect.gen(function* () {
    if (!handler) return
    const result = yield* fromSync(() => handler.call(subscriber, event))
    if (result instanceof Promise) yield* fromPromise(() => result)
  }).pipe(Effect.catchAll((err) => fromSync(() => console.warn('[auth] session lifecycle subscriber failed', err))))
}

function notifySubscriber<Event>(
  subscriber: SessionSubscriber,
  handler: ((event: Event) => void | Promise<void>) | undefined,
  event: Event,
): void {
  runDesktopSync(notifySubscriberEffect(subscriber, handler, event))
}

export function registerSessionSubscriberEffect(subscriber: SessionSubscriber): DesktopEffect<() => void> {
  return fromSync(() => {
    subscribers.add(subscriber)

    if (currentSession) {
      notifySubscriber(subscriber, subscriber.onSignIn, {
        session: currentSession,
      })
    }

    return () => {
      subscribers.delete(subscriber)
    }
  })
}

export function registerSessionSubscriber(subscriber: SessionSubscriber): () => void {
  return runDesktopSync(registerSessionSubscriberEffect(subscriber))
}

export function emitSignInEffect(session: MatrixSession): DesktopEffect<void> {
  return fromSync(() => {
    currentSession = session
    for (const subscriber of [...subscribers]) {
      notifySubscriber(subscriber, subscriber.onSignIn, { session })
    }
  })
}

export function emitSignIn(session: MatrixSession): void {
  runDesktopSync(emitSignInEffect(session))
}

export function emitSignOutEffect(reason: SignOutReason): DesktopEffect<void> {
  return fromSync(() => {
    currentSession = null
    for (const subscriber of [...subscribers]) {
      notifySubscriber(subscriber, subscriber.onSignOut, { reason })
    }
  })
}

export function emitSignOut(reason: SignOutReason): void {
  runDesktopSync(emitSignOutEffect(reason))
}

export function __resetLifecycleEventsForTestsEffect(): DesktopEffect<void> {
  return fromSync(() => {
    subscribers.clear()
    currentSession = null
  })
}

export function __resetLifecycleEventsForTests(): void {
  runDesktopSync(__resetLifecycleEventsForTestsEffect())
}
