-- Control-plane schema for multi-tenant isolation (Item 9).
-- Lives in the shared "reliabilityos" database. Each organization's actual
-- operational data (assets, alerts, sensor_readings, etc.) lives in its own
-- separate database, named db_name below. This table only exists to answer
-- one question at login time: "which database does this email belong to?"

CREATE TABLE IF NOT EXISTS organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    db_name         TEXT UNIQUE NOT NULL, -- e.g. 'reliabilityos_sasol'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Thin lookup only -- NOT the full user record. Full user rows (password
-- hash, role, name, status) live inside each organization's own database.
-- This table exists purely to route an email to the right org before we
-- know which database to even connect to.
CREATE TABLE IF NOT EXISTS org_users (
    email           TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_users_organization ON org_users(organization_id);
