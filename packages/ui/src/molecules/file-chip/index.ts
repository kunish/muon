import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as FileChip } from './FileChip.vue'

export const fileChipVariants = cva(
  'inline-flex items-center gap-2 rounded-md transition-colors cursor-default '
  + 'bg-file-chip-bg hover:bg-file-chip-hover-bg',
  {
    variants: {
      size: {
        sm: 'h-6 px-2 text-xs',
        md: 'h-8 px-2.5 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type FileChipVariants = VariantProps<typeof fileChipVariants>

export type FileKind = 'doc' | 'sheet' | 'pdf' | 'img' | 'video' | 'audio' | 'zip' | 'other'

const EXT_MAP: Record<string, FileKind> = {
  'doc': 'doc',
  'docx': 'doc',
  'txt': 'doc',
  'md': 'doc',
  'rtf': 'doc',
  'xls': 'sheet',
  'xlsx': 'sheet',
  'csv': 'sheet',
  'numbers': 'sheet',
  'pdf': 'pdf',
  'png': 'img',
  'jpg': 'img',
  'jpeg': 'img',
  'gif': 'img',
  'webp': 'img',
  'svg': 'img',
  'mp4': 'video',
  'mov': 'video',
  'avi': 'video',
  'mkv': 'video',
  'webm': 'video',
  'mp3': 'audio',
  'wav': 'audio',
  'm4a': 'audio',
  'flac': 'audio',
  'zip': 'zip',
  'rar': 'zip',
  '7z': 'zip',
  'tar': 'zip',
  'gz': 'zip',
}

export const KIND_COLOR: Record<FileKind, string> = {
  doc: 'var(--brand-500)',
  sheet: 'var(--green-500)',
  pdf: 'var(--red-500)',
  img: 'var(--orange-500)',
  video: 'var(--brand-400)',
  audio: 'var(--cyan-500)',
  zip: 'var(--gray-500)',
  other: 'var(--gray-400)',
}

export function inferKind(filename: string): FileKind {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MAP[ext] ?? 'other'
}
