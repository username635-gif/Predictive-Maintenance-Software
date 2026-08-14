-- Adds nullable route geometry to assets (array of {lat,lng} points; null/1-point = pin, 2+ = polyline)
-- Adds missing FK integrity: predictions/work_orders.segment_id -> assets(id)
-- (sensors/alerts already have this FK via asset_id -- this closes the gap on the differently-named columns)

ALTER TABLE assets ADD COLUMN route jsonb;

ALTER TABLE predictions
  ADD CONSTRAINT predictions_segment_id_fkey
  FOREIGN KEY (segment_id) REFERENCES assets(id);

ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_segment_id_fkey
  FOREIGN KEY (segment_id) REFERENCES assets(id);
