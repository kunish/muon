# Feishu-Style Redesign Specification

**Date**: 2026-04-01
**Status**: Draft
**Scope**: Complete visual and structural redesign of Muon from Discord-like to Feishu (Lark)-like

## 1. Overview

Muon is a Tauri 2 + Vue 3 + Matrix desktop messaging application. This spec describes a full redesign from a Discord-style dark/gaming aesthetic to a Feishu (Lark)-style professional workspace aesthetic. The redesign covers navigation paradigm, color system, shape language, chat area, density, and all module pages.

### 1.1 Goals

- **Professional workspace feel**: Clean, spacious, light-first design
- **Unified conversation model**: Single time-ordered list replacing separate DM/Server modes
- **Feature module navigation**: Left rail organized by function (messaging, contacts, calendar, docs, settings) instead of by Matrix Space
- **Dual theme support**: Light (primary) + Dark, using existing shadcn CSS variable system
- **Preserve functionality**: All existing features remain; only the visual/structural layer changes

### 1.2 Non-Goals

- No changes to Matrix protocol integration or business logic
- No new features (calendar backend, docs backend, etc.)
- No changes to auth flow or Tauri native layer

## 2. Design Decisions (User-Approved)

| #   | Decision            | Choice                                                                            |
| --- | ------------------- | --------------------------------------------------------------------------------- |
| 1   | Navigation paradigm | Left rail = feature module icons with text labels (64px)                          |
| 2   | Theme strategy      | Dual light + dark, keep shadcn CSS variable system                                |
| 3   | Conversation list   | Unified time-ordered list (DM + groups + channels in one list)                    |
| 4   | Color scheme        | White/light gray backgrounds, `#3370FF` blue primary accent                       |
| 5   | Shape language      | Rounded rectangles (8px radius) for avatars, cards, buttons                       |
| 6   | Chat area           | Light gray bg (`#f7f8fa`) + white card bubbles, own messages blue + right-aligned |
| 7   | Density             | More spacious — larger line-height, padding, whitespace                           |

## 3. Layout Architecture

### 3.1 Current Layout (Discord-style)

```
┌──────────────────────────────────────────────┐
│ ServerList(52px) │ ChannelSidebar(280px) │ RouterView(flex-1) │
│  - DM button     │  - DM mode / Server mode  │                    │
│  - Space icons   │  - channel tree / DM list  │                    │
│  - Add server    │  - UserPanel               │                    │
└──────────────────────────────────────────────┘
```

- `ServerList` shows Matrix Space icons vertically (circular avatars)
- `ChannelSidebar` has two modes: DM list or Server channel tree
- Feature pages (`/contacts`, `/settings`, etc.) hide the ChannelSidebar

### 3.2 New Layout (Feishu-style)

```
┌──────────────────────────────────────────────┐
│ NavRail(64px)   │ ConversationSidebar(280px) │ RouterView(flex-1)   │
│  - 消息 (active) │  - Search bar              │                      │
│  - 通讯录        │  - Unified conversation    │                      │
│  - 日历          │    list (time-ordered)     │                      │
│  - 文档          │  - UserPanel               │                      │
│  - 设置          │                            │                      │
│                  │                            │                      │
│  [avatar]        │                            │                      │
└──────────────────────────────────────────────┘
```

- `NavRail` (replaces `ServerList`): 64px wide, feature module icons with text labels below each icon. Active module highlighted with blue accent background.
- `ConversationSidebar` (replaces `ChannelSidebar`): 280px wide, only visible on messaging route (`/dm`, `/dm/:roomId`, `/server/:serverId/channel/:channelId`). Contains search bar + unified conversation list + UserPanel.
- Feature pages render their own sidebar (if needed) inside `RouterView`.

### 3.3 Navigation Rail Modules

| Icon          | Label  | Route       | Sidebar                            |
| ------------- | ------ | ----------- | ---------------------------------- |
| MessageSquare | 消息   | `/dm`       | ConversationSidebar (280px)        |
| Users         | 通讯录 | `/contacts` | ContactsPage has own 280px sidebar |
| Calendar      | 日历   | `/calendar` | No sidebar (full width)            |
| FileText      | 文档   | `/docs`     | No sidebar (full width)            |
| Settings      | 设置   | `/settings` | SettingsPage has own 200px nav     |

