-- Control-plane registry mapping a gateway API key to the organization (and
-- that organization's own gateways.id) it belongs to. Lives in the shared
-- reliabilityos control-plane database (see 008_organizations.sql) --
-- NEVER in a per-org database, since a gateway has no JWT/org context yet
-- when it authenticates; this table is precisely what lets us resolve one.
--
-- gateway_id is NOT a foreign key: gateways.id lives in a separate per-org
-- database (cross-database FKs aren't possible in Postgres). Referential
-- integrity between this row and the real gateway row is enforced in
-- application code (gateways.ts), not the schema.
CREATE TABLE IF NOT EXISTS gateway_registry (
    key_hash        text PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    gateway_id      text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_used_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gateway_registry_org ON gateway_registry (organization_id);
