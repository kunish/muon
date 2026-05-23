import { Cause, Effect, Exit } from 'effect'

export type DesktopEffect<A> = Effect.Effect<A, unknown, never>

export function fromPromise<A>(evaluate: () => PromiseLike<A> | A): DesktopEffect<A> {
  return Effect.tryPromise({
    try: () => Promise.resolve(evaluate()),
    catch: (error) => error,
  })
}

export function fromSync<A>(evaluate: () => A): DesktopEffect<A> {
  return Effect.try({
    try: evaluate,
    catch: (error) => error,
  })
}

export async function runDesktopEffect<A>(effect: DesktopEffect<A>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect)
  if (Exit.isSuccess(exit)) return exit.value
  throw Cause.squash(exit.cause)
}

export function runDesktopSync<A>(effect: DesktopEffect<A>): A {
  const exit = Effect.runSyncExit(effect)
  if (Exit.isSuccess(exit)) return exit.value
  throw Cause.squash(exit.cause)
}
