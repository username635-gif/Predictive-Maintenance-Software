-- Users and authentication
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL, -- bcrypt hash, never plaintext
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('technician', 'manager', 'admin')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);