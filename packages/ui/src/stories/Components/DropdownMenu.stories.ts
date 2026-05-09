import type { Meta, StoryObj } from '@storybook/vue3'
import { Copy, Forward, Pin, Reply, Trash } from 'lucide-vue-next'
import { Button } from '../../atoms/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'

const meta: Meta<typeof DropdownMenu> = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof DropdownMenu>

// `default-open` keeps the menu mounted for the screenshot pipeline; the
// portal renders content into <body>, so PORTAL_PREFIXES in the visual spec
// captures the full viewport.

export const MessageActions: Story = {
  render: () => ({
    components: {
      DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
      DropdownMenuSeparator, Button, Reply, Forward, Pin, Copy, Trash,
    },
    setup: () => ({ Reply, Forward, Pin, Copy, Trash }),
    template: `
      <div class="flex items-center justify-center min-h-screen">
        <DropdownMenu default-open>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm">消息操作</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-44">
            <DropdownMenuItem>
              <component :is="Reply" />
              <span>回复</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <component :is="Forward" />
              <span>转发</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <component :is="Pin" />
              <span>置顶消息</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <component :is="Copy" />
              <span>复制</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="text-destructive">
              <component :is="Trash" />
              <span>删除</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    `,
  }),
}

export const WithLabel: Story = {
  render: () => ({
    components: {
      DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
      DropdownMenuLabel, DropdownMenuSeparator, Button,
    },
    template: `
      <div class="flex items-center justify-center min-h-screen">
        <DropdownMenu default-open>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm">外观</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-40">
            <DropdownMenuLabel>主题</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>跟随系统</DropdownMenuItem>
            <DropdownMenuItem>浅色</DropdownMenuItem>
            <DropdownMenuItem>深色</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    `,
  }),
}
