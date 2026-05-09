import type { Meta, StoryObj } from '@storybook/vue3'
import { Button } from '../../atoms/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'

const meta: Meta<typeof Dialog> = {
  title: 'Components/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: {
    // Dialog uses a portal that escapes the centered iframe — keep layout default
    // and let the screenshot capture the whole storybook root (overlay + content).
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof Dialog>

// Use `default-open` so the dialog renders without interaction — the screenshot
// pipeline (`#storybook-root` crop) needs the content node present at capture
// time. The trigger button is omitted for the same reason: cleaner crops.

export const Confirm: Story = {
  render: () => ({
    components: { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button },
    template: `
      <Dialog default-open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认撤回审批？</DialogTitle>
            <DialogDescription>撤回后此审批请求将被关闭，相关人员会收到通知。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline">取消</Button>
            <Button variant="destructive">撤回</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    `,
  }),
}

export const FormPrompt: Story = {
  render: () => ({
    components: { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button },
    template: `
      <Dialog default-open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文档</DialogTitle>
            <DialogDescription>选择文档类型并输入标题。</DialogDescription>
          </DialogHeader>
          <div class="flex flex-col gap-3 py-2">
            <input
              type="text"
              placeholder="文档标题"
              class="h-8 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:border-primary"
            >
            <textarea
              placeholder="描述（可选）"
              rows="3"
              class="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-primary"
            />
          </div>
          <DialogFooter>
            <Button variant="outline">取消</Button>
            <Button>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    `,
  }),
}

export const Minimal: Story = {
  render: () => ({
    components: { Dialog, DialogContent, DialogHeader, DialogTitle, Button },
    template: `
      <Dialog default-open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>已收到，正在处理</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    `,
  }),
}
