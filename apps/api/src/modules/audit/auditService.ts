import type { AppendAuditLogInput, EnterpriseRepository } from '../../repository'

export interface AuditService {
  record: (input: AppendAuditLogInput) => Promise<void>
}

export function createAuditService(repository: EnterpriseRepository): AuditService {
  return {
    async record(input) {
      await repository.appendAuditLog(input)
    },
  }
}
