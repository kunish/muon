import { ref } from 'vue'

const visible = ref(false)
const currentUrl = ref('')
const currentType = ref<'image' | 'video'>('image')

export function useMediaViewer() {
  function openImage(url: string) {
    currentUrl.value = url
    currentType.value = 'image'
    visible.value = true
  }

  function openVideo(url: string) {
    currentUrl.value = url
    currentType.value = 'video'
    visible.value = true
  }

  function close() {
    visible.value = false
    currentUrl.value = ''
  }

  return { visible, currentUrl, currentType, openImage, openVideo, close }
}
