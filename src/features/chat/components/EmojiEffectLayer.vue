<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let dpr = 1
let canvasW = 0
let canvasH = 0

// ---- Particle（纯数据，不再持有 DOM 引用） ----
interface Particle {
  emoji: string
  x: number
  y: number
  vx: number
  vy: number
  scale: number
  opacity: number
  rotation: number
  vr: number
  life: number
  maxLife: number
  gravity: number
  drag: number
  fadeStart: number
  wobble: number
  wobbleSpeed: number
  wobblePhase: number
  trajectory: 'burst' | 'float-up' | 'rain-down' | 'spiral' | 'drift'
  spiralAngle: number
  spiralSpeed: number
  age: number
  fontSize: number // px
}

// ---- Emoji 专属特效预设 ----
interface EffectPreset {
  variants: string[]
  count: [number, number]
  waves: number
  waveDelay: number
  trajectories: Particle['trajectory'][]
  gravity: [number, number]
  speed: [number, number]
  sizeRange: [number, number] // rem
  lifeRange: [number, number]
  screenShake: boolean
}

const PRESETS: Record<string, EffectPreset> = {
  '❤️': {
    variants: ['❤️', '💕', '💗', '💖', '💘', '💝'],
    count: [35, 50],
    waves: 3,
    waveDelay: 200,
    trajectories: ['float-up', 'drift'],
    gravity: [-0.06, -0.02],
    speed: [2, 6],
    sizeRange: [0.8, 2.8],
    lifeRange: [1.2, 2.0],
    screenShake: false,
  },
  '🥰': {
    variants: ['❤️', '💕', '💗', '🥰', '💖', '😍'],
    count: [35, 50],
    waves: 3,
    waveDelay: 200,
    trajectories: ['float-up', 'drift'],
    gravity: [-0.06, -0.02],
    speed: [2, 6],
    sizeRange: [0.8, 2.8],
    lifeRange: [1.2, 2.0],
    screenShake: false,
  },
  '🎉': {
    variants: ['🎉', '🎊', '✨', '🌟', '⭐', '🎈', '🎀'],
    count: [40, 60],
    waves: 3,
    waveDelay: 150,
    trajectories: ['rain-down', 'drift', 'spiral'],
    gravity: [0.08, 0.15],
    speed: [3, 8],
    sizeRange: [0.6, 2.4],
    lifeRange: [1.5, 2.5],
    screenShake: true,
  },
  '🎊': {
    variants: ['🎉', '🎊', '✨', '🌟', '⭐', '🎈'],
    count: [40, 60],
    waves: 3,
    waveDelay: 150,
    trajectories: ['rain-down', 'drift', 'spiral'],
    gravity: [0.08, 0.15],
    speed: [3, 8],
    sizeRange: [0.6, 2.4],
    lifeRange: [1.5, 2.5],
    screenShake: true,
  },
  '🔥': {
    variants: ['🔥', '🔥', '🔥', '💥', '✨', '🌟'],
    count: [35, 50],
    waves: 3,
    waveDelay: 180,
    trajectories: ['float-up', 'spiral'],
    gravity: [-0.1, -0.04],
    speed: [3, 7],
    sizeRange: [0.7, 2.6],
    lifeRange: [0.8, 1.5],
    screenShake: true,
  },
  '👍': {
    variants: ['👍', '👍', '👍', '⭐', '✨', '💪'],
    count: [25, 40],
    waves: 2,
    waveDelay: 200,
    trajectories: ['burst', 'float-up'],
    gravity: [0.05, 0.12],
    speed: [4, 9],
    sizeRange: [0.8, 2.4],
    lifeRange: [1.0, 1.8],
    screenShake: true,
  },
  '💩': {
    variants: ['💩', '💩', '💩', '💩', '🪰', '😵'],
    count: [30, 45],
    waves: 3,
    waveDelay: 250,
    trajectories: ['rain-down', 'drift'],
    gravity: [0.12, 0.2],
    speed: [2, 5],
    sizeRange: [0.8, 2.6],
    lifeRange: [1.5, 2.5],
    screenShake: true,
  },
  '👻': {
    variants: ['👻', '👻', '👻', '💀', '🦇', '🕸️'],
    count: [25, 40],
    waves: 2,
    waveDelay: 300,
    trajectories: ['float-up', 'drift', 'spiral'],
    gravity: [-0.05, -0.01],
    speed: [1.5, 4],
    sizeRange: [0.8, 2.8],
    lifeRange: [1.5, 2.5],
    screenShake: false,
  },
  '😂': {
    variants: ['😂', '🤣', '😆', '😹', '✨'],
    count: [30, 45],
    waves: 2,
    waveDelay: 200,
    trajectories: ['burst', 'float-up', 'spiral'],
    gravity: [0.02, 0.08],
    speed: [4, 9],
    sizeRange: [0.7, 2.4],
    lifeRange: [1.0, 1.8],
    screenShake: true,
  },
  '🥳': {
    variants: ['🥳', '🎉', '🎊', '🎈', '🎀', '✨', '🌟'],
    count: [40, 55],
    waves: 3,
    waveDelay: 180,
    trajectories: ['rain-down', 'burst', 'spiral'],
    gravity: [0.06, 0.12],
    speed: [3, 8],
    sizeRange: [0.6, 2.4],
    lifeRange: [1.5, 2.5],
    screenShake: true,
  },
  '😭': {
    variants: ['😭', '😢', '💧', '💧', '💦', '🥲'],
    count: [30, 45],
    waves: 3,
    waveDelay: 250,
    trajectories: ['rain-down', 'drift'],
    gravity: [0.1, 0.18],
    speed: [1.5, 4],
    sizeRange: [0.6, 2.2],
    lifeRange: [1.5, 2.5],
    screenShake: false,
  },
  '💀': {
    variants: ['💀', '☠️', '👻', '🦴', '⚰️'],
    count: [25, 40],
    waves: 2,
    waveDelay: 300,
    trajectories: ['rain-down', 'spiral', 'drift'],
    gravity: [0.08, 0.14],
    speed: [2, 5],
    sizeRange: [0.8, 2.6],
    lifeRange: [1.5, 2.2],
    screenShake: true,
  },
  '🌈': {
    variants: ['🌈', '✨', '⭐', '🌟', '💫', '🦋'],
    count: [35, 50],
    waves: 3,
    waveDelay: 200,
    trajectories: ['float-up', 'spiral', 'drift'],
    gravity: [-0.04, 0.02],
    speed: [2, 6],
    sizeRange: [0.7, 2.4],
    lifeRange: [1.5, 2.5],
    screenShake: false,
  },
  '🚀': {
    variants: ['🚀', '🚀', '💨', '✨', '🌟', '⭐', '🔥'],
    count: [30, 45],
    waves: 2,
    waveDelay: 150,
    trajectories: ['float-up', 'burst'],
    gravity: [-0.12, -0.06],
    speed: [5, 12],
    sizeRange: [0.6, 2.2],
    lifeRange: [0.8, 1.5],
    screenShake: true,
  },
}

