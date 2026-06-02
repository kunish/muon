import { fetch as desktopFetch } from '@/desktop/http'
import { getClient } from '@/matrix/client'

const API_BASE = import.meta.env.VITE_MUON_API_BASE_URL as string | undefined

function accessToken(): string {
  return getClient().getAccessToken() ?? ''
}

/** 云录制走应用自带后端(apps/api Egress)的条件:配置了 API 基址且已登录 */
export function isRecordingBackendConfigured(): boolean {
  return Boolean(API_BASE) && Boolean(accessToken())
}

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${accessToken()}`, 'content-type': 'application/json' }
}

export async function startCloudRecording(roomName: string): Promise<{ egressId: string; fileUrl?: string }> {
  const response = await desktopFetch(`${API_BASE}/api/recordings/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ roomName }),
  })
  if (!response.ok) throw new Error(`start recording failed: ${response.status}`)
  return (await response.json()) as { egressId: string; fileUrl?: string }
}

export async function stopCloudRecording(egressId: string): Promise<void> {
  const response = await desktopFetch(`${API_BASE}/api/recordings/stop`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ egressId }),
  })
  if (!response.ok) throw new Error(`stop recording failed: ${response.status}`)
}
