<script setup lang="ts"></script>

<template>
  <section class="admin-content" data-testid="audit-page">
    <div class="page-heading">
      <p>组织后台</p>
      <h1>审计日志</h1>
    </div>
    <div class="empty-state">施工中，敬请期待</div>
  </section>
</template>

<style scoped>
.admin-content {
  min-height: 0;
  overflow-y: auto;
  padding: 40px;
}

.page-heading p {
  margin: 0 0 6px;
  color: #667085;
  font-size: 13px;
}

.page-heading h1 {
  margin: 0 0 24px;
  font-size: 28px;
}

.empty-state {
  padding: 16px;
  border: 1px dashed #d0d5dd;
  border-radius: 8px;
  color: #667085;
  text-align: center;
}
</style>
