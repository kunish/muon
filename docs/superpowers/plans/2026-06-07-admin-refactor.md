# Admin 重构实施计划（sub-project B）

> **For agentic workers:** REQUIRED SUB-SKILL: 新 session 用 superpowers:executing-plans（P1→P2→P3 分阶段），或 subagent-driven-development。步骤用 checkbox 跟踪。

**Goal:** 把 `apps/admin/src/AdminApp.vue`（1522 行）拆成真路由 + 页面组件 + `sessionStore`（vue-store）+ vue-query 数据层，保留 Effect 数据源与全部现有功能。

**Architecture:** 真路由（component 指页面）+ 每 section 一个页面组件（自带状态）+ 共享 `sessionStore` + `queries/`（vue-query 包装 `api.ts` 的 Effect）+ `AppShell` 布局。

**Tech Stack:** Vue 3 + vue-router 5 + @tanstack/vue-query + @tanstack/vue-store + vitest + @vue/test-utils + @muon/ui。

**关联 spec:** `docs/superpowers/specs/2026-06-07-admin-refactor-design.md`

---

## 执行须知

- 这是**重构现有代码**：每 task = 读 AdminApp.vue 对应区段 → 抽成组件/query/store → vitest → 手动冒烟 → commit。具体代码实施时从 AdminApp.vue 迁移（行号见 spec 的状态归属表）。
- 在隔离 worktree 实施（`superpowers:using-git-worktrees`，名 `b-admin-refactor`）。
- **硬约束**：现有功能零回归（组织/用户/部门/审计 CRUD + 用户 session + 改密 + 安装 + 旧 hash 兼容）。
- 每阶段结束跑 `vite build` + dev 冒烟。

---

## P1 — 基础设施

### Task 1: 依赖 + tsconfig

- [ ] **Step 1:** `apps/admin/package.json` 的 dependencies 加 `@tanstack/vue-query: catalog:`、`@tanstack/vue-store: catalog:`；devDependencies 加 `vitest`/`@vue/test-utils`/`jsdom`/`vue-tsc`（均 `catalog:`）；scripts 加 `"test:unit": "vitest run"`、`"type-check": "vue-tsc --noEmit"`。
- [ ] **Step 2:** 新建 `apps/admin/tsconfig.json`（参考 desktop renderer，去 electron）：
```json
{
  "compilerOptions": {
    "target": "ES2022", "jsx": "preserve", "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext", "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] },
    "resolveJsonModule": true, "strict": true, "noEmit": true,
    "esModuleInterop": true, "isolatedModules": true, "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```
- [ ] **Step 3:** 新建 `apps/admin/vitest.config.ts`（environment jsdom，plugins vue()）。参考 desktop 的 vitest.config.ts。
- [ ] **Step 4:** `pnpm install`；`pnpm --filter @muon/admin build` 通过。Commit。

### Task 2: QueryClient

- [ ] **Step 1:** `apps/admin/src/main.ts` 装 `VueQueryPlugin` + `QueryClient`（defaultOptions: queries `{ retry: false, staleTime: 30_000 }`）。
- [ ] **Step 2:** `vite build` 通过。Commit。

### Task 3: sessionStore（vue-store）

- [ ] **Step 1:** 新建 `apps/admin/src/stores/sessionStore.ts`：用 `@tanstack/vue-store` 的 `Store` 持 `{ installed, adminToken, mustChangePassword }`，导出 `loggedIn` 派生 + `setToken/clearToken/persistAdminToken/readStoredAdminToken`（从 AdminApp.vue L56/204/209 迁移 token 持久化逻辑）。
- [ ] **Step 2:** 新建 `tests/sessionStore.test.ts`：测 setToken→loggedIn=true、clearToken→false、persist 读写 localStorage。
- [ ] **Step 3:** `vitest run` 通过。Commit。

### Task 4: AppShell + 真路由骨架

- [ ] **Step 1:** 新建 `apps/admin/src/layouts/AppShell.vue`：侧栏导航（从 AdminApp.vue L647 的 `v-for adminSections` 迁移）+ `<RouterView>`。
- [ ] **Step 2:** 新建 4 个占位页面 `pages/{Organizations,Users,Departments,Audit}Page.vue`（先放标题 + TODO）。
- [ ] **Step 3:** 改 `router.ts`：`adminSections.map` 的 `component` 从 `AdminRoutePlaceholder` → 对应页面组件（动态 import）；保留 `normalizeLegacyAdminHash`。
- [ ] **Step 4:** `main.ts` 挂 `AppShell` 替代 AdminApp.vue 的 dashboard 外壳（gate 暂仍走 AdminApp.vue，P3 再拆）。
- [ ] **Step 5:** dev 冒烟：登录后侧栏导航切换 4 个占位页正常、旧 hash 兼容。Commit。

---

## P2 — 逐 section 拆分（每个独立 commit + vitest）

