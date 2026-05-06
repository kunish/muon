import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const RE_AMP = /&/g
const RE_LT = /</g
const RE_GT = />/g
const RE_QUOT = /"/g
const RE_APOS = /'/g

/**
 * Escape HTML special characters in a string.
 * Safe for embedding user-provided text in HTML.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(RE_AMP, '&amp;')
    .replace(RE_LT, '&lt;')
    .replace(RE_GT, '&gt;')
    .replace(RE_QUOT, '&quot;')
    .replace(RE_APOS, '&#39;')
}
