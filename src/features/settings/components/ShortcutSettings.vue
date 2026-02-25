<script setup lang="ts">
const shortcuts = [
  { keys: 'Ctrl/Cmd + K', desc: '全局搜索' },
  { keys: 'Ctrl/Cmd + ,', desc: '打开设置' },
  { keys: 'Ctrl/Cmd + N', desc: '新建会话' },
  { keys: 'Escape', desc: '关闭弹窗 / 返回' },
  { keys: 'Enter', desc: '发送消息' },
  { keys: 'Shift + Enter', desc: '换行' },
]
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-base font-medium">
      快捷键
    </h3>

    <div class="space-y-1">
      <div
        v-for="s in shortcuts"
        :key="s.keys"
        class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50"
      >
        <span class="text-sm">{{ s.desc }}</span>
        <kbd class="text-xs bg-muted px-2 py-1 rounded font-mono">{{ s.keys }}</kbd>
      </div>
    </div>
  </div>
</template>
