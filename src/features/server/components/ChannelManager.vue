<script setup lang="ts">
import type { ChannelInfo } from '@/matrix/spaces'
import { Button } from '@muon/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@muon/ui/dialog'
import { GripVertical, Hash, Pencil, Trash2, Volume2 } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useServerStore } from '@/features/server/stores/serverStore'
import { getCategoryChannels, getSpaceHierarchy, removeRoomFromSpace } from '@/matrix/spaces'

const props = defineProps<{
  serverId: string
}>()

const serverStore = useServerStore()
const { t } = useI18n()

// ── Types ──

interface ChannelGroup {
  categoryId: string | null
  categoryName: string
  channels: ChannelInfo[]
}

// ── State ──

const channelGroups = ref<ChannelGroup[]>([])
const deleteTarget = ref<{ channel: ChannelInfo, categoryId: string | null } | null>(null)
const showDeleteDialog = ref(false)
const isDeleting = ref(false)

// ── Load data ──

function loadChannels() {
  const { categories, uncategorizedChannels } = getSpaceHierarchy(props.serverId)
  const groups: ChannelGroup[] = []

  if (uncategorizedChannels.length > 0) {
    groups.push({
      categoryId: null,
      categoryName: t('channel.uncategorized'),
      channels: uncategorizedChannels,
    })
  }

  for (const cat of categories) {
    const channels = getCategoryChannels(cat.spaceId)
    groups.push({
      categoryId: cat.spaceId,
      categoryName: cat.name,
      channels,
    })
  }

  channelGroups.value = groups
}

// ── Actions ──

function confirmDelete(channel: ChannelInfo, categoryId: string | null) {
  deleteTarget.value = { channel, categoryId }
  showDeleteDialog.value = true
}

async function handleDelete() {
  if (!deleteTarget.value || isDeleting.value)
    return
  isDeleting.value = true

  const { channel, categoryId } = deleteTarget.value
  try {
    // Remove channel from the space/category
    const parentId = categoryId ?? props.serverId
    await removeRoomFromSpace(parentId, channel.roomId)

    // Also remove from top-level space if it was under a category
    if (categoryId) {
      try {
        await removeRoomFromSpace(props.serverId, channel.roomId)
      }
      catch {
        // May not be directly under top-level space, that's fine
      }
    }

    // Refresh
    loadChannels()
    serverStore.loadChannelTree(props.serverId)
    showDeleteDialog.value = false
    deleteTarget.value = null
  }
  catch (err) {
    console.error('Failed to delete channel:', err)
    toast.error(t('server.channel_failed'))
  }
  finally {
    isDeleting.value = false
  }
}

onMounted(loadChannels)
</script>

<template>
  <div>
    <h2 class="mb-5 text-xl font-bold text-foreground">
      {{ t('channel.channels') }}
    </h2>

    <div v-if="channelGroups.length === 0" class="py-16 text-center">
      <p class="text-sm text-muted-foreground">
        {{ t('server.no_channels') }}
      </p>
    </div>

    <div v-else class="space-y-6">
      <div
        v-for="group in channelGroups"
        :key="group.categoryId ?? '__uncategorized__'"
      >
        <!-- Category header -->
        <div class="mb-2 flex items-center gap-2 px-1">
          <span class="text-xs font-bold uppercase tracking-wide text-muted-foreground/60">
            {{ group.categoryName }}
          </span>
          <span class="text-xs text-muted-foreground/30">
            — {{ group.channels.length }}
          </span>
        </div>

        <!-- Channel list -->
        <div class="space-y-0.5">
          <div
            v-for="channel in group.channels"
            :key="channel.roomId"
            class="group flex items-center gap-2 rounded-[4px] px-2 py-2 transition-colors hover:bg-accent/20"
          >
            <!-- Drag handle (visual only) -->
            <GripVertical
              :size="14"
              class="shrink-0 text-muted-foreground/20 opacity-0 transition-opacity group-hover:opacity-100 cursor-grab"
            />

            <!-- Channel icon -->
            <Hash
              v-if="!channel.isVoice"
              :size="18"
              class="shrink-0 text-muted-foreground/50"
            />
            <Volume2
              v-else
              :size="18"
              class="shrink-0 text-muted-foreground/50"
            />

            <!-- Channel info -->
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-foreground/80">
                {{ channel.name }}
              </div>
              <div v-if="channel.topic" class="truncate text-xs text-muted-foreground/50">
                {{ channel.topic }}
              </div>
            </div>

            <!-- Member count -->
            <span class="text-xs text-muted-foreground/40">
              {{ t('member.member_count', { count: channel.memberCount }) }}
            </span>

            <!-- Actions -->
            <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
                :title="t('channel.edit_channel')"
              >
                <Pencil :size="14" />
              </button>
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                :title="t('channel.delete_channel')"
                @click="confirmDelete(channel, group.categoryId)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation dialog -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('channel.delete_channel') }}</DialogTitle>
          <DialogDescription>
            {{ t('channel.delete_channel_confirm', { name: deleteTarget?.channel.name }) }}
          </DialogDescription>
        </DialogHeader>
        <div class="flex justify-end gap-2">
          <Button variant="ghost" @click="showDeleteDialog = false">
            {{ t('common.cancel') }}
          </Button>
          <Button
            variant="destructive"
            :disabled="isDeleting"
            @click="handleDelete"
          >
            {{ isDeleting ? t('server.deleting') : t('channel.delete_channel') }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
