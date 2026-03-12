<script setup lang="ts">
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { Camera, FileUp, Image, ImagePlus, MapPin, Plus, Sticker, UserCircle, Video } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getFloatingPosition } from '../composables/useFloatingPosition'

const emit = defineEmits<{
  image: [file: File]
  video: [file: File]
  file: [file: File]
  gif: []
  sticker: []
  location: []
  screenshot: []
  contactCard: []
}>()

const { t } = useI18n()
const open = ref(false)
const btnRef = ref<HTMLElement>()
const menuRef = ref<HTMLElement>()
const menuStyle = ref({ left: '0px', top: '0px' })

interface FileFilter {
  name: string
  extensions: string[]
}

const imageFilter: FileFilter[] = [
  { name: t('chat.attach_image'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'] },
]
const videoFilter: FileFilter[] = [
  { name: t('chat.attach_video'), extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] },
]

function updatePosition() {
  const trigger = btnRef.value
  const panel = menuRef.value
  if (!trigger || !panel)
    return
  menuStyle.value = getFloatingPosition(trigger, panel)
}

function toggle() {
  if (!open.value)
    updatePosition()
  open.value = !open.value
}

async function pickFile(filters: FileFilter[] | undefined, type: 'image' | 'video' | 'file') {
  open.value = false
  try {
    const selected = await openDialog({ multiple: false, filters })
    if (!selected)
      return
    const path = selected
    const name = path.split('/').pop() || path.split('\\').pop() || 'file'
    const bytes = await readFile(path)
    const ext = name.split('.').pop()?.toLowerCase() || ''
    const mime = guessMime(ext, type)
    const file = new File([bytes], name, { type: mime })

    if (type === 'image')
      emit('image', file)
    else if (type === 'video')
      emit('video', file)
    else
      emit('file', file)
  }
  catch {
    // File dialog cancelled or read failed — no user notification needed
  }
}

function guessMime(ext: string, type: string): string {
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
  }
  return map[ext] || (type === 'image' ? 'image/png' : type === 'video' ? 'video/mp4' : 'application/octet-stream')
}

function onClickOutside(e: MouseEvent) {
  if (!open.value)
    return
  const target = e.target as HTMLElement
  if (btnRef.value?.contains(target) || menuRef.value?.contains(target))
    return
  open.value = false
}

onMounted(() => document.addEventListener('pointerdown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onClickOutside))
</script>

<template>
  <div ref="btnRef">
    <button
      class="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
      @click="toggle"
    >
      <Plus :size="18" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="fixed z-50 bg-background border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
        :style="{ left: menuStyle.left, top: menuStyle.top }"
      >
        <button
          class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
          @click="pickFile(imageFilter, 'image')"
        >
          <ImagePlus :size="16" />
          {{ t('chat.attach_image') }}
        </button>
        <button
          class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
          @click="pickFile(videoFilter, 'video')"
        >
          <Video :size="16" />
          {{ t('chat.attach_video') }}
        </button>
        <button
          class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
          @click="pickFile(undefined, 'file')"
        >
          <FileUp :size="16" />
          {{ t('chat.attach_file') }}
        </button>
        <button
          class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
          @click="open = false; emit('gif')"
        >
          <Image :size="16" />
          {{ t('chat.attach_gif') }}
        </button>
        <button
          class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
          @click="open = false; emit('sticker')"
        >
          <Sticker :size="16" />
          {{ t('chat.attach_sticker') }}
        </button>
        <button
          class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
          @click="open = false; emit('screenshot')"
        >
          <Camera :size="16" />
          {{ $t('chat.screenshot') }}
        </button>
        <button
          class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
          @click="open = false; emit('contactCard')"
        >
          <UserCircle :size="16" />
          {{ $t('chat.contact_card') }}
        </button>
        <button
          class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
          @click="open = false; emit('location')"
        >
          <MapPin :size="16" />
          {{ t('chat.attach_location') }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