const DEFAULT_PRESET: EffectPreset = {
  variants: [],
  count: [28, 42],
  waves: 2,
  waveDelay: 200,
  trajectories: ['burst', 'float-up', 'drift'],
  gravity: [0.05, 0.12],
  speed: [4, 9],
  sizeRange: [0.6, 2.4],
  lifeRange: [1.0, 1.8],
  screenShake: false,
}

// ---- 工具函数 ----
function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getPreset(emoji: string): EffectPreset {
  if (PRESETS[emoji])
    return PRESETS[emoji]
  return { ...DEFAULT_PRESET, variants: [emoji] }
}

// ---- 纹理缓存：emoji+size → offscreen canvas ----
const textureCache = new Map<string, HTMLCanvasElement>()

function getTexture(emoji: string, sizePx: number): HTMLCanvasElement {
  // 量化尺寸到 4px 步长，减少缓存条目
  const quantized = Math.round(sizePx / 4) * 4
  const key = `${emoji}_${quantized}_${dpr}`
  let tex = textureCache.get(key)
  if (tex)
    return tex

  const texSize = Math.ceil(quantized * dpr * 1.4) // 留余量给 emoji 渲染
  tex = document.createElement('canvas')
  tex.width = texSize
  tex.height = texSize
  const tctx = tex.getContext('2d')!
  tctx.textAlign = 'center'
  tctx.textBaseline = 'middle'
  tctx.font = `${quantized * dpr}px serif`
  tctx.fillText(emoji, texSize / 2, texSize / 2)

  textureCache.set(key, tex)
  return tex
}

