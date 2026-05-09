import type { Meta, StoryObj } from '@storybook/vue3'
import { Button } from '../../atoms/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => ({
    components: { Card, CardHeader, CardTitle, CardDescription, CardContent },
    template: `
      <Card class="w-80">
        <CardHeader>
          <CardTitle>项目「飞书对齐」</CardTitle>
          <CardDescription>设计系统对齐工作进度跟踪</CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-sm">已完成 8 个 atom 与 4 层基础设施修复。</p>
        </CardContent>
      </Card>
    `,
  }),
}

export const WithFooter: Story = {
  render: () => ({
    components: { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button },
    template: `
      <Card class="w-80">
        <CardHeader>
          <CardTitle>审批请求</CardTitle>
          <CardDescription>Custom app release request</CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-sm">App: 石林's Feishu CLI</p>
          <p class="text-sm">提交时间：2026-05-07 23:45</p>
        </CardContent>
        <CardFooter class="gap-2">
          <Button variant="outline" size="sm">查看详情</Button>
          <Button size="sm">同意</Button>
        </CardFooter>
      </Card>
    `,
  }),
}

export const WithAction: Story = {
  render: () => ({
    components: { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, Button },
    template: `
      <Card class="w-80">
        <CardHeader>
          <CardTitle>消息列表</CardTitle>
          <CardDescription>未读 12 条</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm">查看全部</Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p class="text-sm">Kevin Zhang: PC-Message 周会...</p>
        </CardContent>
      </Card>
    `,
  }),
}

export const Compact: Story = {
  render: () => ({
    components: { Card, CardContent },
    template: `
      <Card class="w-80 py-3 gap-3">
        <CardContent class="flex items-center gap-3">
          <span class="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">U</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">User Connor Shi</p>
            <p class="text-xs text-muted-foreground truncate">Client R&D Department</p>
          </div>
        </CardContent>
      </Card>
    `,
  }),
}
