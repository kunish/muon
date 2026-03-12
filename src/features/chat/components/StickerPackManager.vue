<script setup lang="ts">
import type { ImageSticker } from '@/shared/data/stickerPacks'
import { uploadMedia } from '@matrix/media'
import { ask } from '@tauri-apps/plugin-dialog'
import { ArrowLeft, ImagePlus, Plus, Trash2, X } from 'lucide-vue-next'
import { computed, defineComponent, h, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useAuthMedia } from '@/shared/composables/useAuthMedia'
import { useStickerStore } from '../stores/stickerStore'

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const stickerStore = useStickerStore()

// 当前视图: 'list' | 'detail'
const view = ref<'list' | 'detail'>('list')
const activePackId = ref<string | null>(null)

const activePack = computed(() =>
  activePackId.value ? stickerStore.getPackById(activePackId.value) : null,
)

// 新建包
const newPackName = ref('')
const showNewPackInput = ref(false)

function createPack() {
  const name = newPackName.value.trim()
  if (!name)
    return
  const pack = stickerStore.createPack(name)
  newPackName.value = ''
  showNewPackInput.value = false
  // 跳转到新建的包详情
  activePackId.value = pack.id
  view.value = 'detail'
}

async function deletePack(packId: string) {
  const confirmed = await ask(t('chat.sticker_delete_confirm'), { title: t('chat.sticker_delete_title'), kind: 'warning' })
  if (!confirmed)
    return
  stickerStore.deletePack(packId)
  if (activePackId.value === packId) {
    activePackId.value = null
    view.value = 'list'
  }
}

function openPack(packId: string) {
  activePackId.value = packId
  view.value = 'detail'
}

function backToList() {
  view.value = 'list'
  activePackId.value = null
}

// 上传贴纸
const uploading = ref(false)

