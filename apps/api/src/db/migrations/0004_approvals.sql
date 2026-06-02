-- Approvals: durable, tenant-agnostic approval records backing the approval center.
-- Replaces the in-memory seed store so approval state survives restarts.

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  requester TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_stage_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  handler TEXT NOT NULL DEFAULT '',
  comments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_status_created_at ON approvals (status, created_at DESC);
