-- User provisioning (Item 7): invite-first signup with per-org role
-- assignment, email verification, and live status checks.
--
-- role and password_hash become nullable: an invited user exists as a row
-- before they've set a password (invited) and possibly before an admin has
-- assigned them a role (pending). status tracks where they are in that
-- lifecycle independently of role.

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'unverified', 'pending', 'active', 'deactivated'));

-- invited: admin created the row, person hasn't signed up yet (no password_hash)
-- unverified: person set a password, hasn't clicked the verification link yet
-- pending: verified, but no role assigned yet -- lands on waiting screen
-- active: verified and has a role -- normal login
-- deactivated: removed from a role, distinct from "pending" (never gets
-- treated as "waiting to be reassigned" automatically)

ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token)
    WHERE verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