The user's avatar is placed at the bottom of the NavRail, clicking it opens a profile/status popover.

### 3.4 Matrix Spaces in the New Model

Matrix Spaces (servers) are no longer top-level navigation items. Instead:

- Space channels appear in the unified conversation list alongside DMs
- Conversations are grouped by Space within the list (collapsible Space headers)
- Users can still create/join/leave Spaces
- Space settings are accessible via context menu on Space group headers

### 3.5 Route Changes

| Current Route                          | New Route             | Notes                                          |
| -------------------------------------- | --------------------- | ---------------------------------------------- |
| `/dm`                                  | `/messages`           | Renamed for clarity (optional, can keep `/dm`) |
| `/dm/:roomId`                          | `/messages/:roomId`   | Same                                           |
| `/server/:serverId/channel/:channelId` | `/messages/:roomId`   | Channels are just rooms in unified list        |
| `/contacts`                            | `/contacts`           | No change                                      |
| `/calendar`                            | `/calendar`           | No change                                      |
| `/docs`                                | `/docs`               | No change                                      |
| `/settings`                            | `/settings`           | No change                                      |
| `/calls`                               | `/contacts` (sub-tab) | Merge into contacts or keep separate           |
| `/approvals`                           | Remove or keep as-is  | Placeholder page                               |
| `/email`                               | Remove or keep as-is  | Placeholder page                               |

**Decision**: Keep `/dm` prefix for backward compatibility. Channel routes (`/server/:serverId/channel/:channelId`) remain valid but the sidebar no longer switches modes — it always shows the unified list.

## 4. Color System

### 4.1 Primary Accent

- **Hex**: `#3370FF`
- **oklch**: `oklch(56% 0.22 264)` (approximate)
- Replaces current amber accent (`oklch(72% 0.17 65)`)

### 4.2 Light Theme Tokens

```css
@theme {
  /* ── Muon Light — Feishu-style clean blue ── */
  --color-background: oklch(100% 0 0); /* #ffffff */
  --color-foreground: oklch(21% 0.006 265); /* ~#1f2329 */
  --color-muted: oklch(97% 0.003 265); /* ~#f5f6f7 */
  --color-muted-foreground: oklch(55% 0.01 265); /* ~#646a73 */
  --color-primary: oklch(56% 0.22 264); /* #3370FF */
  --color-primary-foreground: oklch(100% 0 0); /* #ffffff (white on blue) */
  --color-accent: oklch(96% 0.01 264); /* ~#f0f4ff light blue tint */
  --color-accent-foreground: oklch(21% 0.006 265); /* ~#1f2329 */
  --color-destructive: oklch(55% 0.22 27); /* red (unchanged) */
  --color-destructive-foreground: oklch(97% 0 0); /* white */
  --color-border: oklch(92% 0.003 265); /* ~#dee0e3 */
  --color-input: oklch(97% 0.003 265); /* ~#f5f6f7 */
  --color-ring: oklch(56% 0.22 264); /* #3370FF */
  --color-card: oklch(100% 0 0); /* #ffffff */
  --color-card-foreground: oklch(21% 0.006 265); /* ~#1f2329 */
  --color-secondary: oklch(50% 0.01 265); /* gray */
  --color-secondary-foreground: oklch(100% 0 0); /* white */
  --color-popover: oklch(100% 0 0); /* #ffffff */
  --color-popover-foreground: oklch(21% 0.006 265); /* ~#1f2329 */
  --color-sidebar: oklch(98% 0.003 265); /* ~#f8f9fa */
  --color-sidebar-foreground: oklch(21% 0.006 265); /* ~#1f2329 */
  --color-sidebar-border: oklch(92% 0.003 265); /* ~#dee0e3 */
  --color-sidebar-accent: oklch(94% 0.01 264); /* light blue bg for selected */
  --color-sidebar-accent-foreground: oklch(56% 0.22 264); /* blue text */
  --color-sidebar-primary: oklch(56% 0.22 264); /* #3370FF */
  --color-sidebar-primary-foreground: oklch(100% 0 0); /* white */
  --color-sidebar-ring: oklch(56% 0.22 264); /* #3370FF */
  --color-server-bar: oklch(97% 0.003 265); /* ~#f0f1f2 nav rail bg */
  --color-success: oklch(62% 0.17 155); /* green (unchanged) */
  --color-warning: oklch(75% 0.15 75); /* amber (unchanged) */
  --color-chat-bg: oklch(97.5% 0.003 265); /* #f7f8fa chat area background NEW */
  --color-chat-bubble-other: oklch(100% 0 0); /* #ffffff other's bubble NEW */
  --color-chat-bubble-self: oklch(56% 0.22 264); /* #3370FF own bubble NEW */
  --color-chat-bubble-self-foreground: oklch(100% 0 0); /* white text on blue NEW */
}
```

