import type { Meta, StoryObj } from '@storybook/vue3'
import { Input } from '../../atoms/input'
import { Label } from '../../components/ui/label'

const meta: Meta<typeof Label> = {
  title: 'Components/Label',
  component: Label,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Label>

export const WithInput: Story = {
  render: () => ({
    components: { Label, Input },
    template: `
      <div class="w-72 flex flex-col gap-1.5">
        <Label for="email">邮箱</Label>
        <Input id="email" type="email" placeholder="connor@example.com" />
      </div>
    `,
  }),
}
