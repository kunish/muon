import type { Meta, StoryObj } from '@storybook/vue3'
import type { BreadcrumbItem } from '../../molecules/breadcrumb'
import { Breadcrumb } from '../../molecules/breadcrumb'

const short: BreadcrumbItem[] = [
  { label: 'Workspace', href: '#' },
  { label: 'Engineering', href: '#' },
  { label: 'Design System' },
]
const long: BreadcrumbItem[] = [
  { label: 'Workspace', href: '#' },
  { label: 'Engineering', href: '#' },
  { label: 'Frontend', href: '#' },
  { label: 'Design System', href: '#' },
  { label: 'Molecules', href: '#' },
  { label: 'Breadcrumb' },
]

const meta: Meta<typeof Breadcrumb> = {
  title: 'Molecules/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
  args: { items: short, size: 'md', truncation: 'middle' },
}

export default meta
type Story = StoryObj<typeof Breadcrumb>

export const Default: Story = {
  render: args => ({ components: { Breadcrumb }, setup: () => ({ args }), template: '<Breadcrumb v-bind="args" />' }),
}

export const Variants: Story = {
  render: () => ({
    components: { Breadcrumb },
    setup: () => ({ short, long }),
    template: `
      <div class="flex flex-col gap-3">
        <Breadcrumb :items="short" />
        <Breadcrumb :items="long" truncation="middle" />
        <Breadcrumb :items="long" truncation="end" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Breadcrumb },
    setup: () => ({ short }),
    template: `
      <div class="flex flex-col gap-3">
        <Breadcrumb :items="short" size="sm" />
        <Breadcrumb :items="short" size="md" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { Breadcrumb },
    setup: () => ({ short }),
    template: `
      <div class="flex flex-col gap-3">
        <Breadcrumb :items="short" />
        <Breadcrumb :items="[{ label: 'Single segment' }]" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Breadcrumb },
    setup: () => ({ short }),
    template: `
      <div class="flex flex-col gap-3">
        <Breadcrumb :items="short" />
        <div data-density="compact"><Breadcrumb :items="short" /></div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { Breadcrumb },
    setup: () => ({ short }),
    template: `
      <div class="w-[640px] rounded-lg border border-border bg-card p-4">
        <Breadcrumb :items="short" />
        <h1 class="mt-2 text-lg font-semibold text-foreground">Design System</h1>
      </div>
    `,
  }),
}
