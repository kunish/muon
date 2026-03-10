<script setup lang="ts">
import type { SpaceMember } from '@/matrix/spaces'
import { Search, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useServerStore } from '@/features/server/stores/serverStore'
import { matrixEvents } from '@/matrix/events'
import { getUserPresenceInfo } from '@/matrix/profile'
import { getSpaceMembers } from '@/matrix/spaces'
import MemberItem from './MemberItem.vue'

const _props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  openPopover: [member: SpaceMember, event: MouseEvent]
  openContextMenu: [member: SpaceMember, event: MouseEvent]
}>()

const serverStore = useServerStore()
const searchQuery = ref('')

// ── 成员数据 ──

const rawMembers = ref<SpaceMember[]>([])

function refreshMembers() {
  const serverId = serverStore.currentServerId
  if (!serverId) {
    rawMembers.value = []
    return
  }
  rawMembers.value = getSpaceMembers(serverId)
}

watch(() => serverStore.currentServerId, refreshMembers, { immediate: true })

// 监听成员变更事件
onMounted(() => {
  matrixEvents.on('space.member', refreshMembers)
  matrixEvents.on('room.member', refreshMembers)
})

onUnmounted(() => {
  matrixEvents.off('space.member', refreshMembers)
  matrixEvents.off('room.member', refreshMembers)
})

// ── 搜索过滤 ──

const filteredMembers = computed(() => {
  if (!searchQuery.value.trim())
    return rawMembers.value
  const q = searchQuery.value.toLowerCase()
  return rawMembers.value.filter(m =>
    m.displayName.toLowerCase().includes(q) || m.userId.toLowerCase().includes(q),
  )
})

// ── 角色分组定义 ──

interface RoleGroup {
  key: string
  label: string
  color: string
  minPower: number
  maxPower: number
}

const roleGroups: RoleGroup[] = [
  { key: 'owner', label: 'OWNER', color: '#c08b2e', minPower: 100, maxPower: Infinity },
  { key: 'admin', label: 'ADMIN', color: '#b85c4a', minPower: 75, maxPower: 99 },
  { key: 'moderator', label: 'MODERATOR', color: '#4a9882', minPower: 50, maxPower: 74 },
  { key: 'member', label: 'MEMBER', color: 'var(--color-foreground)', minPower: 0, maxPower: 49 },
]

// ── 按角色分组 + 在线排前 ──

interface GroupedSection {
  key: string
  label: string
  color: string
  count: number
  onlineMembers: SpaceMember[]
  offlineMembers: SpaceMember[]
}

const groupedSections = computed<GroupedSection[]>(() => {
  const sections: GroupedSection[] = []

  for (const group of roleGroups) {
    const members = filteredMembers.value.filter(
      m => m.powerLevel >= group.minPower && m.powerLevel <= group.maxPower,
    )
    if (members.length === 0)
      continue

    const online: SpaceMember[] = []
    const offline: SpaceMember[] = []

    for (const m of members) {
      const p = getUserPresenceInfo(m.userId).presence
      if (p === 'online' || p === 'unavailable' || p === 'busy') {
        online.push(m)
      }
      else {
        offline.push(m)
      }
    }

    // 按名称排序
    const sorter = (a: SpaceMember, b: SpaceMember) =>
      a.displayName.localeCompare(b.displayName)
    online.sort(sorter)
    offline.sort(sorter)

    sections.push({
      key: group.key,
      label: group.label,
      color: group.color,
      count: members.length,
      onlineMembers: online,
      offlineMembers: offline,
    })
  }

  return sections
})

const _totalOnline = computed(() =>
  groupedSections.value.reduce((sum, s) => sum + s.onlineMembers.length, 0),
)
</script>

<template>
  <Transition name="member-panel">
    <aside
      v-if="visible"
      class="w-60 h-full flex flex-col border-l border-border bg-sidebar shrink-0 overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Members — {{ rawMembers.length }}
        </span>
        <button
          class="p-1 rounded-md hover:bg-accent text-muted-foreground transition-colors"
          @click="emit('close')"
        >
          <X :size="14" />
        </button>
      </div>

      <!-- Search -->
      <div class="px-2.5 py-2 shrink-0">
        <div class="relative">
          <Search
            class="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40"
            :size="12"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search"
            class="w-full h-7 pl-7 pr-2 text-xs rounded-md bg-background border border-transparent outline-none placeholder:text-muted-foreground/35 transition-all duration-150 focus:border-ring/30"
          >
        </div>
      </div>

      <!-- Member list -->
      <div class="flex-1 overflow-y-auto px-1.5 pb-2 scrollbar-thin">
        <template v-for="section in groupedSections" :key="section.key">
          <!-- Role header -->
          <div class="px-2 pt-4 pb-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              {{ section.label }} — {{ section.count }}
            </span>
          </div>

          <!-- Online members -->
          <MemberItem
            v-for="member in section.onlineMembers"
            :key="member.userId"
            :member="member"
            :role-color="section.color"
            @click="emit('openPopover', member, $event)"
            @contextmenu="emit('openContextMenu', member, $event)"
          />

          <!-- Offline members -->
          <MemberItem
            v-for="member in section.offlineMembers"
            :key="member.userId"
            :member="member"
            :role-color="section.color"
            @click="emit('openPopover', member, $event)"
            @contextmenu="emit('openContextMenu', member, $event)"
          />
        </template>

        <!-- Empty state -->
        <div
          v-if="filteredMembers.length === 0"
          class="flex flex-col items-center justify-center py-8 text-muted-foreground/40"
        >
          <span class="text-xs">{{ searchQuery ? 'No matching members' : 'No members' }}</span>
        </div>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.member-panel-enter-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.member-panel-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 1, 1);
}
.member-panel-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.member-panel-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* 自定义窄滚动条 */
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--color-muted-foreground);
  opacity: 0.2;
  border-radius: 4px;
}
</style>
