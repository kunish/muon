# Requirements: Muon Milestone v1.0

**Defined:** 2026-03-05
**Core Value:** Users can always find, process, and continue the most important conversations quickly in one place.

## v1 Requirements

### Inbox

- [x] **INBX-01**: User can view one unified inbox that aggregates mentions, unread priority items, and reply-needed items.
- [x] **INBX-02**: User can filter inbox items by type and mark selected items as processed in batch.
- [x] **INBX-03**: User can jump from an inbox item to the source message with surrounding context loaded.
- [x] **INBX-04**: User can defer an inbox item with a reminder time and view it in a personal defer queue.
- [x] **INBX-05**: User can mark deferred items as completed or archived from the defer queue.

### Task Workflow

- [x] **TASK-01**: User can create a task from any message with assignee, due date, and status fields.
- [x] **TASK-02**: User can open a created task and navigate back to the exact source message.
- [x] **TASK-03**: User can move tasks across todo, doing, and done states in a task panel.

### Retrieval and Digest

- [x] **RETR-01**: User can search messages across conversations by keyword and receive ranked results.
- [x] **RETR-02**: User only sees retrieval results from conversations they are currently authorized to access.
- [x] **DIGE-01**: User can view an offline catch-up digest for activity during their away window.
- [x] **DIGE-02**: User can open source citations from digest entries to verify each summary claim.
- [x] **DIGE-03**: User can sort digest focus by personal relevance (my responsibility, my follows, my mentions).

### Decision Capture

- [x] **DECI-01**: User can create a decision card with conclusion, context, owner, status, and linked messages.
- [x] **DECI-02**: User can accept or reject AI-suggested action items and blockers extracted from summaries.
- [x] **DECI-03**: User can ask a cross-conversation question and receive an answer with traceable citations.

### Reliability and Consistency

- [x] **RELI-01**: User sees consistent inbox/task state after reconnect or sync gap recovery without silent item loss.
- [ ] **RELI-02**: User can complete inbox and search workflows without noticeable typing or navigation lag.

## v2 Requirements

### Integrations and Advanced Automation

- **INTG-01**: User can sync tasks bi-directionally with external PM tools (Jira/Asana/Linear).
- **AUTO-01**: User can enable automatic decision publication without manual confirmation.
- **RETR-03**: User can use semantic/vector retrieval for long-tail cross-conversation discovery.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Gamified engagement system (badges/challenges/leaderboards) | Not aligned with this milestone's efficiency-first core value |
| Full workflow engine with complex dependency automation | Too much process overhead before message-to-task model is validated |
| Fully autonomous task generation from all messages | High false-positive risk and trust erosion in early milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INBX-01 | Phase 1 | Complete |
| INBX-02 | Phase 1 | Complete |
| INBX-03 | Phase 1 | Complete |
| INBX-04 | Phase 2 | Complete |
| INBX-05 | Phase 2 | Complete |
| TASK-01 | Phase 2 | Complete |
| TASK-02 | Phase 2 | Complete |
| TASK-03 | Phase 2 | Complete |
| RETR-01 | Phase 3 | Complete |
| RETR-02 | Phase 3 | Complete |
| DIGE-01 | Phase 4 | Complete |
| DIGE-02 | Phase 4 | Complete |
| DIGE-03 | Phase 4 | Complete |
| DECI-01 | Phase 4 | Complete |
| DECI-02 | Phase 4 | Complete |
| DECI-03 | Phase 4 | Complete |
| RELI-01 | Phase 5 | Complete |
| RELI-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
