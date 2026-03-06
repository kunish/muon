<script setup lang="ts">
import { loadInboxEventContext } from '@matrix/index'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useQaStore } from '../stores/qaStore'

const { t } = useI18n()
const router = useRouter()
const qaStore = useQaStore()

const question = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const answer = computed(() => qaStore.activeAnswer)
const history = computed(() => qaStore.history)

onMounted(async () => {
  try {
    await qaStore.hydrateHistory()
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
})

async function submitQuestion() {
  loading.value = true
  error.value = null
  try {
    await qaStore.askQuestion(question.value)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    loading.value = false
  }
}

async function openCitation(roomId: string, eventId: string) {
  try {
    await loadInboxEventContext(roomId, eventId)
  }
  catch (err) {
    console.warn('[CrossSessionQaPanel] context preload failed, fallback to direct navigation', err)
  }

  await router.push({
    path: `/dm/${encodeURIComponent(roomId)}`,
    query: {
      focusEventId: eventId,
    },
  })
}

function openHistoryAnswer(answerId: string) {
  qaStore.selectAnswer(answerId)
}
</script>

<template>
  <section class="flex h-full flex-col" data-testid="cross-session-qa-panel">
    <div class="space-y-3 border-b border-border px-4 py-3">
      <textarea
        v-model="question"
        data-testid="qa-question-input"
        class="min-h-20 w-full rounded-md border border-border px-3 py-2 text-sm"
        :placeholder="t('chat.knowledge_question_placeholder')"
      />
      <button
        data-testid="qa-submit-button"
        class="rounded-md border border-primary px-3 py-2 text-sm text-primary"
        :disabled="loading || !question.trim()"
        @click="submitQuestion"
      >
        {{ loading ? t('chat.searching') : t('chat.knowledge_ask') }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-3">
      <div v-if="history.length" class="mb-3 space-y-2" data-testid="qa-history-list">
        <button
          v-for="item in history"
          :key="item.id"
          type="button"
          class="block w-full rounded-md border border-border px-3 py-2 text-left text-sm"
          :data-testid="`qa-history-item-${item.id}`"
          @click="openHistoryAnswer(item.id)"
        >
          {{ item.question }}
        </button>
      </div>

      <div v-if="answer" data-testid="qa-answer-card" class="rounded-md border border-border/70 p-3">
        <div class="text-sm font-semibold text-foreground">
          {{ answer.question }}
        </div>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ answer.answer }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="citation in answer.citations"
            :key="citation.eventId"
            type="button"
            class="rounded border border-border px-2 py-1 text-xs"
            :data-testid="`qa-citation-${citation.eventId}`"
            @click="openCitation(citation.roomId, citation.eventId)"
          >
            {{ t('chat.knowledge_open_citation') }}
          </button>
        </div>
      </div>

      <p v-else-if="error" class="text-sm text-destructive">
        {{ error }}
      </p>

      <p v-else class="text-sm text-muted-foreground">
        {{ t('chat.knowledge_no_answer') }}
      </p>
    </div>
  </section>
</template>
