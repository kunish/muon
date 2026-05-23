<script setup lang="ts">
import { blockUser, getUserPresenceInfo, isUserBlocked, unblockUser } from '@matrix/index';
import { formatDistanceToNow } from 'date-fns';
import { enUS, zhCN } from 'date-fns/locale';
import { Ban, MessageSquare, Phone, Save, Star, StickyNote, Tag, Video } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { useContactStore } from '../stores/contactStore';

const emit = defineEmits<{
  message: [userId: string];
  audioCall: [userId: string];
  videoCall: [userId: string];
}>();

const { t, locale } = useI18n();

const store = useContactStore();

const contact = computed(() => store.contacts.find((c) => c.userId === store.selectedContactId));

const tagInput = ref('');
const noteInput = ref('');
const updatingBlock = ref(false);

const profile = computed(() => {
  if (!contact.value) return store.contactProfileFor('');
  return store.contactProfileFor(contact.value.userId);
});

watch(
  () => contact.value?.userId,
  (userId) => {
    if (!userId) {
      tagInput.value = '';
      noteInput.value = '';
      return;
    }

    const nextProfile = store.contactProfileFor(userId);
    store.updateContactProfile(userId, {
      isBlocked: nextProfile.isBlocked || isUserBlocked(userId),
    });
    tagInput.value = nextProfile.tag;
    noteInput.value = nextProfile.note;
  },
  { immediate: true },
);

const presenceInfo = computed(() => {
  if (!contact.value) return null;
  return getUserPresenceInfo(contact.value.userId);
});

const presenceLabel = computed(() => {
  if (!presenceInfo.value) return t('contacts.offline');
  const { presence, lastActiveAgo } = presenceInfo.value;
  if (presence === 'online') return t('contacts.online');
  if (lastActiveAgo && lastActiveAgo > 0) {
    const lastSeenDate = new Date(Date.now() - lastActiveAgo);
    const dateFnsLocale = locale.value === 'zh' ? zhCN : enUS;
    return `${formatDistanceToNow(lastSeenDate, { locale: dateFnsLocale, addSuffix: true })}${t('contacts.online')}`;
  }
  return t('contacts.offline');
});

const profileStatus = computed(() => {
  const states: string[] = [];
  if (profile.value.isFavorite) states.push(t('contacts.favorite_on'));
  if (profile.value.isBlocked) states.push(t('contacts.blocked_on'));
  if (profile.value.tag) states.push(profile.value.tag);

  return states.length > 0 ? states.join(' / ') : t('contacts.relationship_default');
});

function saveProfile(): void {
  if (!contact.value) return;

  store.updateContactProfile(contact.value.userId, {
    note: noteInput.value.trim(),
    tag: tagInput.value.trim(),
  });
}

function toggleFavorite(): void {
  if (!contact.value) return;
  store.toggleContactFavorite(contact.value.userId);
}

async function toggleBlocked(): Promise<void> {
  if (!contact.value) return;
  if (updatingBlock.value) return;

  const userId = contact.value.userId;
  const previousBlocked = profile.value.isBlocked;
  const nextBlocked = !profile.value.isBlocked;
  updatingBlock.value = true;
  store.updateContactProfile(userId, { isBlocked: nextBlocked });
  try {
    if (nextBlocked) {
      await blockUser(userId);
    } else {
      await unblockUser(userId);
    }
  } catch {
    store.updateContactProfile(userId, { isBlocked: previousBlocked });
    toast.error(t('contacts.profile_failed'));
  } finally {
    updatingBlock.value = false;
  }
}
</script>

