import type { ApiEffect } from '../../effect'
import type { AppendAuditLogInput, EnterpriseRepository } from '../../repository'
import { fromPromise, runApiEffect } from '../../effect'

export interface AuditService {
  record: (input: AppendAuditLogInput) => Promise<void>
}

export interface AuditEffectService {
  record: (input: AppendAuditLogInput) => ApiEffect<void>
}

export function createAuditEffectService(repository: EnterpriseRepository): AuditEffectService {
  return {
    record(input) {
      return fromPromise(() => repository.appendAuditLog(input))
    },
  }
}

export function createAuditService(repository: EnterpriseRepository): AuditService {
  const service = createAuditEffectService(repository)
  return {
    record: (input) => runApiEffect(service.record(input)),
  }
}