### 4.3 Dark Theme Tokens

```css
.dark {
  /* ── Muon Dark — Feishu-style professional dark ── */
  --color-background: oklch(16% 0.005 265); /* ~#1a1a1a */
  --color-foreground: oklch(90% 0.005 265); /* ~#e0e0e0 */
  --color-muted: oklch(20% 0.005 265); /* ~#2a2a2a */
  --color-muted-foreground: oklch(58% 0.01 265); /* ~#8a8a8a */
  --color-primary: oklch(62% 0.2 264); /* lighter blue for dark mode */
  --color-primary-foreground: oklch(100% 0 0); /* white */
  --color-accent: oklch(22% 0.02 264); /* dark blue tint */
  --color-accent-foreground: oklch(90% 0.005 265); /* light text */
  --color-destructive: oklch(60% 0.2 25); /* red */
  --color-destructive-foreground: oklch(97% 0 0); /* white */
  --color-border: oklch(26% 0.005 265); /* ~#3a3a3a */
  --color-input: oklch(22% 0.005 265); /* ~#2e2e2e */
  --color-ring: oklch(62% 0.2 264); /* lighter blue */
  --color-card: oklch(19% 0.005 265); /* ~#242424 */
  --color-card-foreground: oklch(90% 0.005 265); /* light text */
  --color-secondary: oklch(50% 0.01 265); /* gray */
  --color-secondary-foreground: oklch(97% 0 0); /* white */
  --color-popover: oklch(20% 0.005 265); /* ~#2a2a2a */
  --color-popover-foreground: oklch(90% 0.005 265); /* light text */
  --color-sidebar: oklch(14% 0.005 265); /* ~#161616 */
  --color-sidebar-foreground: oklch(90% 0.005 265); /* light text */
  --color-sidebar-border: oklch(24% 0.005 265); /* ~#333 */
  --color-sidebar-accent: oklch(24% 0.02 264); /* dark blue bg selected */
  --color-sidebar-accent-foreground: oklch(75% 0.15 264); /* blue text */
  --color-sidebar-primary: oklch(62% 0.2 264); /* lighter blue */
  --color-sidebar-primary-foreground: oklch(100% 0 0); /* white */
  --color-sidebar-ring: oklch(62% 0.2 264); /* lighter blue */
  --color-server-bar: oklch(12% 0.005 265); /* ~#141414 nav rail bg */
  --color-success: oklch(65% 0.16 155); /* green */
  --color-warning: oklch(78% 0.15 75); /* amber */
  --color-chat-bg: oklch(18% 0.005 265); /* dark chat bg NEW */
  --color-chat-bubble-other: oklch(22% 0.005 265); /* dark bubble NEW */
  --color-chat-bubble-self: oklch(56% 0.22 264); /* blue bubble NEW */
  --color-chat-bubble-self-foreground: oklch(100% 0 0); /* white text NEW */
}
```

### 4.4 New CSS Custom Properties

Add to `@theme` block for Tailwind CSS v4 consumption:

