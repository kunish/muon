import { describe, expect, it } from 'vitest'
import { runApiEffect } from '../../effect'
import { createDepartmentEffectService, createInMemoryDepartmentStore } from './departmentService'

function service() {
  return createDepartmentEffectService({ store: createInMemoryDepartmentStore() })
}

const ORG = 'org-1'

describe('departmentService', () => {
  it('creates departments scoped to an organization and lists them', async () => {
    const svc = service()
    const root = await runApiEffect(svc.create(ORG, { name: '研发中心' }))
    await runApiEffect(svc.create(ORG, { name: '客户端组', parentId: root.id }))
    await runApiEffect(svc.create('org-2', { name: '别的组织' }))

    const list = await runApiEffect(svc.list(ORG))
    expect(list.map((d) => d.name).sort()).toEqual(['客户端组', '研发中心'])
    expect(list.every((d) => d.organizationId === ORG)).toBe(true)
  })

  it('updates a department name and parent', async () => {
    const svc = service()
    const root = await runApiEffect(svc.create(ORG, { name: '研发' }))
    const child = await runApiEffect(svc.create(ORG, { name: '前端' }))

    const updated = await runApiEffect(svc.update(ORG, child.id, { name: '前端组', parentId: root.id }))
    expect(updated.name).toBe('前端组')
    expect(updated.parentId).toBe(root.id)
  })

  it('rejects making a department its own parent', async () => {
    const svc = service()
    const dept = await runApiEffect(svc.create(ORG, { name: '组' }))
    await expect(runApiEffect(svc.update(ORG, dept.id, { parentId: dept.id }))).rejects.toThrow()
  })

  it('promotes children to the grandparent when a department is deleted', async () => {
    const svc = service()
    const root = await runApiEffect(svc.create(ORG, { name: '根' }))
    const mid = await runApiEffect(svc.create(ORG, { name: '中', parentId: root.id }))
    const leaf = await runApiEffect(svc.create(ORG, { name: '叶', parentId: mid.id }))

    await runApiEffect(svc.remove(ORG, mid.id))

    const list = await runApiEffect(svc.list(ORG))
    expect(list.find((d) => d.id === mid.id)).toBeUndefined()
    expect(list.find((d) => d.id === leaf.id)?.parentId).toBe(root.id)
  })

  it('does not allow cross-organization updates', async () => {
    const svc = service()
    const dept = await runApiEffect(svc.create(ORG, { name: '组' }))
    await expect(runApiEffect(svc.update('org-2', dept.id, { name: 'x' }))).rejects.toThrow()
  })
})
