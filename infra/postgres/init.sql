-- ReliabilityOS PostgreSQL initialization script
-- Run automatically on first container start

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Work orders
CREATE TABLE IF NOT EXISTS work_orders (
    id              TEXT PRIMARY KEY DEFAULT ('WO-' || to_char(now(), 'YYYY') || '-' || floor(random() * 9000 + 1000)::text),
    title           TEXT NOT NULL,
    segment_id      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','in_progress','completed','cancelled')),
    priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
    description     TEXT,
    repair_procedure TEXT,
    estimated_downtime_hours NUMERIC(6,2) DEFAULT 4,
    assigned_to     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date        DATE,
    completed_at    TIMESTAMPTZ,
    prediction_id   TEXT,
    technician_notes TEXT,
    actual_root_cause TEXT
);

-- AI Predictions audit log
CREATE TABLE IF NOT EXISTS predictions (
    id              TEXT PRIMARY KEY,
    segment_id      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    anomaly_score   NUMERIC(5,4),
    rul_days        INTEGER,
    rul_lower       INTEGER,
    rul_upper       INTEGER,
    failure_mode    TEXT,
    severity        TEXT,
    model_version   TEXT,
    raw_output      JSONB
);

-- Technician feedback for model improvement
CREATE TABLE IF NOT EXISTS model_feedback (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_id       TEXT REFERENCES predictions(id),
    was_correct         BOOLEAN NOT NULL,
    actual_root_cause   TEXT,
    corrected_rul       INTEGER,
    technician_notes    TEXT,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_by        TEXT
);

-- Audit log
DO $$
BEGIN
    -- Create enum type only if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action_type') THEN
        CREATE TYPE audit_action_type AS ENUM (
            'alert_ack',
            'workorder_create',
            'workorder_update',
            'escalate',
            'sim_toggle'
        );
    END IF;
END $$;

-- Create audit_log with required schema. NOTE: timestamp and actor_id are NOT NULL.
CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id        TEXT NOT NULL,
    actor_name      TEXT,
    action_type     audit_action_type NOT NULL,
    entity_id       TEXT NOT NULL,
    entity_type     TEXT,
    previous_state  JSONB,
    new_state       JSONB NOT NULL,
    ip_address      INET
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wo_segment ON work_orders(segment_id);
CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_pred_segment ON predictions(segment_id);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON audit_log(actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(timestamp DESC);

