# Feishu Workspace Redesign

## Goal

Refactor Muon's full application UI into a Feishu-inspired collaborative workspace. The redesign should move the product from a server-first chat shell toward an app-first work suite while preserving the Matrix-backed messaging, contacts, and settings experiences.

## Chosen direction

Use the "Modern Feishu Pro" visual direction:

- Soft cloud-like light surfaces with subtle blue accents.
- Layered translucent panels where useful, without reducing readability.
- Tight enterprise information density, but with more rounded and polished component surfaces than classic Feishu.
- Fully refined light and dark modes.

## Scope

### Complete core experiences

The following areas must remain complete and usable:

1. Messaging
   - Direct messages, group conversations, Matrix spaces, and channels appear inside the Message app.
   - Server/channel hierarchy becomes a grouped structure inside the message sidebar, not a global navigation rail.
   - Chat windows, empty state, voice status, user controls, inbox/deferred/knowledge/task panels remain reachable.

2. Contacts
   - Contacts and groups remain usable.
   - Contact profile, group settings, create group, and message-from-profile flows remain available.

3. Settings
   - Settings stays reachable from the workspace shell and user panel.
   - Existing settings content should be visually aligned with the new workspace system.

### Framework shell for secondary apps

Calendar, Docs, Approvals, Email, and Calls should move into the new workspace shell and receive high-quality Feishu-style page frames. Existing page functionality should be preserved when already present, but deep feature redesign can be deferred.

## Information architecture

Replace the global server-first layout with an app-first workspace:

- Primary app rail: Message, Contacts, Calendar, Docs, Approvals, Email, Calls, Settings.
- Business sidebar: app-specific navigation and lists.
- Main content: selected conversation, contact profile, settings panel, or secondary app page.
- User/status controls: live at the bottom of the app rail and/or business sidebar depending on context.

Messaging owns Matrix hierarchy:

- DM conversations appear first.
- Group chats and Matrix spaces/channels are grouped in the Message app sidebar.
- Space/server switching should not require a global server rail.
- Existing Matrix stores and route parameters remain valid where possible during migration.

## Visual system

Update global Tailwind tokens in `src/app/main.css`:

- Primary blue: Feishu-like blue around `#3370ff`, expressed as OKLCH tokens.
- Neutral surfaces: white, cloud gray, soft blue-gray, and clear border layers.
- Dark mode: deep blue-black surfaces with lifted cards and restrained blue accents.
- Radius: slightly larger than the current monochrome theme; default controls should feel modern and polished.
- Shadows: subtle layered shadows for floating cards, popovers, and selected panels.
- Motion: quick, restrained transitions for app switching, selected rows, hover states, and panel reveals.

Typography should remain system-native for desktop app fidelity and CJK rendering quality. Avoid importing external fonts unless the project already has a loading strategy.

## Component strategy

Create or adapt shared workspace components instead of styling every page independently:

- Workspace layout shell.
- App rail item.
- Workspace sidebar section.
- Workspace list item.
- Workspace page frame for secondary apps.

Existing UI primitives such as Button, Input, Dialog, Tabs, Badge, Avatar, ScrollArea, and Tooltip should be re-themed through tokens and variant classes where practical.

## Migration plan at design level

1. Introduce the workspace shell and navigation model.
2. Move the current route children under the new shell.
3. Rework messaging layout so the Message app owns DM, group, and server/channel navigation.
4. Adapt Contacts and Settings into the workspace shell.
5. Apply secondary app frames to Calendar, Docs, Approvals, Email, and Calls.
6. Remove or de-emphasize the old server rail after messaging has equivalent navigation.

## Data and state

Use existing Pinia stores and Matrix APIs:

- `useServerStore` remains the source of server/space/channel data.
- `useConversations` remains the source of DM/group conversation data.
- `useChatStore` remains the source of selected room and side panel state.
- Routing can be reorganized, but existing room/channel identifiers must remain encoded safely in URLs.

## Error handling

No new broad fallback behavior is needed. Existing Matrix restore, sync, navigation, and toast behavior should remain intact. New layout components should not swallow errors; they should delegate to existing route components and `ErrorBoundary`.

## Accessibility

- App rail buttons need visible focus states, labels/titles, and selected state semantics.
- Sidebar list items need clear hover, selected, unread, and mention states.
- Light and dark contrast must remain readable for text, icons, borders, and badges.
- Reduced-motion users should not depend on animation to understand state.

## Testing and verification

Minimum verification before completion:

- Run type checking.
- Run linting or relevant static checks if available.
- Start the Tauri desktop client.
- Visually inspect the core routes in the desktop client or browser fallback:
  - Message app with no selected room.
  - Message app with a DM/channel selected if test data is available.
  - Contacts.
  - Settings.
  - Secondary app frame pages.
- Check both light and dark modes.

## Non-goals

- Reimplementing Matrix business logic.
- Rebuilding every secondary app's internal feature set.
- Introducing a new design dependency or external font pipeline.
- Creating feature flags or backwards-compatibility shims for the old shell.
