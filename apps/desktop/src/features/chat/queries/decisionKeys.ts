export const decisionKeys = {
  all: ['decisions'] as const,
  cards: () => [...decisionKeys.all, 'cards'] as const,
}
