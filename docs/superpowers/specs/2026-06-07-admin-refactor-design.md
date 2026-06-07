# Admin 重构（拆分 AdminApp.vue）— 设计（sub-project B）

- **日期**：2026-06-07
- **状态**：设计待 review
- **所属**：Vite+ 全家桶迁移的 sub-project B（探查后修正：核心是「拆分巨型单文件」，非「补 tanstack 全家桶」）

## 背景与动机

admin 现状：5 文件 / 1845 行，其中 **`AdminApp.vue` 1522 行巨型单文件**——4 个管理页（组织/用户/部门/审计）+ install/login/改密 gate + **37 个状态**全塞一个 SFC。`router.ts` 用「假路由」：所有 route 的 `component` 指向 `AdminRoutePlaceholder`（render null），靠 `watch(route)` 在 AdminApp.vue 内手动切 section。数据层用 **Effect**（`api.ts`，和 desktop 一致），UI 用 **`@muon/ui`**（基于 reka-ui）。

**真痛点 = 巨型文件 + 假路由的可维护性**，不是「缺 tanstack」。

## 目标 / 非目标

**目标**：AdminApp.vue 拆成真路由 + 页面组件 + 共享 store + vue-query 数据层。

**非目标（YAGNI）**：不加 reka-ui（已用 @muon/ui）；不加 i18n（内部中文后台）；不重写 Effect 数据层（`api.ts` 保留，vue-query 只包装）；不改 api 后端。

## 架构

- **真路由**：`router.ts` 的 `component` → 页面组件（替换 placeholder）；保留 `normalizeLegacyAdminHash` 旧 hash 兼容。
- **页面组件**：每 section 一个 SFC，自带 section-specific 状态。
- **共享 store**：`sessionStore`（vue-store）持 `installed/adminToken/mustChangePassword/loggedIn`。
- **数据层**：`queries/`（vue-query `useQuery`/`useMutation` 包装 `api.ts` 的 Effect），管列表缓存 + invalidate；`isAuthenticationError → logout` 的错误处理在 query `onError` 保留。
- **布局**：`AppShell.vue`（侧栏导航 + `<RouterView>`）；gate（install/login/改密）为独立路由 + 守卫。

## 文件结构（目标）

```
apps/admin/src/
  main.ts                # 装 VueQueryPlugin / QueryClient
  router.ts              # component → 真页面 + 守卫（未装→install，未登录→login，须改密→change-password）
  layouts/AppShell.vue   # 侧栏导航 + <RouterView>
  pages/
    OrganizationsPage.vue  UsersPage.vue  DepartmentsPage.vue  AuditPage.vue
    InstallPage.vue  LoginPage.vue  ChangePasswordPage.vue
  stores/sessionStore.ts # vue-store
  queries/               # useOrganizations/useUsers/useDepartments/useAuditLogs + mutations
  api.ts  effect.ts      # 保留（Effect 数据层）
```

## 状态归属（从 AdminApp.vue grep 映射）

| 去处 | 状态 |
|---|---|
| **sessionStore** | installed, adminToken, mustChangePassword, loggedIn(computed) |
| **InstallPage** | form, canSubmitInstall, submitting |
| **LoginPage** | loginForm, loginSubmitting, loginError, canLogin |
| **ChangePasswordPage** | changePasswordForm, changePasswordSubmitting, changePasswordError |
| **OrganizationsPage** | organizations→`useOrganizations`, organizationForm, organizationSubmitting/Error, organizationSearch, filteredOrganizations, canCreateOrganization |
| **UsersPage（最大）** | users→`useUsers`, userForm, userSearch, userStatusFilter, filtered/active/disabledUsers, userDrafts, passwordDrafts, passwordPolicies, updatingUsers, resettingPasswords, expandedSessions, userSessions, sessionLoading, revokingSession |
| **DepartmentsPage** | departments→`useDepartments`, departmentForm, departmentSubmitting/Error, departmentsLoading |
| **AuditPage** | auditLogs→`useAuditLogs`, auditSearch, filteredAuditLogs |

## 引入依赖

`@tanstack/vue-query`、`@tanstack/vue-store`、`vitest`、`@vue/test-utils`、`jsdom`（均在 catalog）。admin 当前**无 tsconfig**，需新增一个（参考 desktop renderer，去掉 electron 相关）。

## 分阶段实施

- **P1 基础设施**：加依赖 + tsconfig + `main.ts` 装 QueryClient + `sessionStore` + `AppShell` + 真路由骨架（页面先占位）。验证：admin dev 起、导航切换、登录流程仍工作。
- **P2 逐 section 拆**：Organizations → Departments → Audit → **Users（最后，最大）**。每个：section template + 状态 → 页面组件 + query；配 vitest；独立 commit。
- **P3 gate 拆分**：install/login/改密 → 页面 + 路由守卫；清空/删除 AdminApp.vue（main 直接挂 AppShell）。

## 验证

- 每阶段：`vite build` 通过 + dev 手动冒烟（登录→各 section CRUD→改密→登出）。
- vitest：每页组件 + sessionStore + query 测试。
- 真路由：hash 导航 + `normalizeLegacyAdminHash` 旧 hash 兼容。
- 功能不回归：组织/用户/部门/审计 CRUD + 用户 session 管理 + 改密 + 安装。

## 风险

- **UsersPage 最大**（20 状态 + 嵌套 session 管理）→ 放 P2 最后，单独细拆。
- **假路由→真路由**：保留 `normalizeLegacyAdminHash` 旧 hash 兼容。
- **Effect→vue-query 包装**：`queryFn = () => runAdminEffect(effect)`；`onError` 保留 `isAuthenticationError → logout`、`isMustChangePasswordError` 处理。
- **api.ts 单一数据源**：vue-query 只包装，不复制请求逻辑。

## 收益

1522 行 → ~10 个聚焦文件（每个 <300 行）；真路由；列表缓存/invalidate；测试覆盖（现 0）；可维护性大幅提升。
