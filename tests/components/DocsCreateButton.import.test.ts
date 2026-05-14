import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import DocsCreateButton from '@/features/docs/components/DocsCreateButton.vue'

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/markdown' })
}

describe('docsCreateButton import', () => {
  it('emits importDoc with the selected File and closes the menu', async () => {
    const wrapper = mount(DocsCreateButton, {
      global: { stubs: { Teleport: false } },
      attachTo: document.body,
    })
    await wrapper.find('button').trigger('click')
    await nextTick()

    const importButton = document.querySelector('[data-testid="docs-create-import"]') as HTMLButtonElement
    expect(importButton).toBeTruthy()

    const fileInput = wrapper.find('input[type="file"]').element as HTMLInputElement
    expect(fileInput).toBeTruthy()

    const file = makeFile('notes.md', '# Hello\n\nworld')
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()

    const emitted = wrapper.emitted('importDoc')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toBe(file)

    expect(document.querySelector('[data-testid="docs-create-import"]')).toBeNull()
    wrapper.unmount()
  })
})
