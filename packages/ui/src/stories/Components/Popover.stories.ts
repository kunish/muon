import type { Meta, StoryObj } from '@storybook/vue3'
import { Calendar, Users } from 'lucide-vue-next'
import { Avatar } from '../../atoms/avatar'
import { Button } from '../../atoms/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover'

const meta: Meta<typeof Popover> = {
  title: 'Components/Popover',
  component: Popover,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof Popover>

// Calendar event detail popover, mirroring the 03 calendar-week anchor.
export const CalendarEvent: Story = {
  render: () => ({
    components: { Popover, PopoverTrigger, PopoverContent, Button, Avatar, Calendar, Users },
    setup: () => ({ Calendar, Users }),
    template: `
      <div class="flex items-center justify-center min-h-screen">
        <Popover :open="true">
          <PopoverTrigger as-child>
            <Button variant="outline" size="sm">PC-Message 周会</Button>
          </PopoverTrigger>
          <PopoverContent class="w-80">
            <div class="flex flex-col gap-3">
              <div class="flex items-start justify-between gap-2">
                <h4 class="text-base font-semibold">PC-Message 周会</h4>
              </div>
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <component :is="Calendar" class="size-4" />
                <span>周一, 5月 4 · 11:00 — 12:00</span>
              </div>
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <component :is="Users" class="size-4" />
                <span>11 guests</span>
              </div>
              <div class="flex items-center gap-1.5 mt-1">
                <Avatar size="sm" colorId="connor" alt="Connor" />
                <Avatar size="sm" colorId="kevin" alt="Kevin" />
                <Avatar size="sm" colorId="cy" alt="Chen Yue" />
                <span class="text-xs text-muted-foreground ml-1">+ 8</span>
              </div>
              <div class="flex gap-2 mt-2">
                <Button size="sm" class="flex-1">Yes</Button>
                <Button variant="outline" size="sm" class="flex-1">No</Button>
                <Button variant="outline" size="sm" class="flex-1">Maybe</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    `,
  }),
}

export const Settings: Story = {
  render: () => ({
    components: { Popover, PopoverTrigger, PopoverContent, Button },
    template: `
      <div class="flex items-center justify-center min-h-screen">
        <Popover :open="true">
          <PopoverTrigger as-child>
            <Button variant="ghost" size="sm">字号</Button>
          </PopoverTrigger>
          <PopoverContent class="w-56">
            <div class="flex flex-col gap-2">
              <p class="text-sm font-medium">显示字号</p>
              <p class="text-xs text-muted-foreground">影响 IM、文档、设置中的全部文本。</p>
              <div class="flex gap-1 mt-2">
                <Button variant="outline" size="sm" class="flex-1">小</Button>
                <Button size="sm" class="flex-1">中</Button>
                <Button variant="outline" size="sm" class="flex-1">大</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    `,
  }),
}
