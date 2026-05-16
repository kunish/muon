import type { Meta, StoryObj } from '@storybook/vue3'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof Select>

export const Language: Story = {
  render: () => ({
    components: {
      Select,
      SelectTrigger,
      SelectValue,
      SelectContent,
      SelectGroup,
      SelectItem,
      SelectLabel,
    },
    template: `
      <div class="flex items-center justify-center min-h-screen">
        <Select :open="true" default-value="zh-CN">
          <SelectTrigger class="w-56">
            <SelectValue placeholder="选择语言" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>语言</SelectLabel>
              <SelectItem value="zh-CN">简体中文</SelectItem>
              <SelectItem value="zh-TW">繁體中文</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ja">日本語</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    `,
  }),
}

export const Closed: Story = {
  render: () => ({
    components: { Select, SelectTrigger, SelectValue, SelectContent, SelectItem },
    template: `
      <div class="w-72 p-6">
        <Select default-value="md">
          <SelectTrigger>
            <SelectValue placeholder="字号" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">小</SelectItem>
            <SelectItem value="md">中</SelectItem>
            <SelectItem value="lg">大</SelectItem>
          </SelectContent>
        </Select>
      </div>
    `,
  }),
}
