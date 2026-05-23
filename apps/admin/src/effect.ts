import { Cause, Effect, Exit } from 'effect'

export type AdminEffect<A> = Effect.Effect<A, unknown, never>

export function fromPromise<A>(evaluate: () => Promise<A>): AdminEffect<A> {
  return Effect.tryPromise({
    try: evaluate,
    catch: (error) => error,
  })
}

export function fromSync<A>(evaluate: () => A): AdminEffect<A> {
  return Effect.try({
    try: evaluate,
    catch: (error) => error,
  })
}

export async function runAdminEffect<A>(effect: AdminEffect<A>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect)
  if (Exit.isSuccess(exit)) return exit.value
  throw Cause.squash(exit.cause)
}