async function addStickers() {
  if (!activePackId.value)
    return

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/webp,image/gif,image/jpeg'
  input.multiple = true
  input.onchange = async () => {
    const files = input.files
    if (!files || files.length === 0)
      return
    uploading.value = true
    try {
      for (const file of Array.from(files)) {
        // 读取图片尺寸
        const { width, height } = await getImageDimensions(file)
        // 上传到 Matrix
        const mxcUrl = await uploadMedia(file)
        const sticker: ImageSticker = {
          id: `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          mxcUrl,
          width,
          height,
          mimetype: file.type || 'image/png',
          size: file.size,
        }
        stickerStore.addSticker(activePackId.value!, sticker)
      }
    }
    catch {
      toast.error(t('auth.error'))
    }
    finally {
      uploading.value = false
    }
  }
  input.click()
}

function getImageDimensions(file: File): Promise<{ width: number, height: number }> {
  return new Promise((resolve, _reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      resolve({ width: 128, height: 128 })
    }
    img.src = URL.createObjectURL(file)
  })
}

function removeSticker(stickerId: string) {
  if (!activePackId.value)
    return
  stickerStore.removeSticker(activePackId.value, stickerId)
}

// 贴纸缩略图子组件
const StickerThumb = defineComponent({
  name: 'StickerThumb',
  props: { mxcUrl: { type: String, required: true } },
  setup(props) {
    const src = useAuthMedia(toRef(props, 'mxcUrl'), 120, 120)
    return () =>
      src.value
        ? h('img', { src: src.value, class: 'w-full h-full rounded-lg object-cover' })
        : h('div', { class: 'w-full h-full rounded-lg bg-muted/40 animate-pulse' })
  },
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div class="w-[420px] max-h-[520px] bg-popover border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <!-- 头部 -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-border">
          <div class="flex items-center gap-2">
            <button
              v-if="view === 'detail'"
              class="p-1 rounded-md hover:bg-accent transition-colors"
              @click="backToList"
            >
              <ArrowLeft :size="16" />
            </button>
            <h3 class="text-sm font-semibold">
              {{ view === 'list' ? t('chat.sticker_mgr_title') : activePack?.name || '' }}
            </h3>
          </div>
          <button
            class="p-1 rounded-md hover:bg-accent transition-colors"
            @click="emit('close')"
          >
            <X :size="16" />
          </button>
        </div>

        <!-- 内容 -->
        <div class="flex-1 overflow-y-auto">
          <!-- 列表视图 -->
          <template v-if="view === 'list'">
            <div class="p-3 space-y-1.5">
              <!-- 现有包列表 -->
              <div
                v-for="pack in stickerStore.customPacks"
                :key="pack.id"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group"
                @click="openPack(pack.id)"
              >
                <div class="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                  <template v-if="pack.stickers.length > 0">
                    <StickerThumb :mxc-url="pack.stickers[0].mxcUrl" />
                  </template>
                  <template v-else>
                    📦
                  </template>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">
                    {{ pack.name }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ t('chat.sticker_count', { count: pack.stickers.length }) }}
                  </div>
                </div>
                <button
                  class="p-1.5 rounded-md text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                  :title="t('chat.sticker_delete_title')"
                  @click.stop="deletePack(pack.id)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>

              <!-- 空状态 -->
              <div
                v-if="stickerStore.customPacks.length === 0"
                class="flex flex-col items-center justify-center py-12 text-muted-foreground"
              >
                <div class="text-3xl mb-2">
                  📦
                </div>
                <div class="text-sm">
                  {{ t('chat.sticker_no_packs') }}
                </div>
                <div class="text-xs mt-1">
                  {{ t('chat.sticker_no_packs_hint') }}
                </div>
              </div>
            </div>

            <!-- 新建包 -->
            <div class="border-t border-border p-3">
              <template v-if="showNewPackInput">
                <div class="flex items-center gap-2">
                  <input
                    v-model="newPackName"
                    class="flex-1 px-3 py-2 text-sm rounded-lg bg-muted border border-border outline-none focus:border-primary transition-colors"
                    :placeholder="t('chat.sticker_name_placeholder')"
                    autofocus
                    @keydown.enter="createPack"
                    @keydown.escape="showNewPackInput = false"
                  >
                  <button
                    class="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                    :disabled="!newPackName.trim()"
                    @click="createPack"
                  >
                    {{ t('chat.sticker_create') }}
                  </button>
                  <button
                    class="p-2 rounded-lg hover:bg-accent transition-colors"
                    @click="showNewPackInput = false"
                  >
                    <X :size="14" />
                  </button>
                </div>
              </template>
              <template v-else>
                <button
                  class="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-lg border border-dashed border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                  @click="showNewPackInput = true"
                >
                  <Plus :size="16" />
                  {{ t('chat.sticker_new_pack') }}
                </button>
              </template>
            </div>
          </template>

          <!-- 包详情视图 -->
          <template v-else-if="activePack">
            <div class="p-3">
              <!-- 贴纸网格 -->
              <div v-if="activePack.stickers.length > 0" class="grid grid-cols-4 gap-2">
                <div
                  v-for="sticker in activePack.stickers"
                  :key="sticker.id"
                  class="relative group"
                >
                  <div class="aspect-square rounded-xl overflow-hidden bg-muted/30">
                    <StickerThumb :mxc-url="sticker.mxcUrl" />
                  </div>
                  <button
                    class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    :title="t('chat.sticker_remove')"
                    @click="removeSticker(sticker.id)"
                  >
                    <X :size="10" />
                  </button>
                  <div class="text-[10px] text-muted-foreground truncate text-center mt-0.5">
                    {{ sticker.name }}
                  </div>
                </div>
              </div>

              <!-- 空状态 -->
              <div
                v-else
                class="flex flex-col items-center justify-center py-12 text-muted-foreground"
              >
                <ImagePlus :size="32" class="mb-2 opacity-50" />
                <div class="text-sm">
                  {{ t('chat.sticker_pack_empty') }}
                </div>
                <div class="text-xs mt-1">
                  {{ t('chat.sticker_pack_empty_hint') }}
                </div>
              </div>
            </div>

            <!-- 底部操作 -->
            <div class="border-t border-border p-3 flex gap-2">
              <button
                class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                :disabled="uploading"
                @click="addStickers"
              >
                <ImagePlus :size="16" />
                {{ uploading ? t('chat.sticker_uploading') : t('chat.sticker_add') }}
              </button>
              <button
                class="px-3 py-2.5 text-sm rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                @click="deletePack(activePack.id)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
