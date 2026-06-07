import { describe, expect, it } from 'vitest'
import { getWorkspaceAppForPath, workspaceApps } from '@/app/components/workspace/navigation'
import router from '@/app/router'

describe('workspace navigation', () => {
  it('lists app-first workspace entries in display order', () => {
    // 飞书风格应用栏顺序：消息 → 日历 → 云文档 → 多维表格 → 思维笔记 → 工作台 → 通讯录 → 组织 → 公告 → 视频会议 → 妙记 → 会议室 → 邮箱 → 审批 → 问卷 → 汇报 → OKR → 任务 → 考勤 → 项目
    expect(workspaceApps.map((app) => app.id)).toEqual([
      'messages',
      'calendar',
      'docs',
      'bitable',
      'mindmap',
      'workplace',
      'contacts',
      'organization',
      'announcements',
      'calls',
      'minutes',
      'rooms',
      'email',
      'approvals',
      'survey',
      'reports',
      'okr',
      'tasks',
      'attendance',
      'projects',
      'settings',
    ])
  })

  it.each([
    ['/dm', 'messages'],
    ['/dm/!room%3Alocalhost', 'messages'],
    ['/server/!space%3Alocalhost/channel/!room%3Alocalhost', 'messages'],
    ['/contacts', 'contacts'],
    ['/organization', 'organization'],
    ['/organization/members', 'organization'],
    ['/announcements', 'announcements'],
    ['/calendar', 'calendar'],
    ['/calendar/team', 'calendar'],
    ['/docs', 'docs'],
    ['/docs/recent', 'docs'],
    ['/bitable', 'bitable'],
    ['/mindmap', 'mindmap'],
    ['/workplace', 'workplace'],
    ['/approvals', 'approvals'],
    ['/survey', 'survey'],
    ['/reports', 'reports'],
    ['/email', 'email'],
    ['/calls', 'calls'],
    ['/minutes', 'minutes'],
    ['/rooms', 'rooms'],
    ['/okr', 'okr'],
    ['/tasks', 'tasks'],
    ['/attendance', 'attendance'],
    ['/projects', 'projects'],
    ['/projects/demo', 'projects'],
    ['/settings', 'settings'],
  ])('maps %s to %s', (path, appId) => {
    expect(getWorkspaceAppForPath(path)?.id).toBe(appId)
  })

  it.each([
    ['/organization', 'organization'],
    ['/organization/members', 'organization-section'],
    ['/organization/groups', 'organization-section'],
  ])('keeps %s routable inside the workspace shell', (path, routeName) => {
    const route = router.resolve(path)

    expect(route.name).toBe(routeName)
    expect(route.matched.map((match) => match.path)).toContain('/')
  })
})
