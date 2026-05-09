import type { Meta, StoryObj } from '@storybook/vue3'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'

const meta: Meta<typeof Tabs> = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Tabs>

export const Default: Story = {
  render: () => ({
    components: { Tabs, TabsList, TabsTrigger, TabsContent },
    template: `
      <Tabs default-value="details" class="w-96">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="record">Approval Record</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>
        <TabsContent value="details" class="mt-3 text-sm">
          <p>App: 石林's Feishu CLI</p>
          <p>Submitted: 2026-05-07 23:45</p>
        </TabsContent>
      </Tabs>
    `,
  }),
}

export const TwoTabs: Story = {
  render: () => ({
    components: { Tabs, TabsList, TabsTrigger, TabsContent },
    template: `
      <Tabs default-value="contacts" class="w-72">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="contacts">联系人</TabsTrigger>
          <TabsTrigger value="groups">群组</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts" class="mt-3 text-sm text-muted-foreground">
          12 个联系人
        </TabsContent>
      </Tabs>
    `,
  }),
}
