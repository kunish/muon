# Feishu Pixel-Level UI Alignment — Design Spec

**Date:** 2026-05-22
**Source:** Reverse-engineered from Feishu macOS desktop client v131.0.6778.268

## Overview

Align Muon's visual design layer to Feishu's pixel-exact specification. Extracted from Feishu's compiled CSS (534 CSS custom properties across 14 color scales, 253 semantic tokens, 6 shadow tiers, 5 border radii, 4 font sizes). Applies to both light and dark mode simultaneously.

## Architecture Decision: Full Token Replication

**Adopt Feishu's 3-layer token system:**

1. **Raw colors** — `--<name>-raw: r,g,b` for `rgba()` opacity variants
2. **Color scales** — `--<code><level>: #hex` (14 scales × 10 levels)
3. **Semantic tokens** — `--<role>: var(--<scale><level>)` for component usage

Muon's existing naming convention (`--color-*`, `--brand-*`, `--gray-*`) is preserved as a mapping layer on top of Feishu raw values. New tokens (fill-*, line-*, icon-*, shadow-default-*, etc.) are added with full Feishu names.

---

## Section 1: Color Tokens

### 1.1 Color Scales

Replace Muon's 6 scales (brand, gray, red, green, orange, cyan) with Feishu's 14 scales:

