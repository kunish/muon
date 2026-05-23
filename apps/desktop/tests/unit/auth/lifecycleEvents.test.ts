import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetLifecycleEventsForTests, emitSignIn, emitSignOut, registerSessionSubscriber } from '@/auth/lifecycleEvents'

const matrixSession = {
  serverUrl: 'https://matrix.example.com',
  userId: '@u:example.com',
  accessToken: 'ma',
  deviceId: 'DEV',
}

describe('session lifecycle events', () => {
  beforeEach(() => {
    __resetLifecycleEventsForTests()
  })

  it('notifies registered subscribers and stops after unregister', () => {
    const onSignIn = vi.fn()
    const onSignOut = vi.fn()
    const unregister = registerSessionSubscriber({ onSignIn, onSignOut })

    emitSignIn(matrixSession)
    emitSignOut('user-initiated')

    expect(onSignIn).toHaveBeenCalledWith({ session: matrixSession })
    expect(onSignOut).toHaveBeenCalledWith({ reason: 'user-initiated' })

    unregister()
    emitSignIn(matrixSession)
    emitSignOut('app-shutdown')

    expect(onSignIn).toHaveBeenCalledTimes(1)
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('replays the current signed-in session to late subscribers', () => {
    emitSignIn(matrixSession)
    const onSignIn = vi.fn()

    registerSessionSubscriber({ onSignIn })

    expect(onSignIn).toHaveBeenCalledWith({ session: matrixSession })
  })
})
