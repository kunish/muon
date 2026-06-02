import type {
  ApprovalDecisionContract,
  ApprovalRecordContract,
  ApprovalStatusContract,
  ApprovalTemplate,
  CreateApprovalRequest,
} from '@muon/enterprise-contracts'
import { fetch as desktopFetch } from '@/desktop/http'
import { getClient } from '@/matrix/client'

const API_BASE = import.meta.env.VITE_MUON_API_BASE_URL as string | undefined

// 单一契约来源：与 apps/api 共用 @muon/enterprise-contracts 的审批类型
export type BackendApprovalStatus = ApprovalStatusContract
export type BackendApprovalDecision = ApprovalDecisionContract
export type BackendApproval = ApprovalRecordContract
export type { ApprovalTemplate, CreateApprovalRequest }

function accessToken(): string {
  return getClient().getAccessToken() ?? ''
}

/** 审批走应用自带后端(apps/api)的条件:配置了 API 基址且已登录 */
export function isApprovalsBackendConfigured(): boolean {
  return Boolean(API_BASE) && Boolean(accessToken())
}

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${accessToken()}`, 'content-type': 'application/json' }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await desktopFetch(`${API_BASE}${path}`, { ...init, headers: authHeaders() })
  if (!response.ok) throw new Error(`approvals api ${path} failed: ${response.status}`)
  return (await response.json()) as T
}

export async function fetchApprovals(): Promise<BackendApproval[]> {
  return (await requestJson<{ approvals: BackendApproval[] }>('/api/approvals')).approvals
}

export async function fetchApprovalTemplates(): Promise<ApprovalTemplate[]> {
  return (await requestJson<{ templates: ApprovalTemplate[] }>('/api/approvals/templates')).templates
}

export async function createApproval(input: CreateApprovalRequest): Promise<BackendApproval> {
  return (
    await requestJson<{ approval: BackendApproval }>('/api/approvals', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).approval
}

export async function decideApproval(id: string, decision: BackendApprovalDecision): Promise<BackendApproval> {
  return (
    await requestJson<{ approval: BackendApproval }>(`/api/approvals/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    })
  ).approval
}

export async function transferApproval(id: string, handler: string): Promise<BackendApproval> {
  return (
    await requestJson<{ approval: BackendApproval }>(`/api/approvals/${encodeURIComponent(id)}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ handler }),
    })
  ).approval
}

export async function commentApproval(id: string, comment: string): Promise<BackendApproval> {
  return (
    await requestJson<{ approval: BackendApproval }>(`/api/approvals/${encodeURIComponent(id)}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    })
  ).approval
}
