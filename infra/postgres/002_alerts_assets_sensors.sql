-- ReliabilityOS: assets, sensors, alerts, sensor health
-- Adds the tables the current schema is missing to support:
--   Problem 1 (trigger summary + baseline), Problem 2 (alert state machine),
--   Problem 3 (ML trust gated on model_feedback, not a calendar),
--   Problem 4 (ROI/cost filtering), Problem 6 (sensor data quality)

-- ── Assets ──────────────────────────────────────────────
-- segment_id was a bare TEXT everywhere; this gives it a real record.
CREATE TABLE IF NOT EXISTS assets (
    id                  TEXT PRIMARY KEY,          -- matches existing segment_id values
    name                TEXT NOT NULL,
    platform            TEXT NOT NULL,              -- e.g. "Platform A"
    line                TEXT,                       -- e.g. "Export Line 1"
    zone                TEXT,                       -- e.g. "Valve #7"
    latitude            NUMERIC(9,6),                -- site-level anchor only, NOT per-valve
    longitude           NUMERIC(9,6),
    replacement_cost    NUMERIC(14,2),
    downtime_cost_per_hour NUMERIC(14,2),
    priority            TEXT NOT NULL DEFAULT 'unset' CHECK (priority IN ('low','medium','high','critical','unset')),
    is_low_priority     BOOLEAN NOT NULL DEFAULT false,  -- manual ignore-list flag, Problem 4
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_platform ON assets(platform);
CREATE INDEX IF NOT EXISTS idx_assets_priority ON assets(priority);

-- ── Sensors ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sensors (
    id                  TEXT PRIMARY KEY,
    asset_id            TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    sensor_type         TEXT NOT NULL,               -- 'pressure', 'temperature', etc.
    unit                TEXT NOT NULL,                -- 'PSI', 'F', etc.
    baseline_value      NUMERIC(12,4),                -- rolling 7-day average, updated by a job
    baseline_updated_at TIMESTAMPTZ,
    hard_min            NUMERIC(12,4),                -- rule-based threshold, Problem 3 Day-1 rules
    hard_max            NUMERIC(12,4),
    manual_override_min NUMERIC(12,4),                -- Problem 3: manager-set custom threshold
    manual_override_max NUMERIC(12,4),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensors_asset ON sensors(asset_id);

-- Raw sensor readings — needed to compute baselines and detect stuck/flatlined sensors
CREATE TABLE IF NOT EXISTS sensor_readings (
    id                  BIGSERIAL PRIMARY KEY,
    sensor_id           TEXT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    reading_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    value                NUMERIC(12,4) NOT NULL,
    is_flagged_bad       BOOLEAN NOT NULL DEFAULT false,   -- Problem 6: sensor-health check result
    flag_reason          TEXT                              -- 'flatline', 'rate_of_change', 'cross_sensor_mismatch'
);

CREATE INDEX IF NOT EXISTS idx_readings_sensor_time ON sensor_readings(sensor_id, reading_at DESC);

-- ── Alerts (mutable state machine — separate from predictions, which stays an immutable log) ──
CREATE TABLE IF NOT EXISTS alerts (
    id                  TEXT PRIMARY KEY DEFAULT ('ALT-' || to_char(now(), 'YYYY') || '-' || floor(random() * 90000 + 10000)::text),
    asset_id            TEXT NOT NULL REFERENCES assets(id),
    prediction_id       TEXT REFERENCES predictions(id),   -- null if rule-based, not ML-based
    root_cause_signature TEXT NOT NULL,                     -- dedupe key: same signature = same open alert, Problem 2
    source               TEXT NOT NULL CHECK (source IN ('rule','ml')),  -- Problem 1: never fake a confidence on a rule alert
    tier                 TEXT NOT NULL CHECK (tier IN ('red','yellow','green')),
    trigger_summary       TEXT NOT NULL,                     -- Problem 1: concatenated sensor evidence
    recommended_action    TEXT NOT NULL,                     -- Problem 1 / "Dave" problem: plain-English action
    confidence            NUMERIC(5,4),                       -- ONLY populated when source = 'ml' and model_feedback has enough validated samples
    status                 TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','escalated','resolved')),
    dwell_start_at         TIMESTAMPTZ,                        -- Problem 2: metric must hold inside baseline this long before auto-close
    ignored_count           INTEGER NOT NULL DEFAULT 0,         -- Problem 2: escalate, never mute, after repeat ignores
    escalated_to             TEXT,                                -- Problem 2: supervisor contact once ignored_count threshold hit
    cost_avoided_estimate     NUMERIC(14,2),                       -- Problem 4: shown on alert, derived from assets.downtime_cost_per_hour
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_asset ON alerts(asset_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_signature_open ON alerts(root_cause_signature) WHERE status IN ('open','acknowledged','escalated');

-- ── Alert delivery log (Problem 5: SMS/email/CMMS/webhook fan-out, so nothing relies on dashboard opens) ──
CREATE TABLE IF NOT EXISTS alert_deliveries (
    id                  BIGSERIAL PRIMARY KEY,
    alert_id             TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    channel               TEXT NOT NULL CHECK (channel IN ('sms','email','csv_export','webhook','cmms')),
    delivered_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at          TIMESTAMPTZ,                        -- Problem 2: "Reply ACK" receipt confirmation
    delivery_target           TEXT                                -- phone/email/webhook URL, no secrets stored here
);

CREATE INDEX IF NOT EXISTS idx_deliveries_alert ON alert_deliveries(alert_id);