| Scale | Code | Purpose |
|-------|------|---------|
| Blue | B | Primary brand (#3370ff) |
| Carmine | C | Accent pink/magenta |
| Green | G | Success |
| Indigo | I | Accent indigo |
| Lime | L | Accent lime |
| Neutral | N | Gray / neutral |
| Orange | O | Warning |
| Purple | P | Accent purple |
| Red | R | Danger / destructive |
| Turquoise | T | Accent teal |
| Violet | V | Accent violet |
| Wathet | W | Accent sky blue |
| Yellow | Y | Accent yellow |

Each scale has 10 levels (50, 100, 200, 300, 400, 500, 600, 700, 800, 900) plus a `-raw` variant with comma-separated RGB values.

### 1.2 Primary Blue Scale (B) — Light Mode

```
--B50:   #f0f4ff   --B50-raw:   240,244,255
--B100:  #e1eaff   --B100-raw:  225,234,255
--B200:  #bacefd   --B200-raw:  186,206,253
--B300:  #82a7fc   --B300-raw:  130,167,252
--B400:  #4e83fd   --B400-raw:  78,131,253
--B500:  #3370ff   --B500-raw:  51,112,255     ← PRIMARY
--B600:  #245bdb   --B600-raw:  36,91,219
--B700:  #1c4cba   --B700-raw:  28,76,186
--B800:  #133c9a   --B800-raw:  19,60,154
--B900:  #0c296e   --B900-raw:  12,41,110
```

### 1.3 Gray Scale (N) — Light Mode

```
--N00:   #ffffff   --N00-raw:   255,255,255
--N50:   #f5f6f7   --N50-raw:   245,246,247
--N100:  #f2f3f5   --N100-raw:  242,243,245
--N200:  #eff0f1   --N200-raw:  239,240,241
--N300:  #dee0e3   --N300-raw:  222,224,227
--N350:  #d0d3d6   --N350-raw:  208,211,214
--N400:  #bbbfc4   --N400-raw:  187,191,196
--N500:  #8f959e   --N500-raw:  143,149,158
--N600:  #646a73   --N600-raw:  100,106,115
--N650:  #51565d   --N650-raw:  81,86,93
--N700:  #373c43   --N700-raw:  55,60,67
--N800:  #2b2f36   --N800-raw:  43,47,54
--N900:  #1f2329   --N900-raw:  31,35,41
--N950:  #0f1114   --N950-raw:  15,17,20
--N1000: #000000   --N1000-raw: 0,0,0
```

### 1.4 Functional Color Scales — Light Mode

**Red (R) — Danger:**
```
--R50: #fef1f1  --R100: #fde2e2  --R200: #fbbfbc  --R300: #f98e8b
--R400: #f76964  --R500: #f54a45  --R600: #fa7873  --R700: #ff9c99
--R800: #fec6c3  --R900: #ffe0e0
```

**Green (G) — Success:**
```
--G50: #f0fbef  --G100: #d9f5d6  --G200: #b7edb1  --G300: #8ee085
--G400: #62d256  --G500: #34c724  --G600: #2ea121  --G700: #237b19
--G800: #186010  --G900: #124b0c
```

**Orange (O) — Warning:**
```
--O50: #fff5eb  --O100: #feead2  --O200: #fed4a4  --O300: #ffba6b
--O400: #ffa53d  --O500: #ff8800  --O600: #f5a54a  --O700: #fabc75
--O800: #ffd8ac  --O900: #ffeace
```

### 1.5 N-Scale Opacity Variants

Feishu provides pre-computed opacity variants for dark-on-light and light-on-dark:

```
--N00-5:  rgba(var(--N00-raw), 0.05)
--N00-10: rgba(var(--N00-raw), 0.10)
... (5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90)
--N900-5: rgba(var(--N900-raw), 0.05)
... (same levels)
```

### 1.6 Semantic Tokens — Light Mode

| Feishu Token | Light Value | Muon Mapping | Usage |
|---|---|---|---|
| `--bg-body` | `var(--N00)` | `--color-background` | Page background |
| `--bg-base` | `var(--N100)` | `--color-sidebar` | Sidebar/surface |
| `--bg-float` | `var(--N00)` | `--color-card` | Cards/dialogs |
| `--bg-float-overlay` | `var(--N50)` | — | Overlay panels |
| `--bg-mask` | `rgba(0,0,0,0.4)` | — | Modal backdrop |
| `--text-title` | `var(--N900)` | `--color-foreground` | Primary text |
| `--text-caption` | `var(--N600)` | `--color-muted-foreground` | Secondary text |
| `--text-placeholder` | `var(--N500)` | — | Input placeholders |
| `--text-link-normal` | `var(--B600)` | — | Link color |
| `--text-link-hover` | `var(--B500)` | — | Link hover |
| `--text-disabled` | `var(--N400)` | — | Disabled text |
| `--icon-n1` | `var(--N800)` | — | Primary icons |
| `--icon-n2` | `var(--N600)` | — | Secondary icons |
| `--icon-n3` | `var(--N500)` | — | Tertiary icons |
| `--icon-disabled` | `var(--N400)` | — | Disabled icons |
| `--fill-hover` | `rgba(var(--N900-raw), 0.08)` | `--color-accent` | Hover background |
| `--fill-active` | `rgba(var(--B500-raw), 0.12)` | — | Active/selected fill |
| `--fill-selected` | `rgba(var(--B500-raw), 0.08)` | — | Selection background |
| `--line-border-card` | `rgba(var(--N900-raw), 0.15)` | `--color-border` | Card borders |
| `--line-divider-default` | `rgba(var(--N900-raw), 0.15)` | — | Dividers |
| `--line-border-component` | `var(--N350)` | — | Component borders |
| `--primary-pri-500` | `var(--B500)` | `--color-primary` | Primary color |
| `--function-danger-500` | `var(--R500)` | `--color-destructive` | Danger color |
| `--function-warning-500` | `var(--O500)` | `--color-warning` | Warning color |

### 1.7 Dark Mode — Key Values

| Token | Light | Dark |
|-------|-------|------|
| `--N00` | `#ffffff` | `#0a0a0a` |
| `--N50` | `#f5f6f7` | `#1a1a1a` |
| `--N100` | `#f2f3f5` | `#292929` |
| `--N200` | `#eff0f1` | `#373737` |
| `--N900` | `#1f2329` | `#ebebeb` |
| `--B500` | `#3370ff` | `#4c88ff` |
| `--R500` | `#f54a45` | `#f05b56` |
| `--G500` | `#34c724` | `#54c248` |
| `--O500` | `#ff8800` | `#f2962c` |
| `--bg-body` | `var(--N00)` | `var(--N50)` |
| `--bg-base` | `var(--N100)` | — (same) |
| `--bg-float` | `var(--N00)` | `var(--N100)` |
| `--bg-mask` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.7)` |

**Key dark difference:** Primary brightens to `#4c88ff` in dark mode (vs `#3370ff` in light). This is intentional — darker backgrounds need brighter accents for equivalent contrast.

---

## Section 2: Typography

### 2.1 Font Stack

**Replace Muon's font stack with Feishu's:**

```
font-family: "LarkEmojiFont", "LarkChineseQuote", -apple-system, BlinkMacSystemFont,
  "Helvetica Neue", Tahoma, "PingFang SC", "Microsoft Yahei", Arial,
  "Hiragino Sans GB", sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
  "Segoe UI Symbol", "Noto Color Emoji"
```

LarkEmojiFont and LarkChineseQuote are Feishu-bundled fonts. For Muon, remove these references and use the system fallback chain.

### 2.2 Font Size Scale

