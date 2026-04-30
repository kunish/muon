# Feishu UI Interaction Polish

## Goal

Polish the existing Feishu-style workspace so interactive UI details feel consistent across the full app.

## Approved approach

Use the interaction-system approach:

- Define shared workspace interaction classes for rows, active rows, menus, menu items, and empty states.
- Apply those classes to the most common interactive surfaces instead of hand-tuning each button independently.
- Keep the current information architecture and business behavior unchanged.

## Scope

This pass covers visual and interaction details only:

- Sidebar row hover width and active states.
- Context menu selection behavior and visual style.
- App rail, message sidebar, contacts sidebar, settings sidebar, email folders, and secondary-page cards.
- Empty states and passive cards where they need alignment with the same visual system.

## Required fixes

- Friends, Tasks, and Knowledge buttons in the message sidebar must use full-width hover hit areas.
- DM rows, channel rows, settings tabs, contact group rows, email folders, and app rail entries should prevent accidental text selection.
- Context menus should prevent accidental text selection while preserving normal text selection in content areas such as chat messages.
- Context menu items should use Feishu-style rounded rows, full-width hover, restrained destructive hover, and consistent icon sizing.

## Non-goals

- Reworking Matrix business logic.
- Changing route structure.
- Replacing the existing menu implementation wholesale unless a focused class update is sufficient.
- Disabling text selection globally.

## Verification

- Run full lint.
- Run full unit tests.
- Run type checking.
- Verify core routes render expected content in browser fallback:
  - `/dm`
  - `/contacts`
  - `/settings`
  - `/calendar`
  - `/docs`
  - `/approvals`
  - `/email`
  - `/calls`
- Verify dark mode class still applies.
