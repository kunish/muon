# Deferred Items

## 2026-03-05

- Out-of-scope test failure: `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts` executed unrelated component tests and failed in `tests/components/MessageBubble.test.ts` due to jsdom canvas (`lottie-web` `getContext()` returning null). This is unrelated to plan `01-01` and was not fixed in this execution.
- Out-of-scope test failure: `pnpm test:unit -- tests/unit/matrix/inbox.test.ts` still runs unrelated component tests and fails in `tests/components/MessageBubble.test.ts` with jsdom canvas (`lottie-web` calling `getContext()` on null). This is pre-existing and not caused by plan `01-02` changes.