// ---- 粒子状态 ----
let particles: Particle[] = []
let rafId = 0
let lastTick = 0
let lastTrigger = 0
let burst = 0
const MAX_PARTICLES = 150 // canvas 可以承受更多粒子
const waveTimers: ReturnType<typeof setTimeout>[] = []

// ---- rem → px ----
function remToPx(rem: number): number {
  return rem * 16
}

// ---- Canvas 尺寸同步 ----
function syncCanvasSize() {
  const canvas = canvasRef.value
  if (!canvas)
    return
  const parent = canvas.parentElement
  if (!parent)
    return
  dpr = window.devicePixelRatio || 1
  const rect = parent.getBoundingClientRect()
  canvasW = rect.width
  canvasH = rect.height
  canvas.width = Math.round(canvasW * dpr)
  canvas.height = Math.round(canvasH * dpr)
  canvas.style.width = `${canvasW}px`
  canvas.style.height = `${canvasH}px`
}

let resizeObserver: ResizeObserver | null = null

// ---- 生成单波粒子 ----
function spawnWave(
  preset: EffectPreset,
  sx: number,
  sy: number,
  count: number,
) {
  if (particles.length > MAX_PARTICLES)
    return
  for (let i = 0; i < count; i++) {
    if (particles.length > MAX_PARTICLES)
      break

    const variant = pick(preset.variants)
    const fontSize = remToPx(rand(preset.sizeRange[0], preset.sizeRange[1]))
    const trajectory = pick(preset.trajectories)
    const speed = rand(preset.speed[0], preset.speed[1])
    const life = rand(preset.lifeRange[0], preset.lifeRange[1])
    const gravity = rand(preset.gravity[0], preset.gravity[1])

    let x = sx
    let y = sy
    let vx = 0
    let vy = 0

    switch (trajectory) {
      case 'burst': {
        const angle = (Math.PI * 2 * i) / count + rand(-0.5, 0.5)
        vx = Math.cos(angle) * speed
        vy = Math.sin(angle) * speed - rand(2, 5)
        break
      }
      case 'float-up': {
        x = rand(canvasW * 0.1, canvasW * 0.9)
        y = canvasH + rand(10, 60)
        vx = rand(-1.5, 1.5)
        vy = -rand(speed * 0.6, speed)
        break
      }
      case 'rain-down': {
        x = rand(canvasW * 0.05, canvasW * 0.95)
        y = -rand(20, 80)
        vx = rand(-2, 2)
        vy = rand(1, speed * 0.5)
        break
      }
      case 'spiral': {
        const angle = (Math.PI * 2 * i) / count
        vx = Math.cos(angle) * speed * 0.7
        vy = Math.sin(angle) * speed * 0.7 - rand(1, 3)
        break
      }
      case 'drift': {
        x = rand(canvasW * 0.15, canvasW * 0.85)
        y = rand(canvasH * 0.3, canvasH * 0.8)
        vx = rand(-2, 2)
        vy = -rand(1, 3)
        break
      }
    }

    const wobble = trajectory === 'float-up' || trajectory === 'drift' ? rand(0.5, 2.5) : 0
    const wobbleSpeed = wobble > 0 ? rand(0.05, 0.12) : 0
    const wobblePhase = wobble > 0 ? rand(0, Math.PI * 2) : 0
    const spiralAngle = trajectory === 'spiral' ? rand(0, Math.PI * 2) : 0
    const spiralSpeed = trajectory === 'spiral' ? rand(0.05, 0.1) : 0

    particles.push({
      emoji: variant,
      x,
      y,
      vx,
      vy,
      scale: rand(0.6, 1.2),
      opacity: trajectory === 'rain-down' ? 0.8 : 1,
      rotation: rand(0, 360),
      vr: rand(-15, 15),
      life,
      maxLife: life,
      gravity,
      drag: rand(0.975, 0.995),
      fadeStart: life * 0.35,
      wobble,
      wobbleSpeed,
      wobblePhase,
      trajectory,
      spiralAngle,
      spiralSpeed,
      age: 0,
      fontSize,
    })
  }
}

