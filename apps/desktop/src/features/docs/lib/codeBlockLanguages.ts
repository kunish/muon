export const DEFAULT_DOC_CODE_LANGUAGE = 'typescript'

export const DOC_CODE_LANGUAGE_OPTIONS = [
  { value: 'plaintext', label: 'Plain text' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'bash', label: 'Bash' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'css', label: 'CSS' },
  { value: 'xml', label: 'HTML/XML' },
  { value: 'markdown', label: 'Markdown' },
] as const

export type DocCodeLanguage = typeof DOC_CODE_LANGUAGE_OPTIONS[number]['value']

export function normalizeDocCodeLanguage(language: unknown): DocCodeLanguage {
  if (typeof language !== 'string')
    return DEFAULT_DOC_CODE_LANGUAGE

  return DOC_CODE_LANGUAGE_OPTIONS.some(option => option.value === language)
    ? language as DocCodeLanguage
    : DEFAULT_DOC_CODE_LANGUAGE
}
