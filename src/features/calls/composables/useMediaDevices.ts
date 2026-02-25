import { ref } from 'vue'

export function useMediaDevices() {
  const audioDevices = ref<MediaDeviceInfo[]>([])
  const videoDevices = ref<MediaDeviceInfo[]>([])

  async function loadDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices()
    audioDevices.value = devices.filter(d => d.kind === 'audioinput')
    videoDevices.value = devices.filter(d => d.kind === 'videoinput')
  }

  loadDevices()

  return { audioDevices, videoDevices, loadDevices }
}