// ---- 动画循环 ----
function tick(time = 0) {
  if (!ctx) {
    rafId = 0
    return
  }

  const delta = time - lastTick
  if (delta < 16) {
    rafId = requestAnimationFrame(tick)
    return
  }
  lastTick = time

  // 清空画布
  const canvas = canvasRef.value!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const alive: Particle[] = []

  for (const p of particles) {
    p.age++

    // 横向摆动
    if (p.wobble > 0) {
      p.x += Math.sin(p.age * p.wobbleSpeed + p.wobblePhase) * p.wobble
    }

    p.x += p.vx
    p.y += p.vy
    p.vy += p.gravity
    p.vx *= p.drag
    p.vy *= p.drag

    // 螺旋轨迹
    if (p.trajectory === 'spiral' && p.spiralSpeed) {
      p.spiralAngle += p.spiralSpeed
      const spiralForce = 0.12
      p.vx += Math.cos(p.spiralAngle) * spiralForce
      p.vy += Math.sin(p.spiralAngle) * spiralForce * 0.5
    }

    p.life -= 0.016

    // 淡出
    if (p.life < p.fadeStart) {
      p.opacity = Math.max(0, p.life / p.fadeStart)
    }

    p.scale *= 0.998
    p.rotation += p.vr
    p.vr *= 0.985

    if (p.life > 0.01) {
      // 绘制粒子
      const tex = getTexture(p.emoji, p.fontSize)
      const drawSize = p.fontSize * p.scale

      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(p.x * dpr, p.y * dpr)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.drawImage(
        tex,
        (-drawSize * dpr) / 2,
        (-drawSize * dpr) / 2,
        drawSize * dpr,
        drawSize * dpr,
      )
      ctx.restore()

      alive.push(p)
    }
  }

  particles = alive
  rafId = alive.length > 0 ? requestAnimationFrame(tick) : 0
}

// ---- 触发全屏特效 ----
function trigger(emoji: string, sourceRect: DOMRect) {
  const canvas = canvasRef.value
  if (!canvas || !ctx)
    return

  const now = performance.now()
  if (now - lastTrigger < 180)
    burst++
  else burst = 0
  lastTrigger = now

  const canvasRect = canvas.getBoundingClientRect()
  const sx = sourceRect.left + sourceRect.width / 2 - canvasRect.left
  const sy = sourceRect.top + sourceRect.height / 2 - canvasRect.top

  const preset = getPreset(emoji)
  let totalCount = Math.floor(rand(preset.count[0], preset.count[1]))
  if (burst >= 2)
    totalCount = Math.max(18, Math.floor(totalCount * 0.7))
  if (burst >= 4)
    totalCount = Math.max(14, Math.floor(totalCount * 0.55))
  const perWave = Math.ceil(totalCount / preset.waves)

  for (let w = 0; w < preset.waves; w++) {
    const count = w === preset.waves - 1
      ? totalCount - perWave * (preset.waves - 1)
      : perWave

    if (w === 0) {
      spawnWave(preset, sx, sy, count)
    }
    else {
      const timer = setTimeout(() => {
        spawnWave(preset, sx, sy, count)
        if (!rafId)
          rafId = requestAnimationFrame(tick)
      }, w * preset.waveDelay)
      waveTimers.push(timer)
    }
  }

  if (!rafId)
    rafId = requestAnimationFrame(tick)
}

// ---- 生命周期 ----
onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas)
    return
  ctx = canvas.getContext('2d')
  syncCanvasSize()

  resizeObserver = new ResizeObserver(() => {
    syncCanvasSize()
  })
  const parent = canvas.parentElement
  if (parent)
    resizeObserver.observe(parent)
})

onBeforeUnmount(() => {
  if (rafId)
    cancelAnimationFrame(rafId)
  for (const t of waveTimers) clearTimeout(t)
  waveTimers.length = 0
  particles = []
  textureCache.clear()
  resizeObserver?.disconnect()
  resizeObserver = null
  ctx = null
})

defineExpose({ trigger })
</script>

<template>
  <canvas
    ref="canvasRef"
    class="emoji-effect-layer absolute inset-0 pointer-events-none z-50"
  />
</template>

<style scoped>
.emoji-effect-layer {
  contain: strict;
}
</style>
