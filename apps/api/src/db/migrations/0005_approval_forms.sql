-- Approval templates & structured forms: carry the source template id and the
-- submitted form field values alongside each approval record.

ALTER TABLE approvals ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS form_data JSONB;