| Token | Current | New | Delta |
|-------|---------|-----|-------|
| `--text-xs` | 12px / 18px | **10px** / 14px | -2px |
| `--text-sm` | 13px / 20px | **12px** / 18px | -1px |
| `--text-base` | 14px / 22px | **14px** / 20px | line-height -2px |
| `--text-lg` | 16px / 24px | **16px** / 22px | line-height -2px |
| `--text-xl` | 18px / 26px | **18px** / 24px | line-height -2px |
| `--text-2xl` | 20px / 28px | **20px** / 26px | line-height -2px |

### 2.3 Message Text

| Property | Current | New |
|----------|---------|-----|
| Body size | 15px | **14px** |
| Body line-height | 1.625 (leading-relaxed) | **20px** (1.43) |
| Preview text | 12px | **12px** ✓ |
| Timestamp | 12px | **10px** |
| Room name | 15px | **16px** |
| Conversation name | 13px | **14px** |

---

## Section 3: Border Radius

| Element | Current | New | Tailwind Equivalent |
|---------|---------|-----|---------------------|
| Small (tags, chips) | 2px | **2px** | `rounded-sm` ✓ |
| Default (buttons, inputs) | 4px | **6px** | `rounded-md` |
| Avatar | 6px | **7px** | custom `rounded-[7px]` |
| Card/Modal | 8px | **10px** | `rounded-[10px]` |
| Message bubble | 16px | **20px** | `rounded-[20px]` |
| Pill/full | 9999px | **9999px** | `rounded-full` ✓ |

---

## Section 4: Shadows

### 4.1 Replace Muon's 5-level shadow system with Feishu's 6-tier system

Each tier has **4 directional variants** (up/down/left/right) and optional **primary-color variants** for branded elements.

**s1 — Subtle (cards, hover bars):**
```
--shadow-s1-down: 0px 1px 2px -2px rgba(0,0,0,0.02),
                   0px 2px 4px rgba(0,0,0,0.02),
                   0px 2px 8px 2px rgba(0,0,0,0.02)
```

**s2 — Raised (dropdowns, tooltips):**
```
--shadow-s2-down: 0px 4px 16px 4px rgba(0,0,0,0.03),
                   0px 4px 8px rgba(0,0,0,0.02),
                   0px 2px 4px -4px rgba(0,0,0,0.02)
```

**s3 — Modal (dialogs, modals):**
```
--shadow-s3-down: 0px 6px 18px 6px rgba(0,0,0,0.03),
                   0px 3px 6px -6px rgba(0,0,0,0.05),
                   0px 4px 8px rgba(0,0,0,0.03)
```

**s4 — High (search modal, coach marks):**
```
--shadow-s4-down: 0px 8px 24px 8px rgba(0,0,0,0.04),
                   0px 6px 12px rgba(0,0,0,0.04),
                   0px 4px 8px -8px rgba(0,0,0,0.06)
```

**s5 — Max (top-level over everything):**
```
--shadow-s5-down: 0px 10px 36px 10px rgba(0,0,0,0.04),
                   0px 8px 24px rgba(0,0,0,0.04),
                   0px 6px 12px -10px rgba(0,0,0,0.06)
```

**sm/md/lg — Legacy simple shadows:**
```
--shadow-sm-down: 0px 2px 4px rgba(var(--N900-raw), 0.12)
--shadow-md-down: 0px 4px 8px rgba(var(--N900-raw), 0.10)
--shadow-lg-down: 0px 6px 24px rgba(var(--N900-raw), 0.08)
```

**Primary color shadows** (s1-pri through s5-pri) use rgba(var(--B500-raw), ...) for branded elevation.

**Dark mode:** Shadows use `rgba(var(--N900-raw), ...)` instead of `rgba(0,0,0,...)`.

---

## Section 5: Component-Level Alignment

### 5.1 App Rail (Left Nav)

| Property | Current | New |
|----------|---------|-----|
| Width | 64px | **64px** ✓ |
| Active indicator | 2px blue | **3px** blue |
| Icon size | 20px | **16px** |
| Icon spacing | 4px gap | **4px** gap ✓ |
| Unread badge | 8px dot, blue | **16px** circle, red `#f54a45` |

### 5.2 Conversation Sidebar

| Property | Current | New |
|----------|---------|-----|
| Width | auto (flex) | **260px** fixed |
| Header | 56px | **56px** ✓ |
| Search bar | 32px | **32px** ✓ |
| Filter tabs | 28px, gap-1.5 | **28px**, gap-1 (4px) |
| Item height | 54px min | **60px** min |
| Item padding | 12px 16px (px-3 py-2) | **10px 16px** |
| Avatar | 36px, r=6px | **36px**, **r=7px** |
| Name font | 13px | **14px** semibold |
| Preview font | 12px | **12px** ✓ |
| Active bar | 2px blue | **3px** blue |
| Spacing | space-y-0.5 (2px) | **0px** (no gap, density) |

