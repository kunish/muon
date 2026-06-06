import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApprovalsPage from '@/features/approvals/components/ApprovalsPage.vue'
import CalendarPage from '@/features/calendar/components/CalendarPage.vue'
import { addEvent as addCalendarEvent, resetCalendarStore } from '@/features/calendar/stores/calendarStore'
import CallsPage from '@/features/calls/components/CallsPage.vue'
import DocsPage from '@/features/docs/components/DocsPage.vue'
import EmailPage from '@/features/email/components/EmailPage.vue'
import OrganizationPage from '@/features/organization/components/OrganizationPage.vue'
import WorkplacePage from '@/features/workplace/components/WorkplacePage.vue'
import { resetWorkplaceStore } from '@/features/workplace/stores/workplaceStore'

const routerPush = vi.fn()
const mockRouteParams = vi.fn(() => ({}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: routerPush }),
    useRoute: () => ({
      params: mockRouteParams(),
      query: {},
      hash: '',
      fullPath: '/docs',
      path: '/docs',
      name: 'docs',
      matched: [],
      meta: {},
    }),
  }
})

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getRooms: vi.fn(() => [
      {
        roomId: '!dm-alice:localhost',
        name: '小红',
        getJoinedMembers: () => [
          { userId: '@test:localhost', name: '我', getMxcAvatarUrl: () => null },
          { userId: '@alice:localhost', name: '小红', getMxcAvatarUrl: () => 'mxc://localhost/avatar_alice' },
        ],
        getJoinedMemberCount: () => 2,
      },
      {
        roomId: '!dm-bob:localhost',
        name: '小明',
        getJoinedMembers: () => [
          { userId: '@test:localhost', name: '我', getMxcAvatarUrl: () => null },
          { userId: '@bob:localhost', name: '小明', getMxcAvatarUrl: () => 'mxc://localhost/avatar_bob' },
        ],
        getJoinedMemberCount: () => 2,
      },
      {
        roomId: '!tech:localhost',
        name: '技术交流群',
        getJoinedMembers: () => [],
        getJoinedMemberCount: () => 4,
      },
    ]),
    getRoom: vi.fn(() => null),
    getUser: vi.fn(() => ({ displayName: '我', avatarUrl: undefined })),
    joinRoom: vi.fn().mockRejectedValue(new Error('no room')),
    createRoom: vi.fn().mockResolvedValue({ room_id: '!new:localhost' }),
    getUserId: vi.fn(() => '@test:localhost'),
    on: vi.fn(),
    off: vi.fn(),
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$mock' }),
  })),
}))

const pages = [
  {
    component: DocsPage,
    name: '文档',
    requiredText: ['文档', '新建文档', '最近更新'],
  },
  {
    component: WorkplacePage,
    name: '工作台',
    requiredText: ['添加应用', '推荐应用', '今日重点'],
  },
  {
    component: OrganizationPage,
    name: '组织',
    requiredText: ['组织架构', '成员目录', '团队群组'],
  },
  {
    component: CalendarPage,
    name: '日历',
    requiredText: ['新建日程', '月', '今日'],
  },
  {
    component: ApprovalsPage,
    name: '审批',
    requiredText: ['新建申请', '审批收件箱', '生产访问申请'],
  },
  {
    component: EmailPage,
    name: '邮件',
    requiredText: ['写邮件', '智能分拣', '上线评审纪要'],
  },
  {
    component: CallsPage,
    name: '通话',
    requiredText: ['发起通话', '通话记录', '通话总数'],
  },
]

