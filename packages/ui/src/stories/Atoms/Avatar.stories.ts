import type { Meta, StoryObj } from '@storybook/vue3'
import { Avatar } from '../../atoms/avatar'

const meta: Meta<typeof Avatar> = {
  title: 'Atoms/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] },
    shape: { control: 'select', options: ['rounded', 'circle'] },
    presence: { control: 'select', options: [null, 'online', 'unavailable', 'busy', 'offline'] },
    clickable: { control: 'boolean' },
  },
  args: {
    alt: 'Ada Lovelace',
    colorId: 'ada',
    size: 'md',
    shape: 'rounded',
    presence: null,
    clickable: false,
  },
}

export default meta

type Story = StoryObj<typeof Avatar>

export const Default: Story = {
  render: (args) => ({
    components: { Avatar },
    setup: () => ({ args }),
    template: '<Avatar v-bind="args" />',
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Avatar },
    template: `
      <div class="flex items-end gap-4">
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Ada" color-id="ada" size="xs" />
          <span class="text-[10px] text-muted-foreground">xs · 20</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Ben" color-id="ben" size="sm" />
          <span class="text-[10px] text-muted-foreground">sm · 24</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Cleo" color-id="cleo" size="md" />
          <span class="text-[10px] text-muted-foreground">md · 32</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Dee" color-id="dee" size="lg" />
          <span class="text-[10px] text-muted-foreground">lg · 40</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Eli" color-id="eli" size="xl" />
          <span class="text-[10px] text-muted-foreground">xl · 56</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Fae" color-id="fae" size="2xl" />
          <span class="text-[10px] text-muted-foreground">2xl · 64</span>
        </div>
      </div>
    `,
  }),
}

export const Shapes: Story = {
  render: () => ({
    components: { Avatar },
    template: `
      <div class="flex items-center gap-6">
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Ada" color-id="ada" size="lg" shape="rounded" />
          <span class="text-[10px] text-muted-foreground">rounded (default)</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Ben" color-id="ben" size="lg" shape="circle" />
          <span class="text-[10px] text-muted-foreground">circle</span>
        </div>
      </div>
    `,
  }),
}

export const Presence: Story = {
  render: () => ({
    components: { Avatar },
    template: `
      <div class="flex items-center gap-4">
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Ada" color-id="ada" size="lg" presence="online" />
          <span class="text-[10px] text-muted-foreground">online</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Ben" color-id="ben" size="lg" presence="unavailable" />
          <span class="text-[10px] text-muted-foreground">unavailable</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Cleo" color-id="cleo" size="lg" presence="busy" />
          <span class="text-[10px] text-muted-foreground">busy</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Avatar alt="Dee" color-id="dee" size="lg" presence="offline" />
          <span class="text-[10px] text-muted-foreground">offline</span>
        </div>
      </div>
    `,
  }),
}

export const WithFallback: Story = {
  render: () => ({
    components: { Avatar },
    template: `
      <div class="flex items-center gap-4">
        <Avatar alt="Ada Lovelace" color-id="ada" size="lg" />
        <Avatar alt="Ben Carter" color-id="ben" size="lg" />
        <Avatar alt="Cleo Park" color-id="cleo" size="lg" />
        <Avatar fallback="?" size="lg" />
        <Avatar alt="Eli" color-id="eli" size="lg" src="https://example.com/broken.png" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Avatar },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <Avatar alt="Ada" color-id="ada" />
          <Avatar alt="Ben" color-id="ben" />
          <Avatar alt="Cleo" color-id="cleo" />
        </div>
        <div data-density="compact" class="flex items-center gap-2">
          <Avatar alt="Ada" color-id="ada" />
          <Avatar alt="Ben" color-id="ben" />
          <Avatar alt="Cleo" color-id="cleo" />
        </div>
      </div>
    `,
  }),
}
