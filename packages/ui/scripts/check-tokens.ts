import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const TOKENS_DIR = resolve(import.meta.dirname, '../src/tokens')
const SRC_DIR = resolve(import.meta.dirname, '../src')

const REQUIRED_ROLES = [
  'background',
  'foreground',
  'muted',
  'muted-foreground',
  'primary',
  'primary-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'card',
  'card-foreground',
  'secondary',
  'secondary-foreground',
  'popover',
  'popover-foreground',
  'success',
  'warning',
  'info',
]

function readAllTokens(): string {
  return readdirSync(TOKENS_DIR)
    .filter(f => f.endsWith('.css'))
    .map(f => readFileSync(resolve(TOKENS_DIR, f), 'utf-8'))
    .join('\n')
}

function readAllSource(): string {
  function walk(dir: string): string[] {
    const out: string[] = []
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, ent.name)
      if (ent.isDirectory())
        out.push(...walk(p))
      else if (/\.(?:vue|ts|css)$/.test(ent.name))
        out.push(p)
    }
    return out
  }
  return walk(SRC_DIR).map(p => readFileSync(p, 'utf-8')).join('\n')
}

const tokens = readAllTokens()

if (!tokens.trim()) {
  console.error(`Token completeness check FAILED: no .css files found in ${TOKENS_DIR}`)
  process.exit(1)
}

const errors: string[] = []

for (const role of REQUIRED_ROLES) {
  // Match e.g. `--color-foreground:` (with optional whitespace before the colon).
  if (!new RegExp(`--color-${role}\\s*:`).test(tokens))
    errors.push(`Missing role token: --color-${role}`)
}

// Collect every distinct --color-* token name appearing anywhere in the token files.
// Char class includes 0-9 to capture suffixes like --color-chart-1.
const lightRoles = (tokens.match(/--color-[a-z0-9-]+/g) ?? []).filter((v, i, a) => a.indexOf(v) === i)
const darkBlock = tokens.split('.dark').slice(1).join('.dark')
for (const role of lightRoles) {
  if (!darkBlock.includes(`${role}:`))
    errors.push(`Missing dark override: ${role}`)
}

// Collect every defined palette stop, e.g. --brand-500, --gray-200.
const definedPalette = (tokens.match(/--(?:brand|gray|red|green|orange|cyan)-\d+/g) ?? [])
const allSource = readAllSource()
const unused = definedPalette.filter(p => !new RegExp(p).test(allSource + tokens))
if (unused.length)
  console.warn(`[warn] Unused palette tokens: ${[...new Set(unused)].join(', ')}`)

if (errors.length) {
  console.error('Token completeness check FAILED:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('Token completeness check PASSED')
