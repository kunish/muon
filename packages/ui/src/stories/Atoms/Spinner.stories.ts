import type { Meta, StoryObj } from '@storybook/vue3'
import { Button } from '../../atoms/button'
import { Spinner } from '../../atoms/spinner'

const meta: Meta<typeof Spinner> = {
  title: 'Atoms/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    label: { control: 'text' },
  },
  args: {
    size: 'md',
    label: 'Loading',
  },
}

export default meta

type Story = StoryObj<typeof Spinner>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({
    components: { Spinner },
    setup: () => ({ args }),
    template: '<Spinner v-bind="args" />',
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Spinner },
    template: `
      <div class="flex items-end gap-4">
        <div class="flex flex-col items-center gap-1">
          <Spinner size="xs" />
          <span class="text-[10px] text-muted-foreground">xs</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Spinner size="sm" />
          <span class="text-[10px] text-muted-foreground">sm</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Spinner size="md" />
          <span class="text-[10px] text-muted-foreground">md</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Spinner size="lg" />
          <span class="text-[10px] text-muted-foreground">lg</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Spinner size="xl" />
          <span class="text-[10px] text-muted-foreground">xl</span>
        </div>
      </div>
    `,
  }),
}

export const Colors: Story = {
  render: () => ({
    components: { Spinner },
    template: `
      <div class="flex items-center gap-4">
        <div class="flex flex-col items-center gap-1">
          <div class="text-primary">
            <Spinner size="lg" />
          </div>
          <span class="text-[10px] text-muted-foreground">text-primary</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <div class="text-destructive">
            <Spinner size="lg" />
          </div>
          <span class="text-[10px] text-muted-foreground">text-destructive</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <div class="text-success">
            <Spinner size="lg" />
          </div>
          <span class="text-[10px] text-muted-foreground">text-success</span>
        </div>
      </div>
    `,
  }),
}

export const InsideButton: Story = {
  render: () => ({
    components: { Spinner, Button },
    template: `
      <div class="flex items-center gap-2">
        <Button loading>Save</Button>
        <Button variant="outline">
          <Spinner size="sm" class="mr-2" />
          Processing
        </Button>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Spinner },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <Spinner />
          <Spinner />
          <Spinner />
        </div>
        <div data-density="compact" class="flex items-center gap-2">
          <Spinner />
          <Spinner />
          <Spinner />
        </div>
      </div>
    `,
  }),
}
