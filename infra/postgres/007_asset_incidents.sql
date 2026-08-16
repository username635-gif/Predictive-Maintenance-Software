-- 007_asset_incidents.sql
-- Historical failure/incident log for validating alert timing against
-- real vendor-reported events. One row per real-world incident.

CREATE TABLE IF NOT EXISTS asset_incidents (
  id bigserial PRIMARY KEY,
  asset_id text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  event_timestamp timestamptz NOT NULL,
  event_type text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'vendor_import',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_asset_time ON asset_incidents(asset_id, event_timestamp DESC);
