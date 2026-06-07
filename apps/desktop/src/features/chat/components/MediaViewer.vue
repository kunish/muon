<script setup lang="ts">
import { Download, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { save } from '@/desktop/dialog';
import { writeFile } from '@/desktop/fs';
import { fetch as desktopFetch } from '@/desktop/http';
import { useMediaViewer } from '../composables/useMediaViewer';

const { visible, currentUrl, currentType, close } = useMediaViewer();

const { t } = useI18n();

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;
const PAN_STEP = 40;

interface DragStart {
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
}

const scale = shallowRef(1);
const rotation = shallowRef(0);
const offsetX = shallowRef(0);
const offsetY = shallowRef(0);
const isDragging = shallowRef(false);
const dragStart = shallowRef<DragStart>({
  pointerX: 0,
  pointerY: 0,
  offsetX: 0,
  offsetY: 0,
});

const imageTransform = computed(
  () => `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value}) rotate(${rotation.value}deg)`,
);

const imageCursorClass = computed(() => (isDragging.value ? 'cursor-grabbing' : 'cursor-grab'));
const imageMotionClass = computed(() => (isDragging.value ? '' : 'transition-transform duration-150'));

function setScale(nextScale: number) {
  scale.value = Math.min(Math.max(Number(nextScale.toFixed(2)), MIN_SCALE), MAX_SCALE);
}

function zoomIn() {
  setScale(scale.value + SCALE_STEP);
}
function zoomOut() {
  setScale(scale.value - SCALE_STEP);
}
function rotate() {
  rotation.value = (rotation.value + 90) % 360;
}
function panBy(deltaX: number, deltaY: number) {
  offsetX.value += deltaX;
  offsetY.value += deltaY;
}

function resetView() {
  scale.value = 1;
  rotation.value = 0;
  offsetX.value = 0;
  offsetY.value = 0;
  stopDrag();
}

async function download() {
  const url = currentUrl.value;
  if (!url) return;

  // Determine a default file name from the URL
  const urlPath = url.split('?')[0];
  const segments = urlPath.split('/');
  const defaultName = segments.at(-1) || (currentType.value === 'image' ? 'image.png' : 'video.mp4');

  const savePath = await save({
    defaultPath: defaultName,
    filters:
      currentType.value === 'image'
        ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
        : [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov'] }],
  });
  if (!savePath) return;

  try {
    const res = await desktopFetch(url);
    const buf = await res.arrayBuffer();
    await writeFile(savePath, new Uint8Array(buf));
  } catch {
    toast.error(t('chat.download_failed'));
  }
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    resetAndClose();
  }
}

function resetAndClose() {
  resetView();
  close();
}

function onWheel(e: WheelEvent) {
  if (currentType.value !== 'image') return;

  e.preventDefault();
  if (e.deltaY < 0) zoomIn();
  else if (e.deltaY > 0) zoomOut();
}

function onImagePointerDown(e: PointerEvent) {
  if (currentType.value !== 'image' || e.button !== 0) return;

  e.preventDefault();
  isDragging.value = true;
  dragStart.value = {
    pointerX: e.clientX,
    pointerY: e.clientY,
    offsetX: offsetX.value,
    offsetY: offsetY.value,
  };

  const target = e.currentTarget as HTMLElement | null;
  target?.setPointerCapture?.(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return;

  offsetX.value = dragStart.value.offsetX + e.clientX - dragStart.value.pointerX;
  offsetY.value = dragStart.value.offsetY + e.clientY - dragStart.value.pointerY;
}

function stopDrag() {
  isDragging.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (!visible.value) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    resetAndClose();
    return;
  }

  if (currentType.value !== 'image' || e.metaKey || e.ctrlKey || e.altKey) return;

  const panStep = e.shiftKey ? PAN_STEP * 2 : PAN_STEP;
  let handled = true;

  switch (e.key) {
    case '+':
    case '=':
      zoomIn();
      break;
    case '-':
    case '_':
      zoomOut();
      break;
    case '0':
      resetView();
      break;
    case 'r':
    case 'R':
      rotate();
      break;
    case 'ArrowLeft':
      panBy(-panStep, 0);
      break;
    case 'ArrowRight':
      panBy(panStep, 0);
      break;
    case 'ArrowUp':
      panBy(0, -panStep);
      break;
    case 'ArrowDown':
      panBy(0, panStep);
      break;
    default:
      handled = false;
  }

  if (handled) e.preventDefault();
}

watch(visible, (isVisible) => {
  if (isVisible) resetView();
  else stopDrag();
});

watch(currentUrl, (url, previousUrl) => {
  if (visible.value && url && url !== previousUrl) resetView();
});

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', stopDrag);
  window.removeEventListener('pointercancel', stopDrag);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      data-testid="media-viewer-dialog"
      role="dialog"
      aria-modal="true"
      class="fixed inset-0 z-50 bg-black/80"
    >
      <!-- Toolbar -->
      <div class="absolute top-4 right-4 flex items-center gap-2 z-10" @click.stop>
        <template v-if="currentType === 'image'">
          <button
            type="button"
            class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            :aria-label="t('chat.media_zoom_in')"
            :title="t('chat.media_zoom_in')"
            @click="zoomIn"
          >
            <ZoomIn :size="18" />
          </button>
          <button
            type="button"
            class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            :aria-label="t('chat.media_zoom_out')"
            :title="t('chat.media_zoom_out')"
            @click="zoomOut"
          >
            <ZoomOut :size="18" />
          </button>
          <button
            type="button"
            class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            :aria-label="t('chat.media_rotate')"
            :title="t('chat.media_rotate')"
            @click="rotate"
          >
            <RotateCw :size="18" />
          </button>
        </template>
        <button
          type="button"
          class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          :aria-label="t('chat.download')"
          :title="t('chat.download')"
          @click="download"
        >
          <Download :size="18" />
        </button>
        <button
          type="button"
          class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          :aria-label="t('common.close')"
          :title="t('common.close')"
          @click="resetAndClose"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Content -->
      <div
        data-testid="media-viewer-stage"
        class="flex h-full w-full items-center justify-center overflow-hidden"
        @click="onBackdrop"
        @wheel="onWheel"
      >
        <img
          v-if="currentType === 'image'"
          data-testid="media-viewer-image"
          :src="currentUrl"
          draggable="false"
          class="max-w-[90vw] max-h-[90vh] select-none object-contain"
          :class="[imageCursorClass, imageMotionClass]"
          :style="{ transform: imageTransform }"
          @click.stop
          @dblclick.stop="resetView"
          @pointerdown.stop="onImagePointerDown"
        />
        <video v-else :src="currentUrl" controls autoplay class="max-w-[90vw] max-h-[90vh]" @click.stop />
      </div>
    </div>
  </Teleport>
</template>