- `--color-chat-bg` — Chat area background (light gray / dark gray)
- `--color-chat-bubble-other` — Other user's message bubble background
- `--color-chat-bubble-self` — Own message bubble background
- `--color-chat-bubble-self-foreground` — Own message text color

## 5. Typography

### 5.1 Font Stack

No change — keep Inter + system fallbacks:

```css
font-family:
  'Inter',
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  system-ui,
  sans-serif;
```

### 5.2 Scale

| Token       | Size | Weight | Use                           |
| ----------- | ---- | ------ | ----------------------------- |
| `text-xs`   | 11px | 400    | Timestamps, meta              |
| `text-sm`   | 13px | 400    | Secondary text, sidebar items |
| `text-base` | 14px | 400    | Body text, messages           |
| `text-lg`   | 16px | 500    | Section headers               |
| `text-xl`   | 18px | 600    | Page titles                   |
| `text-2xl`  | 22px | 600    | Module headers                |

### 5.3 Line Height

Increase default line-height from current ~1.4 to **1.625** (`leading-relaxed`) for body text to match Feishu's spacious feel.

## 6. Shape Language

### 6.1 Border Radius

| Element            | Current                                | New                              |
| ------------------ | -------------------------------------- | -------------------------------- |
| Avatars            | `rounded-full` (circle)                | `rounded-lg` (8px, rounded rect) |
| Buttons            | `rounded-md` (6px)                     | `rounded-lg` (8px)               |
| Cards              | `rounded-lg` (8px)                     | `rounded-xl` (12px)              |
| Input fields       | `rounded-md` (6px)                     | `rounded-lg` (8px)               |
| Chat bubbles       | `rounded-2xl` (16px)                   | `rounded-xl` (12px)              |
| Dropdowns/Popovers | `rounded-md` (6px)                     | `rounded-xl` (12px)              |
| Nav rail items     | `rounded-2xl`/`rounded-3xl` (animated) | `rounded-lg` (8px, static)       |
| Badges             | `rounded-full`                         | `rounded-md` (4px)               |
| Tags/Chips         | `rounded-full`                         | `rounded` (6px)                  |

### 6.2 Global Radius Variable

Update `--radius: 0.625rem` (10px) to `--radius: 0.5rem` (8px) as the base unit.

## 7. Component Specifications

### 7.1 Navigation Rail (`NavRail.vue`, replaces `ServerList.vue`)

- **Width**: 64px
- **Background**: `bg-server-bar` (light gray)
- **Border**: Right border `border-r border-border`
- **Items**: Icon (20px lucide) + text label (11px) stacked vertically
- **Active state**: Blue icon + blue text + light blue background (`bg-accent rounded-lg`)
- **Hover state**: Light gray background
- **User avatar**: Bottom of rail, 32x32 rounded-lg
- **No more**: Server icons, drag-and-drop reorder, unread indicators on servers

```
NavRail structure:
├── NavItem: 消息 (MessageSquare icon)
├── NavItem: 通讯录 (Users icon)
├── NavItem: 日历 (Calendar icon)
├── NavItem: 文档 (FileText icon)
├── <spacer flex-1>
├── NavItem: 设置 (Settings icon)
└── UserAvatar (32x32)
```

### 7.2 Conversation Sidebar (`ConversationSidebar.vue`, replaces `ChannelSidebar.vue`)

- **Width**: 280px
- **Background**: `bg-sidebar`
- **Visible on**: messaging routes only (`/dm`, `/dm/:roomId`, `/server/.../channel/...`)

```
ConversationSidebar structure:
├── Search bar (rounded-lg, bg-input, 36px height)
├── Conversation list (flex-1, overflow-y-auto)
│   ├── ConversationItem (DM or group or channel)
│   │   ├── Avatar (36x36, rounded-lg)
│   │   ├── Name + last message preview
│   │   ├── Timestamp (right-aligned)
│   │   └── Unread badge (if any)
│   └── ... (sorted by last message time)
└── UserPanel (bottom)
```

#### Conversation Item Layout

