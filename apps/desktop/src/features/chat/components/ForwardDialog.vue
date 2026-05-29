<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk';
import { getClient } from '@matrix/client';
import { forwardMessages } from '@matrix/messages';
import { Check, Layers, Search, X } from 'lucide-vue-next';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';

const props = defineProps<{
  event?: MatrixEvent;
  roomId?: string;
  eventIds?: string[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();

const client = getClient();
const searchQuery = ref('');
const sending = ref(false);
const selectedRoomIds = reactive(new Set<string>());

const isMergedForward = computed(() => (props.eventIds?.length ?? 0) > 1);
const messageCount = computed(() => props.eventIds?.length ?? 1);
const selectedCount = computed(() => selectedRoomIds.size);

const rooms = computed(() => {
  const all = client.getRooms().filter((r) => r.getMyMembership() === 'join');
  if (!searchQuery.value.trim()) return all;
  const q = searchQuery.value.toLowerCase();
  return all.filter((r) => (r.name || '').toLowerCase().includes(q));
});

function toggleRoom(roomId: string) {
  if (selectedRoomIds.has(roomId)) selectedRoomIds.delete(roomId);
  else selectedRoomIds.add(roomId);
}

async function forwardToRoom(targetRoomId: string) {
  if (props.eventIds?.length && props.roomId) {
    await forwardMessages(props.roomId, targetRoomId, props.eventIds);
  } else if (props.event) {
    const content = props.event.getContent();
    await client.sendMessage(targetRoomId, {
      ...content,
      'm.relates_to': undefined,
    } as any);
  }
}

async function sendToSelected() {
  if (selectedRoomIds.size === 0 || sending.value) return;
  sending.value = true;
  try {
    for (const targetRoomId of selectedRoomIds) {
      await forwardToRoom(targetRoomId);
    }
    emit('close');
  } catch {
    toast.error(t('chat.forward_failed'));
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" @click.self="emit('close')">
      <div class="bg-background rounded-[10px] shadow-2xl w-[520px] max-h-[70vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-border">
          <h3 class="font-medium text-sm">
            {{ isMergedForward ? t('chat.merged_forward') : t('chat.forward_message') }}
          </h3>
          <button class="p-1 rounded hover:bg-accent" @click="emit('close')">
            <X :size="16" />
          </button>
        </div>

        <div
          v-if="isMergedForward"
          class="mx-3 mt-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 flex items-center gap-2"
        >
          <Layers :size="14" class="text-primary" />
          <span class="text-xs text-primary">{{ t('chat.merged_forward_n', { n: messageCount }) }}</span>
        </div>

        <div class="p-3">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
            <Search :size="14" class="text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('chat.search_conversation')"
              class="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-2 pb-2">
          <div
            v-for="r in rooms"
            :key="r.roomId"
            class="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-accent/50"
            :class="selectedRoomIds.has(r.roomId) ? 'bg-accent/40' : ''"
            :data-testid="`forward-room-${r.roomId}`"
            @click="toggleRoom(r.roomId)"
          >
            <div
              class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium"
            >
              {{ (r.name || '?').slice(0, 1) }}
            </div>
            <div class="flex-1 min-w-0 text-sm truncate">
              {{ r.name || r.roomId }}
            </div>
            <span
              class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors"
              :class="
                selectedRoomIds.has(r.roomId)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground/40'
              "
            >
              <Check v-if="selectedRoomIds.has(r.roomId)" :size="12" />
            </span>
          </div>
          <div
            v-if="rooms.length === 0"
            class="px-2 py-8 text-center text-sm text-muted-foreground"
            data-testid="forward-empty"
          >
            {{ t('chat.search_no_match') }}
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-border p-3">
          <button class="rounded-md px-3 py-1.5 text-sm hover:bg-accent" @click="emit('close')">
            {{ t('common.cancel') }}
          </button>
          <button
            class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="selectedCount === 0 || sending"
            data-testid="forward-send"
            @click="sendToSelected"
          >
            {{ sending ? t('chat.sending') : `${t('chat.send')}${selectedCount > 0 ? ` (${selectedCount})` : ''}` }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
