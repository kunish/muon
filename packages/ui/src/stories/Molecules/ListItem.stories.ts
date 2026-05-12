import type { Meta, StoryObj } from '@storybook/vue3'
import { Avatar } from '../../components/ui/avatar'
import { Badge } from '../../components/ui/badge'
import { ListItem } from '../../molecules/list-item'

const meta: Meta<typeof ListItem> = {
  title: 'Molecules/ListItem',
  component: ListItem,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    selected: { control: 'boolean' },
  },
  args: { title: 'Daisy Chen', description: 'Yes, the report is ready', size: 'md', selected: false },
}

export default meta
type Story = StoryObj<typeof ListItem>

export const Default: Story = {
  render: args => ({ components: { ListItem }, setup: () => ({ args }), template: '<div class="w-80"><ListItem v-bind="args" /></div>' }),
}

export const Variants: Story = {
  render: () => ({
    components: { ListItem, Avatar, Badge },
    template: `
      <div class="w-80 flex flex-col">
        <ListItem title="No leading">
          <template #trailing><Badge variant="secondary">3</Badge></template>
        </ListItem>
        <ListItem title="With avatar" description="last message">
          <template #leading><Avatar size="sm" fallback="D" color-id="daisy" /></template>
        </ListItem>
        <ListItem title="With trailing only">
          <template #trailing><Badge>!</Badge></template>
        </ListItem>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { ListItem },
    template: `
      <div class="w-80 flex flex-col">
        <ListItem size="sm" title="Small (h-8)" />
        <ListItem size="md" title="Medium (h-10)" description="with description" />
        <ListItem size="lg" title="Large (h-12)" description="with description" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { ListItem },
    template: `
      <div class="w-80 flex flex-col">
        <ListItem title="Default" />
        <ListItem title="Selected" selected />
        <ListItem title="With description" description="and a second line" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { ListItem },
    template: `
      <div class="flex flex-col gap-4">
        <div class="w-80 flex flex-col">
          <ListItem title="Default density A" />
          <ListItem title="Default density B" selected />
        </div>
        <div data-density="compact" class="w-80 flex flex-col">
          <ListItem title="Compact density A" />
          <ListItem title="Compact density B" selected />
        </div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { ListItem, Avatar, Badge },
    template: `
      <div class="w-80 rounded-lg border border-border bg-card py-2">
        <ListItem title="Daisy Chen" description="Yes, the report is ready" selected>
          <template #leading><Avatar size="sm" fallback="D" color-id="daisy" /></template>
          <template #trailing><Badge variant="secondary">2</Badge></template>
        </ListItem>
        <ListItem title="Eng team" description="Standup notes posted">
          <template #leading><Avatar size="sm" fallback="E" color-id="eng" /></template>
        </ListItem>
        <ListItem title="Marcus Lee" description="Lunch?">
          <template #leading><Avatar size="sm" fallback="M" color-id="marcus" /></template>
        </ListItem>
      </div>
    `,
  }),
}