<template>
  <div v-if="contact" class="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto p-6">
    <div class="workspace-surface mx-auto w-full max-w-[720px] rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div
          class="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-2xl font-semibold text-primary"
        >
          {{ contact.displayName.slice(0, 1) }}
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-[24px] font-semibold leading-8">
            {{ contact.displayName }}
          </h3>
          <p class="mt-1 truncate text-[13px] text-muted-foreground">
            {{ contact.userId }}
          </p>
          <div
            class="mt-3 flex items-center gap-1.5 text-[12px] font-semibold"
            :class="presenceInfo?.presence === 'online' ? 'text-success' : 'text-muted-foreground'"
          >
            <div
              class="h-2 w-2 rounded-full"
              :class="presenceInfo?.presence === 'online' ? 'bg-success' : 'bg-muted-foreground/30'"
            />
            {{ presenceLabel }}
          </div>
          <p v-if="presenceInfo?.statusMsg" class="mt-2 max-w-[420px] truncate text-[13px] text-muted-foreground">
            {{ presenceInfo.statusMsg }}
          </p>
        </div>
      </div>

      <div class="mt-6 grid gap-2 sm:grid-cols-3">
        <button
          class="flex h-20 flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted text-[12px] font-semibold transition-colors hover:bg-accent"
          @click="emit('message', contact!.userId)"
        >
          <MessageSquare :size="20" class="text-primary" />
          <span>{{ t('contacts.message') }}</span>
        </button>
        <button
          class="flex h-20 flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted text-[12px] font-semibold transition-colors hover:bg-accent"
          @click="emit('audioCall', contact!.userId)"
        >
          <Phone :size="20" class="text-primary" />
          <span>{{ t('contacts.voice_call') }}</span>
        </button>
        <button
          class="flex h-20 flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted text-[12px] font-semibold transition-colors hover:bg-accent"
          @click="emit('videoCall', contact!.userId)"
        >
          <Video :size="20" class="text-primary" />
          <span>{{ t('contacts.video_call') }}</span>
        </button>
      </div>

      <div class="mt-6 border-t border-border pt-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-[13px] font-semibold text-foreground">
              {{ t('contacts.relationship_management') }}
            </div>
            <div data-testid="contacts-profile-status" class="mt-1 text-[12px] text-muted-foreground">
              {{ profileStatus }}
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              data-testid="contacts-toggle-favorite"
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold transition-colors"
              :class="
                profile.isFavorite
                  ? 'border-warning/40 bg-warning/10 text-warning'
                  : 'border-border bg-muted text-muted-foreground hover:bg-accent'
              "
              :aria-pressed="profile.isFavorite"
              @click="toggleFavorite"
            >
              <Star :size="14" :fill="profile.isFavorite ? 'currentColor' : 'none'" />
              <span>{{ profile.isFavorite ? t('contacts.favorite_on') : t('contacts.favorite') }}</span>
            </button>
            <button
              data-testid="contacts-toggle-blocked"
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold transition-colors"
              :class="
                profile.isBlocked
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-border bg-muted text-muted-foreground hover:bg-accent'
              "
              :aria-pressed="profile.isBlocked"
              :disabled="updatingBlock"
              @click="toggleBlocked"
            >
              <Ban :size="14" />
              <span>{{ profile.isBlocked ? t('contacts.blocked_on') : t('contacts.block') }}</span>
            </button>
          </div>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <label class="min-w-0 text-[12px] font-semibold text-muted-foreground">
            <span class="mb-1 flex items-center gap-1.5">
              <Tag :size="13" />
              {{ t('contacts.relationship_tag') }}
            </span>
            <input
              v-model="tagInput"
              data-testid="contacts-profile-tag-input"
              type="text"
              :placeholder="t('contacts.relationship_tag_placeholder')"
              class="h-9 w-full rounded-md border border-border bg-background px-3 text-[13px] font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </label>
          <label class="min-w-0 text-[12px] font-semibold text-muted-foreground">
            <span class="mb-1 flex items-center gap-1.5">
              <StickyNote :size="13" />
              {{ t('contacts.relationship_note') }}
            </span>
            <textarea
              v-model="noteInput"
              data-testid="contacts-profile-note-input"
              :rows="2"
              :placeholder="t('contacts.relationship_note_placeholder')"
              class="min-h-[72px] w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </label>
        </div>

        <div class="mt-3 flex justify-end">
          <button
            data-testid="contacts-save-profile"
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            @click="saveProfile"
          >
            <Save :size="14" />
            <span>{{ t('common.save') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center text-sm text-muted-foreground">
    {{ t('contacts.select_contact') }}
  </div>
</template>
