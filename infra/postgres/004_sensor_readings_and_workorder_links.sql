-- Sensor reading history: previously only held in memory (server.ts's
-- recentValues Map), reset on every restart. This is what makes trend
-- projection possible — it can't project from data that doesn't persist.
CREATE TABLE IF NOT EXISTS sensor_readings (
    id          BIGSERIAL PRIMARY KEY,
    sensor_id   TEXT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    value       NUMERIC NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time ON sensor_readings(sensor_id, recorded_at DESC);

-- Links a work order back to the alert that generated it, so priority can
-- be derived from real alert data instead of a manually typed guess.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS alert_id TEXT REFERENCES alerts(id);
CREATE INDEX IF NOT EXISTS idx_workorders_alert ON work_orders(alert_id);
