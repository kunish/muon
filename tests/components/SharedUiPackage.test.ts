import { Button } from '@muon/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@muon/ui/card'
import { Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
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
})