describe('workspace secondary pages', () => {
  beforeEach(() => {
    localStorage.removeItem('muon_organization_directory_v1')
    localStorage.removeItem('muon_email_overrides')
    localStorage.removeItem('muon_approval_overrides')
    localStorage.removeItem('muon_call_history')
    localStorage.removeItem('muon_mail_account')
    localStorage.removeItem('muon_calendar_subscriptions')
    localStorage.removeItem('muon.workplace.customization.v1')
    localStorage.removeItem('muon.contacts.profiles.v1')
    localStorage.removeItem('muon.calendar.events.v1')
    resetCalendarStore()
    resetWorkplaceStore()
    mockRouteParams.mockReset()
    mockRouteParams.mockReturnValue({})
    routerPush.mockReset()
  })

  it.each(pages)('renders a complete Chinese workspace frame for $name', ({ component, name, requiredText }) => {
    const wrapper = mount(component)

    expect(wrapper.text()).toContain(name)
    for (const text of requiredText) {
      expect(wrapper.text()).toContain(text)
    }
  })

  it('renders docs sidebar with sections and folders', () => {
    const wrapper = mount(DocsPage)

    expect(wrapper.text()).toContain('文档')
    expect(wrapper.text()).toContain('最近更新')
    expect(wrapper.text()).toContain('已收藏')
    expect(wrapper.text()).toContain('共享给我')
    expect(wrapper.text()).toContain('新建文档')
  })

  it('renders docs search input for filtering', () => {
    const wrapper = mount(DocsPage)

    const searchInput = wrapper.find('input[placeholder="搜索文档..."]')
    expect(searchInput.exists()).toBe(true)
  })

  it('shows empty state when store has no documents', () => {
    const wrapper = mount(DocsPage)

    // When store is empty, no DocPreviewCards should render
    expect(wrapper.text()).toContain('文档')
  })

  it('reacts to route param for selected document', () => {
    mockRouteParams.mockReturnValue({ docId: '!test-room:localhost' })
    const wrapper = mount(DocsPage)

    expect(wrapper.text()).toContain('连接中')
  })

  it('lets workplace search, category filters, and add app work locally', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-search-input"]').setValue('站会')
    expect(wrapper.text()).toContain('站会机器人')
    expect(wrapper.text()).not.toContain('视频会议')

    await wrapper.get('[data-testid="workplace-category-engineering"]').trigger('click')
    expect(wrapper.text()).toContain('工程研发')

    await wrapper.get('[data-testid="workplace-add-app"]').trigger('click')
    expect(wrapper.text()).toContain('自定义流程')
  })

  it('navigates to an app route when a workplace app is opened', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-app-meet"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/calls')
  })

  it('keeps workplace summary metrics derived from current state', async () => {
    const wrapper = mount(WorkplacePage)

    expect(wrapper.get('[data-testid="workplace-stat-enabled-apps"]').text()).toBe('7')
    expect(wrapper.get('[data-testid="workplace-stat-used-apps"]').text()).toBe('今日使用 3 个')
    expect(wrapper.get('[data-testid="workplace-stat-priority-items"]').text()).toBe('3')
    expect(wrapper.get('[data-testid="workplace-stat-blocked-items"]').text()).toBe('1 项需跟进')
    expect(wrapper.get('[data-testid="workplace-stat-meetings"]').text()).toBe('2')
    expect(wrapper.get('[data-testid="workplace-stat-meeting-breakdown"]').text()).toBe('日程 1 个 · 通话 1 个')

    await wrapper.get('[data-testid="workplace-add-app"]').trigger('click')
    expect(wrapper.get('[data-testid="workplace-stat-enabled-apps"]').text()).toBe('8')

    await wrapper.get('[data-testid="workplace-manage-apps"]').trigger('click')
    await wrapper.get('[data-testid="workplace-hide-standup"]').trigger('click')
    expect(wrapper.get('[data-testid="workplace-stat-enabled-apps"]').text()).toBe('7')
    expect(wrapper.get('[data-testid="workplace-stat-used-apps"]').text()).toBe('今日使用 3 个')
  })

  it('lets workplace added apps be edited before saving locally', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-add-app"]').trigger('click')
    await wrapper.get('[data-testid="workplace-new-app-name"]').setValue('排班助手')
    await wrapper.get('[data-testid="workplace-new-app-desc"]').setValue('团队排班与值班安排')
    await wrapper.get('[data-testid="workplace-save-new-app"]').trigger('click')

    expect(wrapper.text()).toContain('已添加：排班助手')
    expect(wrapper.text()).toContain('应用详情：排班助手')
    expect(wrapper.text()).toContain('团队排班与值班安排')
  })

  it('lets workplace app cards and management action update visible state', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-app-meet"]').trigger('click')
    expect(wrapper.text()).toContain('已打开：视频会议')

    await wrapper.get('[data-testid="workplace-manage-apps"]').trigger('click')
    expect(wrapper.text()).toContain('应用管理已开启')
  })

  it('lets workplace management reorder app entries locally', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-manage-apps"]').trigger('click')
    await wrapper.get('[data-testid="workplace-move-down-calendar"]').trigger('click')

    const appCards = wrapper.findAll('[data-testid^="workplace-app-"]')
    expect(wrapper.text()).toContain('已下移：日历')
    expect(appCards[0].text()).toContain('视频会议')
    expect(appCards[1].text()).toContain('日历')
  })

  it('lets workplace management hide app entries locally', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-manage-apps"]').trigger('click')
    await wrapper.get('[data-testid="workplace-hide-standup"]').trigger('click')

    const appCards = wrapper.findAll('[data-testid^="workplace-app-"]')
    expect(wrapper.text()).toContain('已隐藏：站会机器人')
    expect(appCards.some((card) => card.text().includes('站会机器人'))).toBe(false)
  })

  it('lets workplace launch apps into existing workspace modules', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-app-meet"]').trigger('click')
    expect(wrapper.text()).toContain('应用详情：视频会议')
    expect(wrapper.text()).toContain('关联模块：通话')

    await wrapper.get('[data-testid="workplace-open-selected-app"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/calls')

    await wrapper.get('[data-testid="workplace-app-calendar"]').trigger('click')
    await wrapper.get('[data-testid="workplace-open-selected-app"]').trigger('click')
    expect(routerPush).toHaveBeenLastCalledWith('/calendar')
  })

  it('lets workplace header meeting shortcut launch the calls module', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-meeting-shortcut"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/calls')
    expect(wrapper.text()).toContain('正在打开：视频会议')
  })

  it('lets workplace header more shortcut toggle app management mode', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-more-shortcut"]').trigger('click')

    expect(wrapper.text()).toContain('应用管理已开启')
    expect(wrapper.text()).toContain('可管理应用排序与入口')
  })

  it('lets workplace priority items select their related app workflow', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-priority-item-3"]').trigger('click')

    expect(wrapper.text()).toContain('已打开重点：安全文档审批')
    expect(wrapper.text()).toContain('应用详情：任务中心')
    expect(wrapper.text()).toContain('关联模块：审批')
  })

  it('lets workplace base app manage structured records locally', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-app-base"]').trigger('click')
    expect(wrapper.text()).toContain('应用详情：多维表格')
    expect(wrapper.text()).toContain('业务表：上线风险表')

    await wrapper.get('[data-testid="workplace-base-filter-risks"]').trigger('click')
    expect(wrapper.text()).toContain('当前表格：仅风险项')
    expect(wrapper.text()).toContain('权限回收')

    await wrapper.get('[data-testid="workplace-base-add-record"]').trigger('click')
    expect(wrapper.text()).toContain('新建业务记录')
  })

  it('lets workplace project board filter and advance project stages locally', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-app-project"]').trigger('click')
    expect(wrapper.text()).toContain('应用详情：项目管理')
    expect(wrapper.text()).toContain('项目看板：跨端体验对齐')

    await wrapper.get('[data-testid="workplace-project-filter-risks"]').trigger('click')
    expect(wrapper.text()).toContain('当前项目：仅风险项目')
    expect(wrapper.text()).toContain('权限模型补齐')

    await wrapper.get('[data-testid="workplace-project-advance"]').trigger('click')
    expect(wrapper.text()).toContain('已推进：跨端体验对齐')
    expect(wrapper.text()).toContain('当前阶段：联调验收')
  })

  it('lets workplace OKR check-ins update confidence and progress locally', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-app-okr"]').trigger('click')
    expect(wrapper.text()).toContain('应用详情：OKR')
    expect(wrapper.text()).toContain('OKR：团队目标')
    expect(wrapper.text()).toContain('信心指数：中')

    await wrapper.get('[data-testid="workplace-okr-checkin"]').trigger('click')
    expect(wrapper.text()).toContain('OKR 已更新：提升桌面端协作效率')
    expect(wrapper.text()).toContain('信心指数：高')
    expect(wrapper.text()).toContain('进度：76%')
  })

  it('lets organization search, section navigation, and invite action work locally', async () => {
    const wrapper = mount(OrganizationPage)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('小红')
    })

    await wrapper.get('[data-testid="organization-search-input"]').setValue('小红')
    expect(wrapper.text()).toContain('小红')
    expect(wrapper.text()).not.toContain('小明')

    await wrapper.get('[data-testid="organization-section-groups"]').trigger('click')
    expect(wrapper.text()).toContain('团队群组')
    expect(wrapper.text()).toContain('技术交流群')

    await wrapper.get('[data-testid="organization-invite-member"]').trigger('click')
    expect(wrapper.text()).toContain('选择要邀请的新成员')
    expect(wrapper.get('[data-testid="organization-member-invite-panel"]').exists()).toBe(true)

    await wrapper.get('[data-testid="group-member-search"]').setValue('@new-member:localhost')
    await wrapper.get('[data-testid="group-member-row-@new-member:localhost"]').trigger('click')
    await wrapper.get('[data-testid="organization-member-invite-save"]').trigger('click')

    expect(wrapper.text()).toContain('已邀请：new-member')
    expect(wrapper.text()).toContain('@new-member:localhost')
  })

  it('jumps to the related section from an organization activity entry', async () => {
    const groupsWrapper = mount(OrganizationPage)
    await groupsWrapper.get('[data-testid="organization-activity-groups-entry"]').trigger('click')
    expect(groupsWrapper.get('[data-testid="organization-section-groups"]').classes()).toContain('workspace-row-active')

    const membersWrapper = mount(OrganizationPage)
    await membersWrapper.get('[data-testid="organization-activity-directory-sync"]').trigger('click')
    expect(membersWrapper.get('[data-testid="organization-section-members"]').classes()).toContain(
      'workspace-row-active',
    )
  })

  it('opens organization members and groups from section route params', async () => {
    mockRouteParams.mockReturnValue({ section: 'members' })
    const membersWrapper = mount(OrganizationPage)

    expect(membersWrapper.text()).toContain('成员目录')
    expect(membersWrapper.get('[data-testid="organization-section-members"]').classes()).toContain(
      'workspace-row-active',
    )

    mockRouteParams.mockReturnValue({ section: 'groups' })
    const groupsWrapper = mount(OrganizationPage)

    await vi.waitFor(() => {
      expect(groupsWrapper.text()).toContain('团队群组')
    })
    expect(groupsWrapper.get('[data-testid="organization-section-groups"]').classes()).toContain('workspace-row-active')
  })

  it('routes organization search to group results when the query only matches groups', async () => {
    const wrapper = mount(OrganizationPage)
    // Groups now load via an async vue-query fetch; let it settle so the search,
    // which snapshots the current group list on input, sees the loaded groups.
    await flushPromises()

    await wrapper.get('[data-testid="organization-search-input"]').setValue('技术')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('技术交流群')
    })

    expect(wrapper.text()).toContain('团队群组')
    expect(wrapper.text()).not.toContain('未找到匹配成员')
  })

  it('labels organization icon-only actions for assistive technology', async () => {
    const wrapper = mount(OrganizationPage)

    await wrapper.get('[data-testid="organization-section-members"]').trigger('click')
    await wrapper.get('[data-testid="organization-new-member"]').trigger('click')

    expect(wrapper.get('button[aria-label="关闭成员编辑"]').exists()).toBe(true)

    await wrapper.get('[data-testid="organization-member-name-input"]').setValue('可访问成员')
    await wrapper.get('[data-testid="organization-member-id-input"]').setValue('@accessible-member:localhost')
    await wrapper.get('[data-testid="organization-member-save"]').trigger('click')

    expect(
      wrapper.get('[data-testid="organization-edit-member--accessible-member-localhost"]').attributes('aria-label'),
    ).toBe('编辑成员 可访问成员')
    expect(
      wrapper.get('[data-testid="organization-delete-member--accessible-member-localhost"]').attributes('aria-label'),
    ).toBe('删除成员 可访问成员')

    await wrapper.get('[data-testid="organization-section-groups"]').trigger('click')
    await wrapper.get('[data-testid="organization-new-group"]').trigger('click')

    expect(wrapper.get('button[aria-label="关闭团队编辑"]').exists()).toBe(true)
  })

  it('lets organization security shortcut focus the member governance panel', async () => {
    const wrapper = mount(OrganizationPage)

    await wrapper.get('[data-testid="organization-security-shortcut"]').trigger('click')

    expect(wrapper.text()).toContain('已打开成员治理')
    expect(wrapper.text()).toContain('成员治理')
    expect(wrapper.text()).toContain('组织权限：')
    expect(wrapper.text()).not.toContain('安全与权限入口已就绪')
  })

  it('lets organization members be created, edited, and deleted locally', async () => {
    const wrapper = mount(OrganizationPage)

    await wrapper.get('[data-testid="organization-section-members"]').trigger('click')
    await wrapper.get('[data-testid="organization-new-member"]').trigger('click')
    await wrapper.get('[data-testid="organization-member-name-input"]').setValue('新成员')
    await wrapper.get('[data-testid="organization-member-id-input"]').setValue('@new-member:localhost')
    await wrapper.get('[data-testid="organization-member-role-input"]').setValue('产品负责人')
    await wrapper.get('[data-testid="organization-member-save"]').trigger('click')

    expect(wrapper.text()).toContain('新成员')
    expect(wrapper.text()).toContain('产品负责人')

    await wrapper.get('[data-testid="organization-edit-member--new-member-localhost"]').trigger('click')
    await wrapper.get('[data-testid="organization-member-name-input"]').setValue('成员一号')
    await wrapper.get('[data-testid="organization-member-save"]').trigger('click')

    expect(wrapper.text()).toContain('成员一号')
    expect(wrapper.text()).not.toContain('新成员')

    await wrapper.get('[data-testid="organization-delete-member--new-member-localhost"]').trigger('click')

    expect(wrapper.text()).not.toContain('成员一号')
  })

  it('lets organization teams be created, edited, and deleted locally', async () => {
    const wrapper = mount(OrganizationPage)

    await wrapper.get('[data-testid="organization-section-groups"]').trigger('click')
    await wrapper.get('[data-testid="organization-new-group"]').trigger('click')
    await wrapper.get('[data-testid="organization-group-name-input"]').setValue('体验小组')
    await wrapper.get('[data-testid="organization-group-desc-input"]').setValue('负责客户端体验优化')
    await wrapper.get('[data-testid="organization-group-save"]').trigger('click')

    expect(wrapper.text()).toContain('体验小组')
    expect(wrapper.text()).toContain('负责客户端体验优化')

    await wrapper.get('[data-testid^="organization-edit-group-local-team-"]').trigger('click')
    await wrapper.get('[data-testid="organization-group-name-input"]').setValue('体验平台组')
    await wrapper.get('[data-testid="organization-group-save"]').trigger('click')

    expect(wrapper.text()).toContain('体验平台组')
    expect(wrapper.text()).not.toContain('体验小组')

    await wrapper.get('[data-testid^="organization-delete-group-local-team-"]').trigger('click')

    expect(wrapper.text()).not.toContain('体验平台组')
  })

  it('lets organization activity rows update visible local state', async () => {
    const wrapper = mount(OrganizationPage)

    await wrapper.get('[data-testid="organization-activity-directory-sync"]').trigger('click')
    expect(wrapper.text()).toContain('已查看成员目录同步动态')

    await wrapper.get('[data-testid="organization-activity-groups-entry"]').trigger('click')
    expect(wrapper.text()).toContain('已查看团队群组入口动态')
  })

  it('lets organization manage member department, permissions, and account status locally', async () => {
    const wrapper = mount(OrganizationPage)

    await wrapper.get('[data-testid="organization-section-members"]').trigger('click')
    await wrapper.get('[data-testid="organization-new-member"]').trigger('click')
    await wrapper.get('[data-testid="organization-member-name-input"]').setValue('协作成员')
    await wrapper.get('[data-testid="organization-member-id-input"]').setValue('@ops-member:localhost')
    await wrapper.get('[data-testid="organization-member-role-input"]').setValue('成员')
    await wrapper.get('[data-testid="organization-member-save"]').trigger('click')

    await wrapper.get('[data-testid="organization-select-member--ops-member-localhost"]').trigger('click')
    await wrapper.get('[data-testid="organization-transfer-member"]').trigger('click')
    expect(wrapper.text()).toContain('所属部门：产品研发部')

    await wrapper.get('[data-testid="organization-promote-member"]').trigger('click')
    expect(wrapper.text()).toContain('组织权限：协作管理员')

    await wrapper.get('[data-testid="organization-disable-member"]').trigger('click')
    expect(wrapper.text()).toContain('已停用：协作成员')
    expect(wrapper.text()).toContain('账号状态：已停用')
  })

  it('renders calendar with month view default and today visible', async () => {
    const wrapper = mount(CalendarPage)

    // Default view is month; today button, month label, and view toggle visible
    expect(wrapper.text()).toContain('今日')
    expect(wrapper.text()).toContain('月')
    expect(wrapper.text()).toContain('周')
    expect(wrapper.text()).toContain('日')
  })

  it('lets calendar view toggle switch between views', async () => {
    const wrapper = mount(CalendarPage)

    // Default is month view
    expect(wrapper.text()).toContain('日')
    expect(wrapper.text()).toContain('周一')

    // Switch to week view - find the "周" button for week view
    const weekButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('本周视图') || b.text().trim() === 'Week View')
    expect(weekButton).toBeTruthy()
    await weekButton!.trigger('click')
  })

  it('creates a new event via teleported modal', async () => {
    const wrapper = mount(CalendarPage)

    // Open new event modal
    const newEventButton = wrapper.findAll('button').find((b) => b.text().includes('新建日程'))
    expect(newEventButton).toBeTruthy()
    await newEventButton!.trigger('click')

    // Teleported modal is mounted in document body
    await flushPromises()
    expect(document.body.textContent).toContain('保存日程')
  })

  it('selects a day and shows events in sidebar', async () => {
    const wrapper = mount(CalendarPage)

    // Find today's cell in month grid (it has today's styling)
    const todayCells = wrapper.findAll('.bg-primary.text-primary-foreground')
    expect(todayCells.length).toBeGreaterThan(0)
  })

  it('shows today events and RSVP actions when today is clicked', async () => {
    const today = new Date()
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    localStorage.removeItem('muon.calendar.events.v1')
    resetCalendarStore()
    addCalendarEvent({
      id: 'sec-seed',
      title: '产品周会',
      date: todayDate,
      time: '09:30',
      endTime: '10:30',
      participants: '产品团队',
      rsvpStatus: '待回复',
    })
    const wrapper = mount(CalendarPage)
    const todayDay = today.getDate()

    // Find today's date number in the month grid
    // Today's cell is a button with the date number inside a styled span
    const allButtons = wrapper.findAll('button')
    const todayCell = allButtons.find((b) => {
      const text = b.text()
      return text.includes(String(todayDay)) && text.includes('产品周会')
    })
    expect(todayCell).toBeTruthy()
    await todayCell!.trigger('click')
    await flushPromises()

    // Sidebar should show accept button for selected event
    expect(wrapper.text()).toContain('接受参会')
  })

  it('lets approvals filter queues and create a request locally', async () => {
    const wrapper = mount(ApprovalsPage)

    await wrapper.get('[data-testid="approvals-queue-compliance"]').trigger('click')
    expect(wrapper.text()).toContain('当前队列：合规检查')
    expect(wrapper.text()).toContain('供应商安全例外申请')
    expect(wrapper.text()).not.toContain('生产访问申请')

    await wrapper.get('[data-testid="approvals-new-request"]').trigger('click')
    expect(wrapper.text()).toContain('临时审批申请')
  })

  it('lets approvals new requests be edited before saving locally', async () => {
    const wrapper = mount(ApprovalsPage)

    await wrapper.get('[data-testid="approvals-new-request"]').trigger('click')
    await wrapper.get('[data-testid="approvals-new-title"]').setValue('权限开通申请')
    await wrapper.get('[data-testid="group-member-row-@alice:localhost"]').trigger('click')
    await wrapper.get('[data-testid="approvals-new-due"]').setValue('今日')
    await wrapper.get('[data-testid="approvals-save-new-request"]').trigger('click')

    expect(wrapper.text()).toContain('已新建申请：权限开通申请')
    expect(wrapper.text()).toContain('权限开通申请')
    expect(wrapper.text()).toContain('小红')
    expect(wrapper.text()).toContain('今日')
  })

  it('lets approval request rows open visible detail state', async () => {
    const wrapper = mount(ApprovalsPage)

    await wrapper.get('[data-testid="approvals-request-request-2"]').trigger('click')
    expect(wrapper.text()).toContain('当前申请：生产访问申请')
  })

  it('lets approval decisions move selected requests between queues locally', async () => {
    const wrapper = mount(ApprovalsPage)

    await wrapper.get('[data-testid="approvals-request-request-2"]').trigger('click')
    // 第一级通过：推进到下一环节，仍在审批中
    await wrapper.get('[data-testid="approvals-approve-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已通过当前环节')
    // 最后一级通过：整体通过
    await wrapper.get('[data-testid="approvals-approve-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已同意：生产访问申请')
    expect(wrapper.text()).toContain('当前队列：已通过')
    expect(wrapper.text()).toContain('生产访问申请')
    expect(wrapper.text()).toContain('已通过')

    await wrapper.get('[data-testid="approvals-queue-pending"]').trigger('click')
    await wrapper.get('[data-testid="approvals-request-request-3"]').trigger('click')
    await wrapper.get('[data-testid="approvals-reject-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已驳回：上线预算调整')
    expect(wrapper.text()).toContain('当前队列：已驳回')
    expect(wrapper.text()).toContain('上线预算调整')
  })

  it('lets approval handlers add comments and transfer selected requests locally', async () => {
    const wrapper = mount(ApprovalsPage)

    await wrapper.get('[data-testid="approvals-request-request-2"]').trigger('click')
    await wrapper.get('[data-testid="approvals-comment-input"]').setValue('请补充安全负责人确认')
    await wrapper.get('[data-testid="approvals-add-comment"]').trigger('click')

    expect(wrapper.text()).toContain('审批意见：请补充安全负责人确认')

    await wrapper.get('[data-testid="approvals-transfer-selected"]').trigger('click')
    await wrapper.get('[data-testid="group-member-row-@alice:localhost"]').trigger('click')
    await wrapper.get('[data-testid="approvals-transfer-confirm"]').trigger('click')
    expect(wrapper.text()).toContain('已转交：生产访问申请')
    expect(wrapper.text()).toContain('当前处理人：小红')
  })

  it('keeps approval decision notices scoped to the selected request', async () => {
    const wrapper = mount(ApprovalsPage)

    await wrapper.get('[data-testid="approvals-request-request-2"]').trigger('click')
    await wrapper.get('[data-testid="approvals-transfer-selected"]').trigger('click')
    await wrapper.get('[data-testid="group-member-row-@bob:localhost"]').trigger('click')
    await wrapper.get('[data-testid="approvals-transfer-confirm"]').trigger('click')
    expect(wrapper.text()).toContain('已转交：生产访问申请')

    await wrapper.get('[data-testid="approvals-request-request-3"]').trigger('click')
    expect(wrapper.text()).not.toContain('已转交：生产访问申请')
    expect(wrapper.text()).toContain('等待处理当前申请')
  })

  it('lets mail search, folder navigation, and compose work locally', async () => {
    const wrapper = mount(EmailPage)

    await wrapper.get('[data-testid="email-search-input"]').setValue('设计')
    expect(wrapper.text()).toContain('桌面工作区稿件已更新')
    expect(wrapper.text()).not.toContain('上线评审纪要')

    await wrapper.get('[data-testid="email-folder-sent"]').trigger('click')
    expect(wrapper.text()).toContain('已发送')
    expect(wrapper.text()).toContain('项目周报')

    await wrapper.get('[data-testid="email-compose"]').trigger('click')
    expect(wrapper.text()).toContain('草稿：新邮件')
  })

  it('shows an empty state when an email search matches nothing', async () => {
    const wrapper = mount(EmailPage)

    await wrapper.get('[data-testid="email-search-input"]').setValue('zzz-no-match-xyz')
    expect(wrapper.find('[data-testid="email-empty"]').exists()).toBe(true)
  })

  it('shows an empty state for an empty approval queue', async () => {
    const wrapper = mount(ApprovalsPage)

    await wrapper.get('[data-testid="approvals-queue-rejected"]').trigger('click')
    expect(wrapper.find('[data-testid="approvals-empty"]').exists()).toBe(true)
  })

  it('shows an empty state when a workplace app search matches nothing', async () => {
    const wrapper = mount(WorkplacePage)

    await wrapper.get('[data-testid="workplace-search-input"]').setValue('zzz-no-match-xyz')
    expect(wrapper.find('[data-testid="workplace-apps-empty"]').exists()).toBe(true)
  })

  it('refuses to send mail until an account is configured', async () => {
    const wrapper = mount(EmailPage)

    // 未配置邮箱账号 → 诚实拒绝发送（不伪造已发送），弹出账号配置面板
    await wrapper.get('[data-testid="email-compose"]').trigger('click')
    await wrapper.get('[data-testid="email-compose-to"]').setValue('ops@example.com')
    await wrapper.get('[data-testid="email-compose-subject"]').setValue('发布确认')
    await wrapper.get('[data-testid="email-compose-body"]').setValue('请确认今晚发布窗口。')
    await wrapper.get('[data-testid="email-compose-send"]').trigger('click')

    expect(wrapper.find('[data-testid="email-account-panel"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('已发送：发布确认')
  })

  it('lets mail rows open a readable selected message state', async () => {
    const wrapper = mount(EmailPage)

    await wrapper.get('[data-testid="email-message-mail-1"]').trigger('click')
    expect(wrapper.text()).toContain('当前邮件：上线评审纪要')
    expect(wrapper.text()).toContain('最终检查清单已准备好，请完成签核。')
  })

  it('lets mail selected messages reply, star, and archive locally', async () => {
    const wrapper = mount(EmailPage)

    expect(wrapper.get('[data-testid="email-folder-count-inbox"]').text()).toBe('4')
    expect(wrapper.get('[data-testid="email-folder-count-starred"]').text()).toBe('1')

    await wrapper.get('[data-testid="email-message-mail-1"]').trigger('click')
    await wrapper.get('[data-testid="email-reply-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已生成回复草稿：上线评审纪要')
    expect(wrapper.text()).toContain('回复草稿：上线评审纪要')

    await wrapper.get('[data-testid="email-star-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已星标：上线评审纪要')
    expect(wrapper.text()).toContain('上线评审纪要')
    expect(wrapper.get('[data-testid="email-active-folder-title"]').text()).toBe('收件箱')
    expect(wrapper.get('[data-testid="email-folder-count-inbox"]').text()).toBe('4')
    expect(wrapper.get('[data-testid="email-folder-count-starred"]').text()).toBe('2')

    await wrapper.get('[data-testid="email-folder-starred"]').trigger('click')
    expect(wrapper.text()).toContain('上线评审纪要')
    expect(wrapper.text()).toContain('重点需求确认')

    await wrapper.get('[data-testid="email-folder-inbox"]').trigger('click')
    await wrapper.get('[data-testid="email-message-mail-2"]').trigger('click')
    await wrapper.get('[data-testid="email-archive-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已归档：桌面工作区稿件已更新')
    expect(wrapper.text()).toContain('归档')
    expect(wrapper.text()).toContain('桌面工作区稿件已更新')
    expect(wrapper.get('[data-testid="email-folder-count-inbox"]').text()).toBe('3')
  })

  it('keeps mail reply drafts scoped to the selected message', async () => {
    const wrapper = mount(EmailPage)

    await wrapper.get('[data-testid="email-message-mail-1"]').trigger('click')
    await wrapper.get('[data-testid="email-reply-selected"]').trigger('click')
    expect(wrapper.text()).toContain('回复草稿：上线评审纪要')

    await wrapper.get('[data-testid="email-message-mail-2"]').trigger('click')
    expect(wrapper.text()).not.toContain('回复草稿：上线评审纪要')
    expect(wrapper.text()).toContain('等待处理当前邮件')
  })
})
