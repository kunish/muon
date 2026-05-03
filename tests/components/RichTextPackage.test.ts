import {
  htmlToPlainText,
  linkifyPlainText,
  renderMarkdownForMatrix,
  RichMessageContent,
  sanitizeMatrixHtml,
} from '@muon/rich-text'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

describe('rich text package', () => {
  it('exposes safe Matrix HTML and markdown helpers', () => {
    expect(sanitizeMatrixHtml('<p>Hello<script>alert(1)</script></p>')).toBe('<p>Hello</p>')

    const rendered = renderMarkdownForMatrix('**Muon** [site](https://muon.local)')

    expect(rendered?.body).toBe('Muon site')
    expect(rendered?.formattedBody).toContain('<strong>Muon</strong>')
    expect(rendered?.formattedBody).toContain('href="https://muon.local"')
    expect(htmlToPlainText('<p>Line <strong>one</strong></p><p>Line two</p>')).toBe('Line one\nLine two')
  })

  it('linkifies plain text while escaping unsafe content', () => {
    expect(linkifyPlainText('Open https://muon.local. <b>no</b>')).toBe(
      'Open <a href="https://muon.local" target="_blank" rel="noopener noreferrer">https://muon.local</a>. &lt;b&gt;no&lt;/b&gt;',
    )
  })

  it('renders sanitized rich message content through a shared component', async () => {
    const wrapper = mount(RichMessageContent, {
      props: {
        class: 'msg-bubble px-3',
        html: '<p>Hello <strong>Muon</strong><script>alert(1)</script></p>',
      },
    })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['rich-message-content', 'msg-bubble', 'px-3']))
    expect(wrapper.html()).toContain('<strong>Muon</strong>')
    expect(wrapper.html()).not.toContain('<script>')
  })
})
