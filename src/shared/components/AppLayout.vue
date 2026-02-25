<script setup lang="ts">
import Sidebar from './Sidebar.vue'
</script>

<template>
  <div class="flex h-screen bg-background text-foreground">
    <Sidebar />
    <RouterView />
  </div>
</template>
