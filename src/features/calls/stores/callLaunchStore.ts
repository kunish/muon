import { shallowRef } from 'vue'

export type ContactCallMode = 'audio' | 'video'

export interface ContactCallLaunch {
  userId: string
  displayName?: string
  mode: ContactCallMode
}

const pendingContactCall = shallowRef<ContactCallLaunch | null>(null)

export function launchContactCall(call: ContactCallLaunch): void {
  pendingContactCall.value = call
}

export function consumePendingContactCall(): ContactCallLaunch | null {
  const call = pendingContactCall.value
  pendingContactCall.value = null
  return call
}
