export const digestKeys = {
  all: ['digest'] as const,
  entries: () => [...digestKeys.all, 'entries'] as const,
}
