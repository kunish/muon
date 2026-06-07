import { getClient } from '@/matrix/client'

export function useRoomPermissions(roomId: Ref<string | null> | string | null) {
  const room = computed(() => {
    const id = toValue(roomId)
    if (!id) return null
    return getClient()?.getRoom(id) ?? null
  })

  const myPowerLevel = computed(() => {
    if (!room.value) return 0
    const me = getClient()?.getUserId()
    if (!me) return 0
    const plEvent = room.value.currentState.getStateEvents('m.room.power_levels', '')
    const levels = plEvent?.getContent?.()
    return levels?.users?.[me] ?? levels?.users_default ?? 0
  })

  const isAdmin = computed(() => myPowerLevel.value >= 100)
  const isModerator = computed(() => myPowerLevel.value >= 50)

  const canKick = computed(() => {
    const plEvent = room.value?.currentState.getStateEvents('m.room.power_levels', '')
    const kickLevel = plEvent?.getContent()?.kick ?? 50
    return myPowerLevel.value >= kickLevel
  })

  const canBan = computed(() => {
    const plEvent = room.value?.currentState.getStateEvents('m.room.power_levels', '')
    const banLevel = plEvent?.getContent()?.ban ?? 50
    return myPowerLevel.value >= banLevel
  })

  const canInvite = computed(() => {
    const plEvent = room.value?.currentState.getStateEvents('m.room.power_levels', '')
    const inviteLevel = plEvent?.getContent()?.invite ?? 0
    return myPowerLevel.value >= inviteLevel
  })

  return { myPowerLevel, isAdmin, isModerator, canKick, canBan, canInvite }
}