```
┌──────────────────────────────────────┐
│ [avatar]  Name            2:30 PM   │
│           Last message...    [3]    │
└──────────────────────────────────────┘
```

- **Height**: ~64px
- **Avatar**: 36x36, `rounded-lg`
- **Name**: `text-sm font-medium`, single line, truncated
- **Preview**: `text-xs text-muted-foreground`, single line, truncated
- **Time**: `text-xs text-muted-foreground`, right-aligned
- **Unread badge**: Blue dot or count badge, `bg-primary text-primary-foreground rounded-md text-[11px] px-1.5 min-w-[18px]`
- **Selected state**: `bg-sidebar-accent` with `text-sidebar-accent-foreground`
- **Hover state**: `bg-muted/50`

#### Space Grouping (within conversation list)

- Space channels appear in the list sorted by last message time
- Each Space has a collapsible group header showing Space name + chevron
- Users can collapse/expand Space groups
- Pinned conversations appear at the top

### 7.3 Chat Area (`ChatPage.vue`)

#### Background

- Chat messages area: `bg-chat-bg` (light gray `#f7f8fa` in light mode)
- Not the entire ChatPage — just the messages scroll area

#### Message Bubbles

**Other's messages (left-aligned):**

```
  [avatar]  Name           2:30 PM
            ┌──────────────────┐
            │ Message content  │  bg-chat-bubble-other (white)
            └──────────────────┘  rounded-xl, shadow-sm
```

**Own messages (right-aligned):**

```
                          2:31 PM
            ┌──────────────────┐
            │ Message content  │  bg-chat-bubble-self (blue)
            └──────────────────┘  text-white, rounded-xl, shadow-sm
```

- **Bubble padding**: `px-3 py-2`
- **Max width**: `max-w-[70%]`
- **Shadow**: `shadow-sm` (very subtle)
- **Own bubble**: Blue background, white text, right-aligned
- **Other bubble**: White background, dark text, left-aligned
- **Avatar**: 32x32, `rounded-lg`, only shown for other's messages
- **Sender name**: `text-xs text-muted-foreground`, only for group chats, above bubble
- **Timestamp**: `text-[11px] text-muted-foreground`, outside bubble

#### Message Input Area

- **Background**: `bg-background` (white)
- **Border top**: `border-t border-border`
- **Input**: Rounded-lg, min-height 40px, `bg-input`
- **Send button**: Blue (`bg-primary`), rounded-lg, icon only

### 7.4 Buttons