### 5.3 Chat Header

| Property | Current | New |
|----------|---------|-----|
| Layout | Two rows (56px + 36px) | **Single row** 56px with topic below |
| Room name | 15px semibold | **16px** semibold |
| Topic | 12px, hidden compact | **12px**, always visible, truncated |
| Tabs | h-9 (36px) | **32px** chips |
| Action gap | 4px (gap-1) | **8px** |
| Action icons | 20px | **18px** |

### 5.4 Message Bubble

| Property | Current | New | Tailwind |
|----------|---------|-----|----------|
| Border radius | 16px (rounded-2xl) | **20px** | `rounded-[20px]` |
| Padding | 6px 12px (px-3 py-1.5) | **10px 16px** | `px-4 py-2.5` |
| Font size | 15px | **14px** | `text-sm` (after scale change) |
| Line height | 1.625 | **20px** | `leading-[20px]` |
| Max width | min(72%, 900px) | **70%** | |
| Own BG | bg-primary/10 | **#e1eaff** (B100) | `bg-[var(--B100)]` |
| Others BG | bg-muted/60 | **#eff0f1** (N200) | `bg-[var(--N200)]` |
| Group gap | 2px (space-y-0.5) | **0.5px** | `space-y-[0.5px]` |
| Avatar at start | 32px | **32px** ✓ | |
| Grouped avatar | 32px | **28px** (compact) | |

### 5.5 Message Reactions

| Property | Current | New |
|----------|---------|-----|
| Chip height | auto | **24px** |
| Chip radius | 6px (rounded-md) | **6px** ✓ |
| Chip padding | 4px 6px | **2px 6px** |
| Emoji size | auto | **16px** |
| Count font | 12px | **12px** ✓ |
| Own reaction | bg-primary/10 border-primary/30 | **bg B100 border B300** |
| Others | bg muted | **bg N100 border transparent** |
| + button | appears on hover | appears on hover ✓ |
| Margin from bubble | 4px (mt-1) | **8px** |

### 5.6 Hover Action Bar

| Property | Current | New |
|----------|---------|-----|
| Position | top-right of bubble | top-right, **6px** from edge |
| Background | bg-popover/95, glass | **bg-white/90**, glass |
| Border | border/50 | **1px rgba(31,35,41,0.08)** |
| Radius | 12px (rounded-xl) | **10px** |
| Shadow | ? | **s1-down** |
| Item size | 32px touch | **28px × 28px** |
| Icon size | 18px | **16px** |
| Gap | gap-0.5 | **4px** |

### 5.7 Context Menu

| Property | Current | New |
|----------|---------|-----|
| Min width | content-based | **176px** |
| Radius | 6px (rounded-md) | **10px** |
| Shadow | shadow-md | **s3-down** |
| Item height | auto | **32px** |
| Item padding | auto | **6px 12px** |
| Item font | 13px | **14px** |
| Icon | 16px, 12px gap | **16px**, **8px** gap |
| Separator | auto | **1px rgba(31,35,41,0.06)** |

### 5.8 Message Input

| Property | Current | New |
|----------|---------|-----|
| Toolbar height | auto | **44px** |
| Textarea min-height | auto | **40px**, auto-expand to 120px |
| Send button | primary bg | **B500 filled circle**, 32px |
| Input padding | auto | **8px 16px** |
| Attachment button | auto | **18px** icon, 28px touch |

### 5.9 Panels (Members, Settings, Thread)

| Property | Current | New |
|----------|---------|-----|
| Width | 320px | **320px** ✓ |
| Header | h-14 (56px) | **56px** ✓ |
| Search | input-sm | **32px** |
| Item | list-item | **52px**, avatar 36px |
| Section header | auto | **28px**, 12px font N500 |

### 5.10 Typing Indicator

| Property | Current | New |
|----------|---------|-----|
| Position | below list, above input | below list, above input ✓ |
| Height | auto | **24px** |
| Padding left | auto | **40px** (aligns with bubble) |
| Font | auto | **12px**, color N500 |
| Animation | bouncing dots | **wave** dots |

### 5.11 Read Receipts

| Property | Current | New |
|----------|---------|-----|
| Position | separate bar | **inline with bubble** |
| Icon style | — | ✓ sent, ✓✓ delivered, ✓✓ blue read |
| Font | auto | **10px**, color N400 |
| Grouped msg | — | **only last message** shows status |

### 5.12 Timestamp

