---
phase: 01
slug: unified-inbox-triage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + Vue Test Utils |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts`
- **After every plan wave:** Run `pnpm test:unit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INBX-01 | unit | `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts -t "aggregates unified inbox items"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | INBX-02 | unit | `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts -t "filters and batch processes"` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | INBX-03 | integration | `pnpm test:unit -- tests/components/UnifiedInboxPanel.test.ts -t "jump to source with context"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/stores/inboxStore.test.ts` — stubs for INBX-01, INBX-02
- [ ] `tests/components/UnifiedInboxPanel.test.ts` — integration test scaffold for INBX-03
- [ ] `tests/mocks/matrix.ts` — context/eventTimeline mock extensions

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 跳转后上下文渲染体验（滚动定位、前后文连续性） | INBX-03 | 真实时间线与列表交互体验难用单测完全覆盖 | 启动 `pnpm dev`，在收件箱点击目标项，确认落位到源消息并显示前后文 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
