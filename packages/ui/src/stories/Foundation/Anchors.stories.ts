import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

interface Anchor {
  src: string
  title: string
  note: string
}

const ANCHORS: Anchor[] = [
  { src: '01-messages.png', title: '消息列表', note: 'IM 列表 + 会话视图（暗色）— 行高、头像方圆、列表密度的飞书参照' },
  {
    src: '02-docs-home.png',
    title: '云文档 Home',
    note: '文档列表表格视图（暗色）— 表格行高、列分布、协作人头像组的飞书参照',
  },
  {
    src: '03-calendar-week.png',
    title: '日历周视图',
    note: '周视图 + 日程详情 popover（暗色）— popover 阴影、字段堆叠、按钮组的飞书参照',
  },
  {
    src: '04-approval-form.png',
    title: '审批表单',
    note: '审批详情页（暗色）— 长表单字段、选项卡、行间距、内联代码块的飞书参照',
  },
  { src: '05-settings.png', title: '设置页', note: '账号与外观设置（暗色）— 二级 nav、单选卡片、下拉选择的飞书参照' },
]

const Anchors = defineComponent({
  name: 'AnchorViewer',
  setup() {
    return () =>
      h('div', { class: 'flex flex-col gap-8 p-6 max-w-5xl' }, [
        h('div', { class: 'flex flex-col gap-1' }, [
          h('h1', { class: 'text-xl font-semibold' }, 'Feishu 风参照锚点视图'),
          h(
            'p',
            { class: 'text-sm text-muted-foreground' },
            '所有 atom 调样必须以下列锚点视图为对照。每个 atom 的故事评审时，应在 Storybook 中并排打开本页面进行视觉比对。',
          ),
        ]),
        ...ANCHORS.map((a) =>
          h(
            'figure',
            {
              key: a.src,
              class: 'flex flex-col gap-2',
            },
            [
              h('figcaption', { class: 'flex flex-col gap-0.5' }, [
                h('div', { class: 'text-sm font-medium' }, a.title),
                h('div', { class: 'text-xs text-muted-foreground' }, a.note),
              ]),
              h('img', {
                src: a.src,
                alt: a.title,
                class: 'max-w-full rounded-sm border border-border bg-card shadow-sm',
              }),
            ],
          ),
        ),
      ])
  },
})

const meta: Meta<typeof Anchors> = {
  title: 'Foundation/Anchors',
  component: Anchors,
  tags: ['autodocs'],
}

export default meta

export const Reference: StoryObj<typeof Anchors> = {}
