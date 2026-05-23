import type { Meta, StoryObj } from '@storybook/vue3'
import { Button } from '../../atoms/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../../components/ui/sheet'

const meta: Meta<typeof Sheet> = {
  title: 'Components/Sheet',
  component: Sheet,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof Sheet>

export const SettingsPanel: Story = {
  render: () => ({
    components: { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, Button },
    template: `
      <Sheet default-open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>个人资料</SheetTitle>
            <SheetDescription>更新你的资料和外观偏好。</SheetDescription>
          </SheetHeader>
          <div class="px-4 flex flex-col gap-3 text-sm">
            <p>姓名：石林 Connor Shi</p>
            <p>角色：Client R&amp;D Department</p>
            <p>邮箱：connor@example.com</p>
          </div>
          <SheetFooter>
            <Button>保存修改</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    `,
  }),
}
