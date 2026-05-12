import type { Meta, StoryObj } from '@storybook/vue3'
import { FileChip } from '../../molecules/file-chip'

const meta: Meta<typeof FileChip> = {
  title: 'Molecules/FileChip',
  component: FileChip,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
    removable: { control: 'boolean' },
    downloadable: { control: 'boolean' },
  },
  args: { name: 'report.pdf', size: 'md', removable: false, downloadable: false },
}

export default meta
type Story = StoryObj<typeof FileChip>

export const Default: Story = {
  render: args => ({ components: { FileChip }, setup: () => ({ args }), template: '<FileChip v-bind="args" />' }),
}

export const Variants: Story = {
  render: () => ({
    components: { FileChip },
    template: `
      <div class="flex flex-wrap gap-2">
        <FileChip name="brief.docx" />
        <FileChip name="budget.xlsx" />
        <FileChip name="contract.pdf" />
        <FileChip name="hero.png" />
        <FileChip name="demo.mp4" />
        <FileChip name="podcast.mp3" />
        <FileChip name="archive.zip" />
        <FileChip name="readme" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { FileChip },
    template: `
      <div class="flex items-end gap-2">
        <FileChip name="report.pdf" size="sm" />
        <FileChip name="report.pdf" size="md" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { FileChip },
    template: `
      <div class="flex flex-wrap gap-2">
        <FileChip name="report.pdf" />
        <FileChip name="report.pdf" byte-size="1.2 MB" />
        <FileChip name="report.pdf" removable />
        <FileChip name="report.pdf" downloadable />
        <FileChip name="very-long-file-name-that-should-truncate.docx" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { FileChip },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex gap-2"><FileChip name="report.pdf" /></div>
        <div data-density="compact" class="flex gap-2"><FileChip name="report.pdf" /></div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { FileChip },
    template: `
      <div class="w-[480px] rounded-lg border border-border bg-card p-4">
        <div class="mb-2 text-sm text-gray-700">Attachments</div>
        <div class="flex flex-wrap gap-2">
          <FileChip name="design-system.docx" byte-size="240 KB" removable />
          <FileChip name="screenshot.png" byte-size="1.4 MB" removable />
        </div>
      </div>
    `,
  }),
}
