import type { CreateDepartmentRequest, Department, UpdateDepartmentRequest } from '@muon/enterprise-contracts'
import type { ApiEffect } from '../../effect'
import { randomUUID } from 'node:crypto'
import { createDepartmentRequestSchema, updateDepartmentRequestSchema } from '@muon/enterprise-contracts'
import { Effect } from 'effect'
import { fromPromise, fromSync } from '../../effect'

export interface DepartmentStore {
  listByOrganization: (organizationId: string) => Promise<Department[]>
  get: (id: string) => Promise<Department | null>
  save: (department: Department) => Promise<Department>
  delete: (id: string) => Promise<void>
}

/** 进程内部门仓储（开发/测试用；生产替换为 Postgres，接口不变） */
export function createInMemoryDepartmentStore(seed?: Department[]): DepartmentStore {
  const records = new Map<string, Department>()
  for (const department of seed ?? []) records.set(department.id, department)

  return {
    listByOrganization: (organizationId) =>
      Promise.resolve(
        [...records.values()]
          .filter((department) => department.organizationId === organizationId)
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    get: (id) => Promise.resolve(records.get(id) ?? null),
    save: (department) => {
      records.set(department.id, department)
      return Promise.resolve(department)
    },
    delete: (id) => {
      records.delete(id)
      return Promise.resolve()
    },
  }
}

export class DepartmentNotFoundError extends Error {
  constructor(id: string) {
    super(`department ${id} not found`)
  }
}

export interface DepartmentEffectService {
  list: (organizationId: string) => ApiEffect<Department[]>
  create: (organizationId: string, input: CreateDepartmentRequest) => ApiEffect<Department>
  update: (organizationId: string, id: string, input: UpdateDepartmentRequest) => ApiEffect<Department>
  remove: (organizationId: string, id: string) => ApiEffect<void>
}

function nowIso(): string {
  return new Date().toISOString()
}

export function createDepartmentEffectService({ store }: { store: DepartmentStore }): DepartmentEffectService {
  function loadInOrg(organizationId: string, id: string): ApiEffect<Department> {
    return Effect.gen(function* () {
      const department = yield* fromPromise(() => store.get(id))
      if (!department || department.organizationId !== organizationId) {
        return yield* Effect.fail(new DepartmentNotFoundError(id))
      }
      return department
    })
  }

  return {
    list: (organizationId) => fromPromise(() => store.listByOrganization(organizationId)),

    create(organizationId, input) {
      return Effect.gen(function* () {
        const parsed = yield* fromSync(() => createDepartmentRequestSchema.parse(input))
        const department: Department = {
          id: randomUUID(),
          organizationId,
          name: parsed.name,
          parentId: parsed.parentId ?? null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        return yield* fromPromise(() => store.save(department))
      })
    },

    update(organizationId, id, input) {
      return Effect.gen(function* () {
        const parsed = yield* fromSync(() => updateDepartmentRequestSchema.parse(input))
        const existing = yield* loadInOrg(organizationId, id)
        // 不允许将部门挂到自身之下，避免明显的环
        const nextParentId = parsed.parentId === undefined ? existing.parentId : parsed.parentId
        if (nextParentId === id) return yield* Effect.fail(new Error('department cannot be its own parent'))
        const next: Department = {
          ...existing,
          name: parsed.name ?? existing.name,
          parentId: nextParentId,
          updatedAt: nowIso(),
        }
        return yield* fromPromise(() => store.save(next))
      })
    },

    remove(organizationId, id) {
      return Effect.gen(function* () {
        const target = yield* loadInOrg(organizationId, id)
        // 删除时把子部门提升到被删部门的父级，保持树连通
        const siblings = yield* fromPromise(() => store.listByOrganization(organizationId))
        for (const child of siblings.filter((department) => department.parentId === id)) {
          yield* fromPromise(() => store.save({ ...child, parentId: target.parentId, updatedAt: nowIso() }))
        }
        yield* fromPromise(() => store.delete(id))
      })
    },
  }
}
