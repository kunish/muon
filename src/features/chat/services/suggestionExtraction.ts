import type { CreateDecisionSuggestionInput } from '../types/decision'
import type { DigestEntry } from '../types/knowledge'

const SUGGESTION_PATTERNS: Array<{ kind: CreateDecisionSuggestionInput['kind'], regex: RegExp }> = [
  { kind: 'action', regex: /action:\s*([^.!?]+[.!?]?)/gi },
  { kind: 'blocker', regex: /blocker:\s*([^.!?]+[.!?]?)/gi },
]

export function extractSuggestionsFromSummary(entry: DigestEntry): CreateDecisionSuggestionInput[] {
  const source = `${entry.title}. ${entry.summary}`
  const suggestions: CreateDecisionSuggestionInput[] = []

  for (const { kind, regex } of SUGGESTION_PATTERNS) {
    const matches = Array.from(source.matchAll(regex))

    matches.forEach((match, index) => {
      const summary = match[1]?.trim()
      if (!summary)
        return

      suggestions.push({
        id: `${entry.id}:${kind}:${index}`,
        kind,
        summary,
        citations: entry.citations,
      })
    })
  }

  return suggestions
}