> 模式（每 section 相同）：① 在 `queries/` 建 `use<Section>()`（`useQuery`，`queryFn = () => runAdminEffect(list<Section>Effect)`）+ 相关 `useMutation`（create/update/delete，`onSuccess` invalidate query，`onError` 处理 auth）；② 页面组件迁移该 section 的 template（AdminApp.vue 对应区段）+ section-specific 状态（见 spec 表）；③ vitest 测页面渲染 + 一个 mutation 流程（mock query）；④ dev 冒烟该 section CRUD；⑤ commit。

### Task 5: queries 基础 + OrganizationsPage（完整范例）

- [ ] **Step 1:** 新建 `queries/useOrganizations.ts`：
```ts
// useQuery key ['organizations']，queryFn 包 api.ts 的 listOrganizations Effect
// useCreateOrganization：useMutation，onSuccess → queryClient.invalidateQueries({ queryKey: ['organizations'] })
```
- [ ] **Step 2:** `pages/OrganizationsPage.vue`：迁移 AdminApp.vue 组织 section 的 template + `organizationForm/Search/Submitting/Error`、`filteredOrganizations`、`canCreateOrganization`；列表数据来自 `useOrganizations()`。
- [ ] **Step 3:** `tests/OrganizationsPage.test.ts`：mock useOrganizations 返回 2 条 → 断言渲染；触发 create → 断言 mutation 调用。
- [ ] **Step 4:** `vitest run` + dev 冒烟组织 CRUD。Commit `refactor(admin): extract OrganizationsPage`.

### Task 6: DepartmentsPage

- [ ] 同模式。query `useDepartments`（+ create/reparent/remove mutations，迁移 AdminApp.vue L279-336）。状态：departmentForm/Submitting/Error/departmentsLoading。测试 + 冒烟 + commit。

### Task 7: AuditPage

- [ ] 同模式。query `useAuditLogs`（只读，无 mutation）。状态：auditSearch、filteredAuditLogs。测试 + 冒烟 + commit。

### Task 8: UsersPage（最大，最后做）

- [ ] **Step 1:** query `useUsers` + mutations：createUser/updateUser/toggleStatus/resetPassword（AdminApp.vue L461-543）。
- [ ] **Step 2:** 用户 session 子功能（toggleUserSessions/revokeSession，L544-572）：抽成 `composables/useUserSessions.ts` 或页面内局部状态（userSessions/sessionLoading/revokingSession/expandedSessions）。
- [ ] **Step 3:** `UsersPage.vue` 迁移用户 section template + 全部用户状态（userForm/Search/StatusFilter/Drafts/passwordDrafts/policies/updating/resetting）。
- [ ] **Step 4:** `tests/UsersPage.test.ts`：渲染 + updateUser + resetPassword + session 展开。
- [ ] **Step 5:** vitest + 冒烟（用户 CRUD + 改状态 + 重置密码 + session 管理）。Commit。

---

## P3 — gate 拆分 + 清理

### Task 9: install/login/改密 → 页面 + 守卫

- [ ] **Step 1:** `pages/InstallPage.vue`（迁移 install 区段 + form/canSubmitInstall/submitInstall，L412-432）。
- [ ] **Step 2:** `pages/LoginPage.vue`（loginForm/canLogin/submitLogin，L397-411 + completeAdminLogin）。
- [ ] **Step 3:** `pages/ChangePasswordPage.vue`（changePasswordForm/submitForceChangePassword，L361-384）。
- [ ] **Step 4:** `router.ts` 加路由 `install`/`login`/`change-password` + `beforeEach` 守卫：`!installed→install`、`!loggedIn→login`、`mustChangePassword→change-password`（用 sessionStore）。
- [ ] **Step 5:** vitest（守卫重定向）+ 冒烟（全新安装→登录→强制改密流程）。Commit。

### Task 10: 清空 AdminApp.vue + 终验

- [ ] **Step 1:** 把残留逻辑（bootstrap/refreshDashboard）迁到 AppShell 或 main.ts；删除 `AdminApp.vue`（main 直接挂 AppShell + RouterView）。
- [ ] **Step 2:** 全量验证：`vue-tsc --noEmit`、`vitest run`、`vite build`、dev 完整冒烟（安装→登录→4 section CRUD→用户 session→改密→登出→旧 hash）。
- [ ] **Step 3:** 确认无 1522 行文件残留；各文件 <300 行。Commit。
- [ ] **Step 4:** `superpowers:finishing-a-development-branch` 决定合并。

---

## Self-Review

- **Spec coverage**：P1 基础设施（依赖/tsconfig/QueryClient/store/AppShell/真路由）→ Task 1-4；P2 四 section → Task 5-8（Users 最后）；P3 gate + 清理 → Task 9-10；vitest 每页 → 各 task Step；旧 hash 兼容 → Task 4 Step 3 + Task 10。全覆盖。
- **重构性质**：代码从 AdminApp.vue 迁移，行号见 spec 状态表；P2 的 4 section 同模式（Task 5 给完整范例，6-8 列差异点），符合「读源码展开」的重构现实。
- **风险**：UsersPage 放最后（Task 8）；Effect→vue-query 用 `runAdminEffect` 包装、onError 保留 auth 处理；api.ts 单一数据源不复制。
