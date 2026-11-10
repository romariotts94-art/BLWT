-- Declining an unpaid RBS order is distinct from reversing an authorization.
ALTER TABLE vtb_sandbox_attempts DROP CONSTRAINT IF EXISTS vtb_sandbox_attempts_pending_action_check;
ALTER TABLE vtb_sandbox_attempts ADD CONSTRAINT vtb_sandbox_attempts_pending_action_check
 CHECK (pending_action IN ('capture','reverse','refund','decline'));
