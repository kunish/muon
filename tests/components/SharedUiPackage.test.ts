import { Button } from '@muon/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@muon/ui/card'
import { FieldInput, Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
import { FieldTextarea } from '@muon/ui/textarea'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

describe('shared ui package', () => {
  it('exposes shadcn primitives through the monorepo package', () => {
    const wrapper = mount({
      components: { Button, Card, CardContent, CardHeader, CardTitle, Input, Label },
      template: `
        <Card>
          <CardHeader>
            <CardTitle>Shared UI</CardTitle>
          </CardHeader>
          <CardContent>
            <Label for="shared-ui-input">Name</Label>
            <Input id="shared-ui-input" model-value="Muon" />
            <Button>Save</Button>
          </CardContent>
        </Card>
      `,
    })

    expect(wrapper.text()).toContain('Shared UI')
    expect(wrapper.get('button').classes()).toEqual(expect.arrayContaining(['bg-primary']))
    expect(wrapper.get('input').attributes('id')).toBe('shared-ui-input')
  })

  it('exposes shared input field wrappers with labels, slots, and validation state', async () => {
    const wrapper = mount({
      components: { FieldInput, FieldTextarea },
      data: () => ({ name: 'Muon', notes: '' }),
      template: `
        <form>
          <FieldInput
            v-model="name"
            label="Workspace name"
            error="Name is required"
            hint="Shown in the app switcher"
          >
            <template #prefix>@</template>
            <template #suffix>.local</template>
          </FieldInput>
          <FieldTextarea
            v-model="notes"
            label="Notes"
            hint="Optional internal description"
          />
        </form>
      `,
    })

    expect(wrapper.text()).toContain('Workspace name')
    expect(wrapper.text()).toContain('@')
    expect(wrapper.text()).toContain('.local')
    expect(wrapper.text()).toContain('Name is required')
    expect(wrapper.text()).toContain('Optional internal description')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')

    await wrapper.get('input').setValue('Muon Enterprise')

    expect((wrapper.vm as unknown as { name: string }).name).toBe('Muon Enterprise')
  })
})
