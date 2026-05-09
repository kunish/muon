import type { Meta, StoryObj } from '@storybook/vue3'
import { Bell, Search } from 'lucide-vue-next'
import { Button } from '../../atoms/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip'

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof Tooltip>

// `:open="true"` forces the content visible without hover so the screenshot
// pipeline can capture it. PORTAL_PREFIXES handles the viewport screenshot.

export const Hint: Story = {
  render: () => ({
    components: { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button },
    template: `
      <TooltipProvider>
        <div class="flex items-center justify-center min-h-screen">
          <Tooltip :open="true">
            <TooltipTrigger as-child>
              <Button variant="outline" size="sm">悬停查看</Button>
            </TooltipTrigger>
            <TooltipContent>快捷键：Cmd + K</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    `,
  }),
}

export const IconButton: Story = {
  render: () => ({
    components: { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button, Bell, Search },
    setup: () => ({ Bell, Search }),
    template: `
      <TooltipProvider>
        <div class="flex items-center justify-center min-h-screen gap-2">
          <Tooltip :open="true">
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" :leading-icon="Search" />
            </TooltipTrigger>
            <TooltipContent>搜索 (Cmd + F)</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    `,
  }),
}
