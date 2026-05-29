import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'
import { getClient } from './client'

export type CallMode = 'audio' | 'video'

export const CALL_INVITE_EVENT = 'im.muon.call.invite'
export const CALL_ANSWER_EVENT = 'im.muon.call.answer'
export const CALL_HANGUP_EVENT = 'im.muon.call.hangup'

export interface CallInvitePayload {
  /** 唯一通话标识，也用作 LiveKit roomName */
  callId: string
  livekitRoom: string
  mode: CallMode
}

function sendCallEventEffect(roomId: string, type: string, content: Record<string, unknown>): DesktopEffect<void> {
  // sendEvent 的重载按已知事件类型推断 content；自定义类型需用宽松签名
  const sendEvent = getClient().sendEvent as (
    roomId: string,
    type: string,
    content: Record<string, unknown>,
  ) => Promise<{ event_id: string }>
  return fromPromise(() => sendEvent(roomId, type, content)).pipe(Effect.asVoid)
}

/** 主叫发起：通知对端可加入的 LiveKit 房间 */
export function sendCallInvite(roomId: string, payload: CallInvitePayload): Promise<void> {
  return runDesktopEffect(
    sendCallEventEffect(roomId, CALL_INVITE_EVENT, {
      callId: payload.callId,
      livekitRoom: payload.livekitRoom,
      mode: payload.mode,
    }),
  )
}

/** 被叫接听 */
export function sendCallAnswer(roomId: string, callId: string): Promise<void> {
  return runDesktopEffect(sendCallEventEffect(roomId, CALL_ANSWER_EVENT, { callId }))
}

/** 挂断 / 拒绝 / 取消 */
export function sendCallHangup(roomId: string, callId: string, reason?: string): Promise<void> {
  return runDesktopEffect(sendCallEventEffect(roomId, CALL_HANGUP_EVENT, { callId, ...(reason ? { reason } : {}) }))
}
