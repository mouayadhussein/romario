-- Migration 004: Structured opening hours for branches

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Damascus',
  ADD COLUMN IF NOT EXISTS ordering_mode TEXT NOT NULL DEFAULT 'auto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branches_ordering_mode_check'
  ) THEN
    ALTER TABLE branches
      ADD CONSTRAINT branches_ordering_mode_check
      CHECK (ordering_mode IN ('auto', 'force_open', 'force_closed'));
  END IF;
END $$;

COMMENT ON COLUMN branches.opening_hours IS
  'Weekly schedule: {"mon":[{"open":"09:00","close":"23:50"}],...}. Empty array or missing day = closed all day.';
COMMENT ON COLUMN branches.timezone IS
  'IANA timezone used to evaluate opening hours (e.g. Asia/Damascus).';
COMMENT ON COLUMN branches.ordering_mode IS
  'auto = follow schedule; force_open = always accept orders; force_closed = always reject orders.';
COMMENT ON COLUMN branches.working_hours IS
  'Legacy free-text hours for display only; ignored for status when opening_hours has periods.';
