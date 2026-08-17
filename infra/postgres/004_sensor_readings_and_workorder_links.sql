-- Sensor reading history: previously only held in memory (server.ts's
-- recentValues Map), reset on every restart. This is what makes trend
-- projection possible ? it can't project from data that doesn't persist.
-- sensor_readings already created in 002_alerts_assets_sensors.sql (with
-- column reading_at, not recorded_at). This block was dead/broken -- its
-- CREATE TABLE silently no-op'd against the existing table, and its index
-- referenced a column that never existed. Removed rather than fixed in
-- place, since 002 already has the correct table and index.

-- Links a work order back to the alert that generated it, so priority can
-- be derived from real alert data instead of a manually typed guess.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS alert_id TEXT REFERENCES alerts(id);
CREATE INDEX IF NOT EXISTS idx_workorders_alert ON work_orders(alert_id);