| Variant     | Background             | Text              | Border          | Hover      |
| ----------- | ---------------------- | ----------------- | --------------- | ---------- |
| Primary     | `bg-primary` (#3370FF) | white             | none            | darken 10% |
| Secondary   | `bg-muted`             | `text-foreground` | none            | darken 5%  |
| Ghost       | transparent            | `text-foreground` | none            | `bg-muted` |
| Outline     | transparent            | `text-foreground` | `border-border` | `bg-muted` |
| Destructive | `bg-destructive`       | white             | none            | darken 10% |

All buttons: `rounded-lg` (8px), `h-9 px-4`, `text-sm font-medium`.

### 7.5 Avatars

- **Shape**: `rounded-lg` (8px) — always rounded rectangle, never circle
- **Sizes**: 24px (inline), 32px (chat/nav), 36px (conversation list), 48px (profile), 64px (detail view)
- **Fallback**: Gradient background + first character, `text-white font-semibold`

### 7.6 Badges

- **Unread count**: `bg-primary text-white rounded-md text-[11px] px-1.5 min-w-[18px] h-[18px]`
- **Status dot**: 8px circle (`rounded-full` is OK for dots), positioned bottom-right of avatar
- **Tags**: `bg-accent text-accent-foreground rounded px-2 py-0.5 text-xs`

## 8. Module Pages

### 8.1 Contacts Page (`/contacts`)

Layout: 280px sidebar + flex-1 detail area

**Sidebar:**

- Search bar at top
- Tab bar: All | Groups | Bots
- Contact list: avatar (36x36 rounded-lg) + name + status text
- Selected: `bg-sidebar-accent`

**Detail area:**

- Profile card: Centered, white card (`bg-card rounded-xl shadow-sm`)
- Large avatar (64px rounded-lg) + name + Matrix ID
- Action buttons: Message, Voice Call, Video Call (icon + label, ghost variant)
- Info section: Email, Phone, Organization fields

### 8.2 Settings Page (`/settings`)

Layout: 200px nav sidebar + flex-1 content area

**Nav sidebar:**

- 7 tabs stacked vertically: Profile, General, Notifications, Appearance, Shortcuts, Security, About
- Active tab: `bg-sidebar-accent text-sidebar-accent-foreground rounded-lg`
- Tab synced via URL query `?tab=`

**Content area:**

- Title at top (`text-xl font-semibold`)
- Content in white cards (`bg-card rounded-xl shadow-sm p-6`)
- Form elements with generous spacing (`space-y-6`)

### 8.3 Calendar Page (`/calendar`)

Layout: Full width within RouterView, flex layout

- Month navigation header with today button
- 7-column grid for days
- Today highlighted with blue accent
- Event dots below dates
- Side panel for today's events list (on wider screens)

### 8.4 Docs Page (`/docs`)

Layout: Full width, centered content (`max-w-4xl mx-auto`)

- Quick actions grid: 4 cards (New Doc, Import, Templates, Recent)
- File list: Icon + name + owner + modified date, hover bg
- Cards: `bg-card rounded-xl shadow-sm`

### 8.5 Calls Page (`/calls`)

Layout: Full width, centered content

- Call history as card list
- Each card: Avatar + name + call type icon + duration + timestamp
- Cards: `bg-card rounded-xl shadow-sm`

## 9. Spacing & Density

### 9.1 Spacing Tokens

| Token   | Value | Use                       |
| ------- | ----- | ------------------------- |
| `gap-1` | 4px   | Icon-to-text in nav items |
| `gap-2` | 8px   | Between inline elements   |
| `gap-3` | 12px  | Between list items        |
| `gap-4` | 16px  | Section padding           |
| `gap-6` | 24px  | Between sections          |
| `gap-8` | 32px  | Page-level spacing        |

### 9.2 Key Measurements

| Element                    | Value                                      |
| -------------------------- | ------------------------------------------ |
| Nav rail width             | 64px                                       |
| Conversation sidebar width | 280px                                      |
| Conversation item height   | ~64px                                      |
| Chat bubble max-width      | 70%                                        |
| Chat bubble padding        | 12px 16px                                  |
| Message vertical gap       | 8px (same sender), 16px (different sender) |
| Page content max-width     | 960px (centered pages)                     |
| Card padding               | 24px                                       |
| Input height               | 36-40px                                    |

## 10. File Change Map

### 10.1 Files to Create (New)

| File                                                   | Purpose                            |
| ------------------------------------------------------ | ---------------------------------- |
| `src/features/navigation/components/NavRail.vue`       | New feature module navigation rail |
| `src/features/navigation/components/NavItem.vue`       | Individual nav item (icon + label) |
| `src/features/chat/components/ConversationSidebar.vue` | Unified conversation list sidebar  |
| `src/features/chat/components/ConversationItem.vue`    | Single conversation list item      |

### 10.2 Files to Modify (Major)

| File                                                | Changes                                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/app/main.css`                                  | Replace all color tokens (amber → blue), add chat-bg tokens, update radius                         |
| `src/app/components/AppLayout.vue`                  | Replace ServerList with NavRail, ChannelSidebar with ConversationSidebar, update conditional logic |
| `src/features/chat/components/ChatPage.vue`         | Chat area background, message layout changes                                                       |
| `src/features/chat/components/MessageBubble.vue`    | Bubble styling: left/right alignment, blue own bubbles, rounded-xl, shadow                         |
| `src/features/chat/components/RichTextInput.vue`    | Input styling updates                                                                              |
| `src/features/contacts/components/ContactsPage.vue` | Style updates to match Feishu design                                                               |
| `src/features/settings/components/SettingsPage.vue` | Style updates                                                                                      |
| `src/features/calendar/components/CalendarPage.vue` | Style updates                                                                                      |
| `src/features/docs/components/DocsPage.vue`         | Style updates                                                                                      |
| `src/features/calls/components/CallsPage.vue`       | Style updates                                                                                      |

### 10.3 Files to Modify (Minor)

| File                                                   | Changes                                         |
| ------------------------------------------------------ | ----------------------------------------------- |
| `src/app/router/index.ts`                              | Keep existing routes, potentially add redirects |
| `src/features/server/components/ServerIcon.vue`        | Update to rounded-lg avatars                    |
| `src/features/server/components/UserPanel.vue`         | Style updates                                   |
| `src/features/contacts/components/ContactList.vue`     | Avatar shape, spacing updates                   |
| `src/features/contacts/components/UserProfile.vue`     | Card styling updates                            |
| All shadcn components using `rounded-full` for avatars | Change to `rounded-lg`                          |

### 10.4 Files to Deprecate

| File                                                | Replacement               |
| --------------------------------------------------- | ------------------------- |
| `src/features/server/components/ServerList.vue`     | `NavRail.vue`             |
| `src/features/server/components/ChannelSidebar.vue` | `ConversationSidebar.vue` |

These files should not be deleted immediately — keep them until the new components are fully tested, then remove.

## 11. Migration Strategy

### 11.1 Phase 1: Foundation (CSS + Layout Shell)

1. Update `main.css` color tokens (amber → blue for both light and dark)
2. Add new CSS custom properties (`chat-bg`, `chat-bubble-*`)
3. Update `--radius` to `0.5rem`
4. Create `NavRail.vue` and `NavItem.vue`
5. Update `AppLayout.vue` to use NavRail

### 11.2 Phase 2: Conversation Sidebar

1. Create `ConversationSidebar.vue` with unified list
2. Create `ConversationItem.vue`
3. Merge DM + channel conversations into single sorted list
4. Wire up to existing `useConversations` composable
5. Update AppLayout to use ConversationSidebar

### 11.3 Phase 3: Chat Area

1. Update ChatPage background to `bg-chat-bg`
2. Restyle MessageBubble for left/right alignment + blue own bubbles
3. Update RichTextInput styling
4. Adjust message spacing and density

### 11.4 Phase 4: Module Pages

1. Update ContactsPage, ContactList, UserProfile styles
2. Update SettingsPage styles
3. Update CalendarPage, DocsPage, CallsPage styles
4. Clean up remaining pages (approvals, email)

### 11.5 Phase 5: Polish & Cleanup

1. Update all avatar components to rounded-lg
2. Review all button, badge, tag components
3. Remove deprecated ServerList and ChannelSidebar
4. Test light + dark theme thoroughly
5. Verify all animations still work

## 12. Accessibility Considerations

- Blue primary (`#3370FF`) on white background has contrast ratio ≈ 4.6:1 — meets WCAG AA for normal text
- Dark theme blue (`oklch(62% 0.20 264)`) on dark backgrounds needs verification
- All interactive elements must maintain visible focus indicators (using `ring` color)
- Conversation list items must be keyboard navigable
- Nav rail items need `aria-current="page"` for active state

## 13. Open Questions

1. **Space grouping UX**: Should Space channels be visually grouped in the conversation list with collapsible headers, or fully flattened? → Decision: Collapsible groups
2. **Route migration**: Should we rename `/dm` to `/messages`? → Decision: Keep `/dm` for now
3. **Calls page**: Keep as standalone module or merge into contacts? → Decision: Keep as-is for now
4. **Placeholder pages** (approvals, email): Keep or remove? → Decision: Keep as-is

---

_Mockups approved by user:_

- `layout-comparison.html` — Discord vs Feishu comparison
- `full-layout.html` — Complete messaging module layout
- `design-system.html` — Color palette, tokens, components, typography
- `module-pages.html` — Contacts, Settings, Calendar, Docs, Calls pages
