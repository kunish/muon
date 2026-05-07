# Feishu Anchor Reference Images

Reference screenshots from Feishu desktop. These images are the **visual contract for "Feishu-style"** — every atom调样 PR must include a side-by-side comparison with the matching anchor in Storybook's `Foundation/Anchors > Reference` story.

## Current anchors (5)

| File | Coverage |
| --- | --- |
| `01-messages.png` | IM 列表 + 会话视图（暗色） |
| `02-docs-home.png` | 云文档 Home / 文件列表表格视图（暗色） |
| `03-calendar-week.png` | 日历周视图 + 日程详情 popover（暗色） |
| `04-approval-form.png` | 审批表单详情（暗色） |
| `05-settings.png` | 设置页 — 账号与外观（暗色） |

All current anchors were captured in **dark mode**. Light-mode anchors can be added later with the same `<NN>-<area>-light.png` naming convention.

## Adding new anchors

1. Drop a PNG/JPG into this folder with the next sequential prefix (e.g., `06-bitable.png`).
2. Add an entry to `ANCHORS` in `packages/ui/src/stories/Foundation/Anchors.stories.ts`.
3. Run `pnpm --filter @muon/ui storybook` and verify it renders at `Foundation/Anchors > Reference`.

Spec reference: [`docs/superpowers/specs/2026-05-07-feishu-design-system-foundation-design.md`](../../../../docs/superpowers/specs/2026-05-07-feishu-design-system-foundation-design.md) §5.2.
