<script setup lang="ts">
import type { DecisionStatus, DecisionSuggestion, SuggestionDisposition } from '../types/decision'
import { Textarea } from '@muon/ui/textarea'
import { onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { preloadAndNavigate } from '@/shared/lib/contextPreload'
import { useDecisionStore } from '../stores/decisionStore'

const decisionStore = useDecisionStore()
const router = useRouter()
const { locale, t } = useI18n()

const form = reactive({
  conclusion: '',
  context: '',
  owner: '',
  status: 'open' as const,
  roomId: '',
  eventId: '',
})

onMounted(async () => {
  await decisionStore.hydrateCards()
})

async function saveDecisionCard() {
  const missingFields = [
    { label: t('chat.decision_conclusion'), value: form.conclusion },
    { label: t('chat.decision_context'), value: form.context },
    { label: t('chat.decision_owner'), value: form.owner },
    { label: t('chat.decision_room_id'), value: form.roomId },
    { label: t('chat.decision_event_id'), value: form.eventId },
  ]
    .filter(field => !field.value.trim())
    .map(field => field.label)

  if (missingFields.length > 0) {
    const formatter = new Intl.ListFormat(locale.value, { type: 'conjunction' })
    toast.error(t('chat.decision_missing_fields', { fields: formatter.format(missingFields) }))
    return
  }

  await decisionStore.createDecisionCard({
    id: `decision:${Date.now()}`,
    conclusion: form.conclusion.trim(),
    context: form.context.trim(),
    owner: form.owner.trim(),
    status: form.status,
    citations: [{ roomId: form.roomId.trim(), eventId: form.eventId.trim() }],
  })
}

async function acceptSuggestion(decisionId: string, suggestionId: string) {
  try {
    await decisionStore.setSuggestionDisposition(decisionId, suggestionId, 'accepted')
  }
  catch {
    toast.error(t('auth.error'))
  }
}

async function rejectSuggestion(decisionId: string, suggestionId: string) {
  try {
    await decisionStore.setSuggestionDisposition(decisionId, suggestionId, 'rejected')
  }
  catch {
    toast.error(t('auth.error'))
  }
}

async function openLinkedMessage(roomId: string, eventId: string) {
  await preloadAndNavigate(router, roomId, eventId, 'DecisionPanel')
}

function decisionStatusLabel(status: DecisionStatus) {
  return t(`chat.decision_status_${status}`)
}

function suggestionKindLabel(kind: DecisionSuggestion['kind']) {
  return t(`chat.decision_suggestion_kind_${kind}`)
}

function suggestionDispositionLabel(disposition: SuggestionDisposition) {
  return t(`chat.decision_suggestion_disposition_${disposition}`)
}
</script>

<template>
  <section class="flex h-full flex-col" data-testid="decision-panel">
    <header class="border-b border-border px-4 py-3">
      <h3 class="text-sm font-semibold text-foreground">
        {{ t('chat.decision_capture') }}
      </h3>
    </header>

    <div class="space-y-3 border-b border-border px-4 py-3">
      <input v-model="form.conclusion" data-testid="decision-conclusion-input" class="w-full rounded-md border border-border px-3 py-2 text-sm" :placeholder="t('chat.decision_conclusion')">
      <Textarea v-model="form.context" data-testid="decision-context-input" class="min-h-20 w-full rounded-md border border-border px-3 py-2 text-sm" :placeholder="t('chat.decision_context')" />
      <input v-model="form.owner" data-testid="decision-owner-input" class="w-full rounded-md border border-border px-3 py-2 text-sm" :placeholder="t('chat.decision_owner')">
      <div class="grid grid-cols-2 gap-3">
        <input v-model="form.roomId" data-testid="decision-room-input" class="rounded-md border border-border px-3 py-2 text-sm" :placeholder="t('chat.decision_room_id')">
        <input v-model="form.eventId" data-testid="decision-event-input" class="rounded-md border border-border px-3 py-2 text-sm" :placeholder="t('chat.decision_event_id')">
      </div>
      <button data-testid="decision-save-button" class="rounded-md border border-primary px-3 py-2 text-sm text-primary" @click="saveDecisionCard">
        {{ t('chat.decision_save') }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-3">
      <article
        v-for="card in decisionStore.cards"
        :key="card.id"
        class="rounded-md border border-border/70 p-3"
        :data-testid="`decision-card-${card.id}`"
      >
        <div class="text-sm font-semibold text-foreground">
          {{ card.conclusion }}
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ card.context }}
        </p>
        <div class="mt-2 text-xs text-muted-foreground">
          {{ card.owner }} · {{ decisionStatusLabel(card.status) }}
        </div>

        <div v-if="card.citations.length" class="mt-3 space-y-2">
          <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {{ t('chat.decision_linked') }}
          </div>
          <button
            v-for="citation in card.citations"
            :key="citation.eventId"
            class="flex w-full items-start justify-between rounded border border-border/60 px-2 py-2 text-left text-xs"
            :data-testid="`decision-linked-message-${citation.eventId}`"
            @click="openLinkedMessage(citation.roomId, citation.eventId)"
          >
            <span>{{ citation.quote ?? citation.eventId }}</span>
            <span class="text-muted-foreground">{{ t('chat.decision_open') }}</span>
          </button>
        </div>

        <div v-if="card.suggestions.length" class="mt-3 space-y-2">
          <div
            v-for="suggestion in card.suggestions"
            :key="suggestion.id"
            class="rounded border border-border/60 p-2"
            :data-testid="`decision-suggestion-${suggestion.id}`"
          >
            <div class="text-sm text-foreground">
              {{ suggestion.summary }}
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              {{ suggestionKindLabel(suggestion.kind) }} · {{ t('chat.decision_suggestion_source_digest') }} · {{ suggestionDispositionLabel(suggestion.disposition) }}
            </div>
            <div class="mt-2 flex gap-2">
              <button class="rounded border border-border px-2 py-1 text-xs" :data-testid="`decision-accept-${suggestion.id}`" @click="acceptSuggestion(card.id, suggestion.id)">
                {{ t('chat.decision_accept') }}
              </button>
              <button class="rounded border border-border px-2 py-1 text-xs" :data-testid="`decision-reject-${suggestion.id}`" @click="rejectSuggestion(card.id, suggestion.id)">
                {{ t('chat.decision_reject') }}
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
