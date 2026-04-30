import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = () => readFileSync(resolve(process.cwd(), 'src/features/chat/components/MessageActionBar.vue'), 'utf8')

describe('message action menu transition', () => {
  it('does not animate fixed menu coordinates while its first position is measured', () => {
    const component = source()

    expect(component).toContain('data-testid="message-more-menu"')
    expect(component).toContain('enter-active-class="transition-[opacity,transform] duration-[120ms]')
    expect(component).not.toContain('enter-active-class="transition-all duration-[120ms]')
    expect(component).not.toContain('leave-active-class="transition-all duration-75')
  })

  it('fades the menu out without transform work on close', () => {
    const component = source()

    expect(component).toContain('leave-active-class="transition-opacity duration-75')
    expect(component).toContain('leave-to-class="opacity-0"')
    expect(component).toContain('@after-leave="onMoreMenuAfterLeave"')
    expect(component).not.toContain('leave-active-class="transition-[opacity,transform] duration-75')
    expect(component).not.toContain('leave-to-class="opacity-0 -translate-y-1 scale-[0.96]"')
  })
})
