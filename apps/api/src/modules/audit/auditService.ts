import type { ApiEffect } from '../../effect'
import type { AppendAuditLogInput, EnterpriseRepository } from '../../repository'
import { fromPromise } from '../../effect'

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
