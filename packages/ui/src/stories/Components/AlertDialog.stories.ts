import type { Meta, StoryObj } from '@storybook/vue3'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'

const meta: Meta<typeof AlertDialog> = {
  title: 'Components/AlertDialog',
  component: AlertDialog,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof AlertDialog>

export const DeleteConfirm: Story = {
  render: () => ({
    components: {
      AlertDialog,
      AlertDialogContent,
      AlertDialogHeader,
      AlertDialogTitle,
      AlertDialogDescription,
      AlertDialogFooter,
      AlertDialogCancel,
      AlertDialogAction,
    },
    template: `
      <AlertDialog default-open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除会话「Kevin Zhang」？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后聊天记录将无法恢复，对方仍可以发起新的会话。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-red-600">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    `,
  }),
}
