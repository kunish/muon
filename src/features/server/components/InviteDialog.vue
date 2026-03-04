<script setup lang="ts">
import { Check, Copy, Link } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { getClient } from '@/matrix/client'
import Button from '@/shared/components/ui/button.vue'
import Dialog from '@/shared/components/ui/dialog.vue'
import Input from '@/shared/components/ui/input.vue'

const props = defineProps<{
  spaceId: string
}>()

const open = defineModel<boolean>('open', { default: false })

const copied = ref(false)

const roomAlias = computed(() => {
  try {
    const client = getClient()
    const room = client.getRoom(props.spaceId)
    if (!room)
      return props.spaceId

    // Try canonical alias first
    const aliasEvent = room.currentState.getStateEvents('m.room.canonical_alias', '')
    const alias = aliasEvent?.getContent()?.alias
    if (alias)
      return alias

    // Fallback to room ID
    return props.spaceId
  }
  catch {
    return props.spaceId
  }
})

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(roomAlias.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
  catch {
    // Fallback for non-secure contexts
    const textarea = document.createElement('textarea')
    textarea.value = roomAlias.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <template #trigger>
      <slot name="trigger" />
    </template>

    <div class="space-y-5">
      <div>
        <h2 class="text-xl font-bold text-foreground">
          Invite People
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Share this server's address so others can join.
        </p>
      </div>

      <!-- Room address / alias -->
      <div class="space-y-2">
        <label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Server Address
        </label>
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Link
              :size="14"
              class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40"
            />
            <Input
              :model-value="roomAlias"
              readonly
              class="pl-9 font-mono text-xs"
              @focus="($event.target as HTMLInputElement).select()"
            />
          </div>
          <Button
            :variant="copied ? 'secondary' : 'default'"
            size="default"
            class="shrink-0"
            @click="copyToClipboard"
          >
            <Check v-if="copied" :size="16" class="mr-1.5 text-success" />
            <Copy v-else :size="16" class="mr-1.5" />
            {{ copied ? 'Copied!' : 'Copy' }}
          </Button>
        </div>
      </div>

      <!-- Instructions -->
      <div class="rounded-md bg-[#111214] p-3">
        <p class="text-xs leading-relaxed text-muted-foreground">
          Anyone on the Matrix network can join your server using this address.
          Share it in a DM, another room, or outside of the app.
        </p>
      </div>
    </div>
  </Dialog>
</template>
