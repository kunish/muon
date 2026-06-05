export const qaKeys = {
  all: ['qa'] as const,
  history: () => [...qaKeys.all, 'history'] as const,
}
