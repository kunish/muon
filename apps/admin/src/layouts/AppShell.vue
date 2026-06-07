<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { adminSections } from '@/router';

const route = useRoute();

const activeAdminSection = computed(() => route.meta?.adminSection);
</script>

<template>
  <main class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand">Muon Admin</div>
      <nav class="nav-list" aria-label="管理导航">
        <RouterLink
          v-for="section in adminSections"
          :key="section.id"
          :to="{ name: section.routeName }"
          :class="{ active: activeAdminSection === section.id }"
          :aria-current="activeAdminSection === section.id ? 'page' : undefined"
          :data-section="section.id"
        >
          {{ section.label }}
        </RouterLink>
      </nav>
    </aside>

    <RouterView />
  </main>
</template>

<style scoped>
.admin-shell {
  height: 100vh;
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  overflow: hidden;
  background: #f6f7f9;
  color: #1f2328;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.admin-sidebar {
  min-height: 0;
  overflow-y: auto;
  background: #fff;
  border-right: 1px solid #e4e7ec;
  padding: 24px 18px;
}

.brand {
  font-weight: 700;
  font-size: 18px;
}

.nav-list {
  margin-top: 24px;
  display: grid;
  gap: 8px;
}

.nav-list a {
  color: #3d4656;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  padding: 8px 10px;
  border-radius: 6px;
  text-align: left;
  text-decoration: none;
}

.nav-list a:hover,
.nav-list a.active {
  background: #f0f3f8;
  color: #1f2328;
}

.nav-list a.active {
  font-weight: 700;
}
</style>