| Property | Current | New |
|----------|---------|-----|
| Visibility | hover-revealed | **hover-revealed** ✓ |
| Font | 12px | **10px** |
| Color | auto | **N400** (#bbbfc4) |
| Format | HH:MM | **HH:MM** ✓ |

---

## Section 6: File Structure

### Token files to modify:

```
packages/ui/src/tokens/
├── colors.css      ← Replace all palette + semantic tokens (light + dark via :root/.dark)
├── typography.css  ← Adjust font sizes, line heights, font stack
├── radius.css      ← New values
├── shadow.css      ← Replace with 6-tier Feishu system
├── spacing.css     ← Minor adjustments (add 0.5px, etc.)
├── density.css     ← Adjust control heights
└── motion.css      ← Mostly unchanged, add wave animation
```
Dark mode values are defined alongside light mode in each token file using Tailwind v4's `.dark` class selector, consistent with the existing pattern in Muon's token files.

### Component files to modify (in order of impact):

**Phase 1 — Token-only changes (no component edits needed):**
All color, typography, radius, and shadow changes cascade automatically via design tokens.

**Phase 2 — High-impact component adjustments:**

| File | Changes |
|------|---------|
| `src/features/chat/components/ChatMessage.vue` | Bubble radius 16→20px, padding 6/12→10/16, text 15→14px, bg refs, group gap |
| `src/features/chat/components/MessageBubble.vue` | Same bubble adjustments |
| `src/features/chat/components/MessageGroup.vue` | Slot width, gap, avatar sizing |
| `src/features/chat/components/ConversationItem.vue` | Height 54→60px, padding, name 13→14px, active bar 2→3px |
| `src/features/chat/components/ConversationList.vue` | Width 260px fixed, filter gap |
| `src/features/chat/components/ChatHeader.vue` | Single row 56px, room name 15→16px, tab sizes |
| `src/features/chat/components/MessageActionBar.vue` | Radius 12→10, shadow s1, item 32→28px, icon 18→16px |
| `src/features/chat/components/SystemMessage.vue` | Text, icon sizes |

**Phase 3 — Additional components:**

| File | Changes |
|------|---------|
| `src/features/chat/components/ReactionBar.vue` | Chip sizing, margin, own/others styling |
| `src/features/chat/components/RichTextInput.vue` | Toolbar height 44px, send button shape |
| `src/features/chat/components/ThreadPanel.vue` | 360px width ✓, internal spacing |
| `src/features/chat/components/MemberListPanel.vue` | Item height 52px, section headers |
| `src/features/chat/components/TypingIndicator.vue` | Height, padding, font |
| `src/features/chat/components/TimeStamp.vue` | Font 12→10px, color ref |
| `src/app/components/workspace/WorkspaceAppRail.vue` | Active bar 2→3px, icon 20→16px |
| `src/features/chat/components/ForwardDialog.vue` | Width 520px, radius 10px |
| `src/features/chat/components/NewChatDialog.vue` | Width 480px, radius 10px |
| `src/features/chat/components/MessageContextMenu.vue` | Width 176px, radius 10px |
| `packages/ui/src/components/ui/*` | shadcn component radius/shadows to Feishu values |

---

## Section 7: Implementation Strategy

### Order of operations:

1. **Token files** — Replace color scales, semantic tokens, and dark mode values. This alone fixes 60%+ of visual differences.
2. **Typography** — Adjust font sizes and line heights globally.
3. **Radius** — Update border radius token values.
4. **Shadows** — Replace with Feishu's multi-tier system.
5. **Message bubbles** — The highest-visibility component change.
6. **App shell** — Rail, sidebar, header adjustments.
7. **Secondary components** — Reactions, actions, panels, dialogs.
8. **Dark mode verification** — Compare against Feishu dark mode.

### Risk mitigation:

- Tokens are pure CSS — no runtime risk, easy to revert via git
- Component changes are additive (adjust existing classes, don't restructure)
- Each phase is independently testable by running the dev server
- Dark/light toggle verification after each phase

---

## Section 8: Success Criteria

- Brand color matches Feishu's `#3370ff` in light, `#4c88ff` in dark
- Message bubbles have 20px radius, 10px/16px padding, 14px text
- Conversation items have 60px height with 3px active bar
- Shadows match Feishu's multi-layer depth system
- All 14 color scales available as design tokens
- Raw-color opacity layer enables `fill-hover`/`fill-active` pattern
- Dark mode values are Feishu-equivalent (warmer grays, brighter primary)
- Font sizes match Feishu scale (10/12/14/16/18/20)
- Line heights are compact (Feishu's near-1.0 multiplier)
