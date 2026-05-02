import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ApprovalsPage from '@/features/approvals/components/ApprovalsPage.vue'
import CalendarPage from '@/features/calendar/components/CalendarPage.vue'
import CallsPage from '@/features/calls/components/CallsPage.vue'
import DocsPage from '@/features/docs/components/DocsPage.vue'
import EmailPage from '@/features/email/components/EmailPage.vue'
import WorkplacePage from '@/features/workplace/components/WorkplacePage.vue'

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

  it('lets calendar week navigation and new event work locally', async () => {
    const wrapper = mount(CalendarPage)

    await wrapper.get('[data-testid="calendar-next-week"]').trigger('click')
    expect(wrapper.text()).toContain('4月27日 - 5月1日')

    await wrapper.get('[data-testid="calendar-new-event"]').trigger('click')
    expect(wrapper.text()).toContain('临时日程')
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

  it('lets calls switch mode and start a local call record', async () => {
    const wrapper = mount(CallsPage)

    await wrapper.get('[data-testid="calls-audio-mode"]').trigger('click')
    expect(wrapper.text()).toContain('当前模式：语音通话')

    await wrapper.get('[data-testid="calls-start"]').trigger('click')
    expect(wrapper.text()).toContain('即时语音通话')
  })
})
