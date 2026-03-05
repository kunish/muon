# Muon

## What This Is

Muon is a desktop-first collaboration client built on Matrix, focused on real-time team communication across chat, calls, and workspace settings. It targets teams that need Discord-like interaction quality with enterprise-friendly control and extensibility. The current product already covers daily communication workflows, and this milestone focuses on improving message handling efficiency and knowledge retention.

## Core Value

Users can always find, process, and continue the most important conversations quickly in one place.

## Current Milestone: v1.0 Chat Efficiency and Knowledge Capture

**Goal:** Turn high-volume chat streams into clear, actionable workflow with less context-switching.

**Target features:**
- Unified inbox for mentions, unreplied, and deferred items
- Message-to-task workflow with jump-back to source context
- Cross-conversation retrieval, offline digest, and decision capture

## Requirements

### Validated

- ✓ Matrix-based login/session, room sync, and message timeline are available in production code.
- ✓ Real-time chat UX includes rich text input, mentions, emoji/sticker/media actions, and message utilities.
- ✓ Voice/video calling feature set and related UI modules are already integrated.
- ✓ Settings foundation exists (profile, appearance, notifications, security, blocked users, shortcuts).

### Active

- [ ] User can triage a unified inbox of high-priority conversation items.
- [ ] User can defer messages and return to them in a personal pending queue.
- [ ] User can convert a message into a tracked task and navigate back to original message context.
- [ ] User can quickly retrieve relevant messages across conversations.
- [ ] User receives concise offline catch-up summary after returning.
- [ ] User can capture discussion outcomes as decision cards for later reuse.

### Out of Scope

- Game-like engagement systems (badges/challenges/leaderboards) — not aligned with this milestone's efficiency-first goal.
- Full workflow engine (complex approvals/dependency graphs) — too heavy for milestone v1.0 scope.
- External PM suite bi-directional sync — defer until message-to-task model is validated.

## Context

- Frontend stack is Vue 3 + TypeScript + Pinia + Vite, with desktop shell via Tauri.
- Message and presence backbone uses Matrix client modules under `src/matrix`.
- Existing feature footprint already includes chat, call, settings, approvals, and email-related pages.
- Current opportunity is not raw feature breadth, but reducing attention fragmentation in high-volume channels.

## Constraints

- **Tech stack**: Must remain compatible with Vue 3/Tauri/Matrix architecture — avoid introducing incompatible platform assumptions.
- **Compatibility**: Do not break existing chat/call flows — milestone features must layer on top of validated core workflows.
- **Performance**: New indexing/summarization must not degrade typing, timeline rendering, or navigation responsiveness.
- **Scope**: v1.0 focuses on capture + triage + retrieval fundamentals before advanced automation.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Prioritize efficiency + capture over gamification | Target metric is daily active usage/time via clearer workflow, not novelty mechanics | — Pending |
| Deliver in staged layers (inbox/task/retrieval first) | Reduces integration risk on existing brownfield codebase | — Pending |
| Keep Matrix event model as source of truth | Prevents protocol drift and preserves existing synchronization behavior | — Pending |

---
*Last updated: 2026-03-05 after milestone v1.0 initialization*
