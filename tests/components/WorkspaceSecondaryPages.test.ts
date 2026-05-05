import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApprovalsPage from '@/features/approvals/components/ApprovalsPage.vue'
import CalendarPage from '@/features/calendar/components/CalendarPage.vue'
import CallsPage from '@/features/calls/components/CallsPage.vue'
import { launchContactCall } from '@/features/calls/stores/callLaunchStore'
import DocsPage from '@/features/docs/components/DocsPage.vue'
import EmailPage from '@/features/email/components/EmailPage.vue'
import OrganizationPage from '@/features/organization/components/OrganizationPage.vue'
import WorkplacePage from '@/features/workplace/components/WorkplacePage.vue'

const routerPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: routerPush }),
  }
})

const pages = [
  {
    component: DocsPage,
    name: '文档',
    requiredText: ['新建文档', '最近文档', '知识库迁移计划'],
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
    requiredText: ['新建日程', '本周视图', '产品周会'],
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
    requiredText: ['发起通话', '通话记录', '设计评审'],
  },
]

describe('workspace secondary pages', () => {
  beforeEach(() => {
    localStorage.removeItem('muon_organization_directory_v1')
    routerPush.mockReset()
  })

  it.each(pages)('renders a complete Chinese workspace frame for $name', ({ component, name, requiredText }) => {
    const wrapper = mount(component)

    expect(wrapper.text()).toContain(name)
    for (const text of requiredText) {
      expect(wrapper.text()).toContain(text)
    }
  })

  it('lets docs search, create, and view controls update visible content', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-search-input"]').setValue('Matrix')
    expect(wrapper.text()).toContain('Matrix 同步排障手册')
    expect(wrapper.text()).not.toContain('知识库迁移计划')

    await wrapper.get('[data-testid="docs-new-button"]').trigger('click')
    expect(wrapper.text()).toContain('新建协作文档')

    await wrapper.get('[data-testid="docs-view-toggle"]').trigger('click')
    expect(wrapper.text()).toContain('当前视图：网格')
    await wrapper.get('[data-testid="docs-filter-toggle"]').trigger('click')
    expect(wrapper.text()).toContain('仅显示待审阅')
  })

  it('lets docs new documents be edited before saving locally', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-new-button"]').trigger('click')
    await wrapper.get('[data-testid="docs-new-title"]').setValue('发布操作手册')
    await wrapper.get('[data-testid="docs-new-owner"]').setValue('运营团队')
    await wrapper.get('[data-testid="docs-new-type"]').setValue('手册')
    await wrapper.get('[data-testid="docs-save-new-document"]').trigger('click')

    expect(wrapper.text()).toContain('已创建文档：发布操作手册')
    expect(wrapper.text()).toContain('当前文档：发布操作手册')
    expect(wrapper.text()).toContain('运营团队')
    expect(wrapper.text()).toContain('手册')
  })

  it('keeps newly created docs visible when starting outside the recent section', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-section-starred"]').trigger('click')
    expect(wrapper.text()).toContain('当前分区：已收藏')

    await wrapper.get('[data-testid="docs-new-button"]').trigger('click')

    expect(wrapper.text()).toContain('当前分区：最近更新')
    expect(wrapper.text()).toContain('当前文档：新建协作文档')
  })

  it('lets docs folder and document rows open visible workspace detail state', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-folder-设计资产"]').trigger('click')
    expect(wrapper.text()).toContain('当前文件夹：设计资产')

    await wrapper.get('[data-testid="docs-document-doc-2"]').trigger('click')
    expect(wrapper.text()).toContain('当前文档：桌面聊天体验走查')
  })

  it('lets docs folders filter the document list', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-folder-工程文档"]').trigger('click')

    expect(wrapper.text()).toContain('当前文件夹：工程文档')
    expect(wrapper.text()).toContain('Matrix 同步排障手册')
    expect(wrapper.text()).not.toContain('知识库迁移计划')
    expect(wrapper.text()).not.toContain('桌面聊天体验走查')
  })

  it('lets docs sidebar sections filter the document list', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-section-starred"]').trigger('click')
    expect(wrapper.text()).toContain('当前分区：已收藏')
    expect(wrapper.text()).toContain('桌面聊天体验走查')
    expect(wrapper.text()).not.toContain('知识库迁移计划')

    await wrapper.get('[data-testid="docs-section-shared"]').trigger('click')
    expect(wrapper.text()).toContain('当前分区：共享给我')
    expect(wrapper.text()).toContain('Matrix 同步排障手册')
    expect(wrapper.text()).not.toContain('桌面聊天体验走查')
  })

  it('lets docs answer knowledge questions from local documents', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-knowledge-question"]').setValue('Matrix 同步怎么排障')
    await wrapper.get('[data-testid="docs-knowledge-ask"]').trigger('click')

    expect(wrapper.text()).toContain('知识问答：Matrix 同步怎么排障')
    expect(wrapper.text()).toContain('建议查看 Matrix 同步排障手册')
    expect(wrapper.text()).toContain('来源：工程团队')
  })

  it('lets docs share selected documents and add collaboration comments locally', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-document-doc-2"]').trigger('click')
    await wrapper.get('[data-testid="docs-share-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已共享给设计评审群：桌面聊天体验走查')
    expect(wrapper.text()).toContain('共享状态：团队可编辑')

    await wrapper.get('[data-testid="docs-comment-input"]').setValue('请补充移动端截图')
    await wrapper.get('[data-testid="docs-add-comment"]').trigger('click')
    expect(wrapper.text()).toContain('评论：请补充移动端截图')
  })

  it('keeps docs collaboration comments scoped to the selected document', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-document-doc-2"]').trigger('click')
    await wrapper.get('[data-testid="docs-comment-input"]').setValue('只属于体验走查')
    await wrapper.get('[data-testid="docs-add-comment"]').trigger('click')
    expect(wrapper.text()).toContain('评论：只属于体验走查')

    await wrapper.get('[data-testid="docs-document-doc-3"]').trigger('click')
    expect(wrapper.text()).not.toContain('评论：只属于体验走查')
    expect(wrapper.text()).toContain('暂无评论，添加后会在当前文档协作动态中展示。')
  })

  it('keeps docs share status scoped to the selected document', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-document-doc-2"]').trigger('click')
    await wrapper.get('[data-testid="docs-share-selected"]').trigger('click')
    expect(wrapper.text()).toContain('共享状态：团队可编辑')

    await wrapper.get('[data-testid="docs-document-doc-3"]').trigger('click')
    expect(wrapper.text()).toContain('共享状态：仅团队可见')
  })

  it('keeps docs collaboration notices scoped to the selected document', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-document-doc-2"]').trigger('click')
    await wrapper.get('[data-testid="docs-share-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已共享给设计评审群：桌面聊天体验走查')

    await wrapper.get('[data-testid="docs-document-doc-3"]').trigger('click')

    expect(wrapper.text()).toContain('等待共享当前文档')
    expect(wrapper.text()).not.toContain('已共享给设计评审群：桌面聊天体验走查')
  })

  it('lets docs more menu mark the selected document for review', async () => {
    const wrapper = mount(DocsPage)

    await wrapper.get('[data-testid="docs-document-doc-4"]').trigger('click')
    await wrapper.get('[data-testid="docs-more-toggle"]').trigger('click')
    await wrapper.get('[data-testid="docs-more-mark-review"]').trigger('click')

    expect(wrapper.text()).toContain('已标记待审阅：发布准备检查清单')
    expect(wrapper.text()).toContain('发布准备检查清单')
    expect(wrapper.text()).toContain('评审中')
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
    expect(appCards.some(card => card.text().includes('站会机器人'))).toBe(false)
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
    expect(wrapper.text()).toContain('正在邀请新成员')
    expect(wrapper.get('[data-testid="organization-member-name-input"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="organization-member-role-input"]').element).toHaveProperty('value', '成员')
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

    await wrapper.get('[data-testid="organization-invite-member"]').trigger('click')
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

    await wrapper.get('[data-testid="organization-invite-member"]').trigger('click')
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

  it('lets calendar week navigation and new event work locally', async () => {
    const wrapper = mount(CalendarPage)

    await wrapper.get('[data-testid="calendar-next-week"]').trigger('click')
    expect(wrapper.text()).toContain('4月27日 - 5月1日')

    await wrapper.get('[data-testid="calendar-prev-week"]').trigger('click')
    expect(wrapper.text()).toContain('4月20日 - 4月24日')

    await wrapper.get('[data-testid="calendar-new-event"]').trigger('click')
    expect(wrapper.text()).toContain('临时日程')
  })

  it('lets calendar new events be edited before saving locally', async () => {
    const wrapper = mount(CalendarPage)

    await wrapper.get('[data-testid="calendar-new-event"]').trigger('click')
    await wrapper.get('[data-testid="calendar-new-title"]').setValue('客户同步会')
    await wrapper.get('[data-testid="calendar-new-team"]').setValue('客户成功团队')
    await wrapper.get('[data-testid="calendar-new-time"]').setValue('10:30')
    await wrapper.get('[data-testid="calendar-save-new-event"]').trigger('click')

    expect(wrapper.text()).toContain('已新建日程：客户同步会')
    expect(wrapper.text()).toContain('当前日程：客户同步会')
    expect(wrapper.text()).toContain('客户成功团队 - 10:30')
  })

  it('lets calendar day and event rows expose selection detail', async () => {
    const wrapper = mount(CalendarPage)

    await wrapper.get('[data-testid="calendar-day-周三"]').trigger('click')
    expect(wrapper.text()).toContain('已选择：周三 22日')

    await wrapper.get('[data-testid="calendar-event-event-1"]').trigger('click')
    expect(wrapper.text()).toContain('当前日程：产品周会')
  })

  it('lets calendar day selection filter the visible agenda', async () => {
    const wrapper = mount(CalendarPage)

    await wrapper.get('[data-testid="calendar-day-周五"]').trigger('click')

    expect(wrapper.text()).toContain('已选择：周五 24日')
    expect(wrapper.text()).toContain('1 个日程 · 当前日程：专注时间')
    expect(wrapper.text()).toContain('专注时间')
    expect(wrapper.text()).not.toContain('产品周会')
    expect(wrapper.text()).not.toContain('设计评审')
  })

  it('lets calendar selected events update attendance and reschedule locally', async () => {
    const wrapper = mount(CalendarPage)

    await wrapper.get('[data-testid="calendar-event-event-2"]').trigger('click')
    expect(wrapper.text()).toContain('当前日程：设计评审')

    await wrapper.get('[data-testid="calendar-rsvp-accept"]').trigger('click')
    expect(wrapper.text()).toContain('已接受：设计评审')
    expect(wrapper.text()).toContain('参会状态：已接受')

    await wrapper.get('[data-testid="calendar-reschedule-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已改期：设计评审')
    expect(wrapper.text()).toContain('设计团队 - 15:00')
    expect(wrapper.text()).toContain('建议时段：周三 15:00')
  })

  it('keeps calendar event action notices scoped to the selected event', async () => {
    const wrapper = mount(CalendarPage)

    await wrapper.get('[data-testid="calendar-event-event-2"]').trigger('click')
    await wrapper.get('[data-testid="calendar-rsvp-accept"]').trigger('click')
    expect(wrapper.text()).toContain('已接受：设计评审')

    await wrapper.get('[data-testid="calendar-event-event-1"]').trigger('click')
    expect(wrapper.text()).not.toContain('已接受：设计评审')
    expect(wrapper.text()).toContain('等待处理当前日程')
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
    await wrapper.get('[data-testid="approvals-new-requester"]').setValue('安全团队')
    await wrapper.get('[data-testid="approvals-new-due"]').setValue('今日')
    await wrapper.get('[data-testid="approvals-save-new-request"]').trigger('click')

    expect(wrapper.text()).toContain('已新建申请：权限开通申请')
    expect(wrapper.text()).toContain('权限开通申请')
    expect(wrapper.text()).toContain('安全团队')
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
    expect(wrapper.text()).toContain('已转交：生产访问申请')
    expect(wrapper.text()).toContain('当前处理人：法务复核')
  })

  it('keeps approval decision notices scoped to the selected request', async () => {
    const wrapper = mount(ApprovalsPage)

    await wrapper.get('[data-testid="approvals-request-request-2"]').trigger('click')
    await wrapper.get('[data-testid="approvals-transfer-selected"]').trigger('click')
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

  it('lets mail compose drafts be edited and sent locally', async () => {
    const wrapper = mount(EmailPage)

    await wrapper.get('[data-testid="email-compose"]').trigger('click')
    await wrapper.get('[data-testid="email-compose-recipient"]').setValue('launch-team@example.com')
    await wrapper.get('[data-testid="email-compose-subject"]').setValue('发布确认')
    await wrapper.get('[data-testid="email-compose-body"]').setValue('请确认今晚发布窗口。')
    await wrapper.get('[data-testid="email-compose-send"]').trigger('click')

    expect(wrapper.text()).toContain('已发送：发布确认')
    expect(wrapper.text()).toContain('发布确认')
    expect(wrapper.text()).toContain('请确认今晚发布窗口。')
    expect(wrapper.text()).toContain('当前邮件：发布确认')
  })

  it('lets mail rows open a readable selected message state', async () => {
    const wrapper = mount(EmailPage)

    await wrapper.get('[data-testid="email-message-mail-1"]').trigger('click')
    expect(wrapper.text()).toContain('当前邮件：上线评审纪要')
    expect(wrapper.text()).toContain('最终检查清单已准备好，请完成签核。')
  })

  it('lets mail selected messages reply, star, and archive locally', async () => {
    const wrapper = mount(EmailPage)

    await wrapper.get('[data-testid="email-message-mail-1"]').trigger('click')
    await wrapper.get('[data-testid="email-reply-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已生成回复草稿：上线评审纪要')
    expect(wrapper.text()).toContain('回复草稿：上线评审纪要')

    await wrapper.get('[data-testid="email-star-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已星标：上线评审纪要')
    expect(wrapper.text()).toContain('星标邮件')
    expect(wrapper.text()).toContain('上线评审纪要')

    await wrapper.get('[data-testid="email-folder-inbox"]').trigger('click')
    await wrapper.get('[data-testid="email-message-mail-2"]').trigger('click')
    await wrapper.get('[data-testid="email-archive-selected"]').trigger('click')
    expect(wrapper.text()).toContain('已归档：桌面工作区稿件已更新')
    expect(wrapper.text()).toContain('归档')
    expect(wrapper.text()).toContain('桌面工作区稿件已更新')
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

  it('lets calls switch mode and start a local call record', async () => {
    const wrapper = mount(CallsPage)

    await wrapper.get('[data-testid="calls-audio-mode"]').trigger('click')
    expect(wrapper.text()).toContain('当前模式：语音通话')

    await wrapper.get('[data-testid="calls-start"]').trigger('click')
    expect(wrapper.text()).toContain('即时语音通话')
  })

  it('lets calls start from a contact launch request', async () => {
    launchContactCall({
      userId: '@alice:localhost',
      displayName: 'Alice',
      mode: 'audio',
    })

    const wrapper = mount(CallsPage)
    await flushPromises()

    expect(wrapper.text()).toContain('当前通话：与 Alice 的语音通话')
    expect(wrapper.text()).toContain('参会人：我、Alice')
    expect(wrapper.text()).toContain('已接通：Alice')
  })

  it('lets call records open visible meeting detail state', async () => {
    const wrapper = mount(CallsPage)

    await wrapper.get('[data-testid="calls-record-call-1"]').trigger('click')
    expect(wrapper.text()).toContain('当前通话：设计评审')
    expect(wrapper.text()).toContain('会议类型：视频会议')
  })

  it('lets calls generate local meeting notes from a selected call', async () => {
    const wrapper = mount(CallsPage)

    await wrapper.get('[data-testid="calls-record-call-1"]').trigger('click')
    await wrapper.get('[data-testid="calls-generate-notes"]').trigger('click')

    expect(wrapper.text()).toContain('会议纪要：设计评审')
    expect(wrapper.text()).toContain('待办提炼：同步评审结论')
  })

  it('keeps generated call notes scoped to the selected call record', async () => {
    const wrapper = mount(CallsPage)

    await wrapper.get('[data-testid="calls-record-call-1"]').trigger('click')
    await wrapper.get('[data-testid="calls-generate-notes"]').trigger('click')
    expect(wrapper.text()).toContain('会议纪要：设计评审')

    await wrapper.get('[data-testid="calls-record-call-2"]').trigger('click')
    expect(wrapper.text()).not.toContain('会议纪要：设计评审')
    expect(wrapper.text()).toContain('选择一条通话记录后生成本地会议纪要')

    await wrapper.get('[data-testid="calls-generate-notes"]').trigger('click')
    expect(wrapper.text()).toContain('会议纪要：故障复盘跟进')
  })

  it('lets calls control an active meeting locally', async () => {
    const wrapper = mount(CallsPage)

    await wrapper.get('[data-testid="calls-start"]').trigger('click')
    expect(wrapper.text()).toContain('当前通话：即时视频会议')

    await wrapper.get('[data-testid="calls-toggle-mute"]').trigger('click')
    expect(wrapper.text()).toContain('麦克风：已静音')

    await wrapper.get('[data-testid="calls-toggle-share"]').trigger('click')
    expect(wrapper.text()).toContain('共享屏幕：正在共享')

    await wrapper.get('[data-testid="calls-invite-member"]').trigger('click')
    expect(wrapper.text()).toContain('已邀请：产品团队')
    expect(wrapper.text()).toContain('参会人：我、产品团队')
  })

  it('keeps call control state scoped to the selected call record', async () => {
    const wrapper = mount(CallsPage)

    await wrapper.get('[data-testid="calls-start"]').trigger('click')
    await wrapper.get('[data-testid="calls-toggle-mute"]').trigger('click')
    await wrapper.get('[data-testid="calls-invite-member"]').trigger('click')
    expect(wrapper.text()).toContain('已邀请：产品团队')
    expect(wrapper.text()).toContain('参会人：我、产品团队')

    await wrapper.get('[data-testid="calls-record-call-1"]').trigger('click')

    expect(wrapper.text()).toContain('当前会议：设计评审')
    expect(wrapper.text()).toContain('会中控制已就绪')
    expect(wrapper.text()).toContain('麦克风：已开启')
    expect(wrapper.text()).toContain('共享屏幕：未共享')
    expect(wrapper.text()).toContain('参会人：我')
    expect(wrapper.text()).not.toContain('已邀请：产品团队')
    expect(wrapper.text()).not.toContain('参会人：我、产品团队')
  })

  it('lets calls end an active meeting locally', async () => {
    const wrapper = mount(CallsPage)

    await wrapper.get('[data-testid="calls-start"]').trigger('click')
    await wrapper.get('[data-testid="calls-end-call"]').trigger('click')

    expect(wrapper.text()).toContain('通话已结束：即时视频会议')
    expect(wrapper.text()).toContain('即时视频会议')
    expect(wrapper.text()).toContain('已结束')
  })
})
