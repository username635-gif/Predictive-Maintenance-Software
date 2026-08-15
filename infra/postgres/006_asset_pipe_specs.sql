-- 006_asset_pipe_specs.sql
-- Adds physical pipe specification columns to assets.
-- All columns nullable: existing rows have none of this data yet.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS diameter_inches numeric(8,3),
  ADD COLUMN IF NOT EXISTS wall_thickness_inches numeric(8,4),
  ADD COLUMN IF NOT EXISTS length_meters numeric(12,2),
  ADD COLUMN IF NOT EXISTS operational_status text,
  ADD COLUMN IF NOT EXISTS commodity_type text,
  ADD COLUMN IF NOT EXISTS max_operating_pressure_psi numeric(10,2),
  ADD COLUMN IF NOT EXISTS joint_type text,
  ADD COLUMN IF NOT EXISTS lining_type text,
  ADD COLUMN IF NOT EXISTS criticality_rating text,
  ADD COLUMN IF NOT EXISTS installation_cost numeric(14,2),
  ADD COLUMN IF NOT EXISTS install_year integer,
  ADD COLUMN IF NOT EXISTS expected_lifetime_years integer,
  ADD COLUMN IF NOT EXISTS last_inspection_date date,
  ADD COLUMN IF NOT EXISTS last_inspection_condition_grade text,
  ADD COLUMN IF NOT EXISTS gps_start_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS gps_start_long numeric(9,6),
  ADD COLUMN IF NOT EXISTS gps_end_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS gps_end_long numeric(9,6);
