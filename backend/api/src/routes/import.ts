import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function parseCsv(buffer: Buffer): Record<string, string>[] {
  return parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
}

// POST /api/v1/import/sensor-readings
// Expects columns: sensor_id, timestamp, value, unit, quality_flag
router.post('/sensor-readings', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded (field name: file)' });
    return;
  }
  const pool = req.orgPool!;
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(req.file.buffer);
  } catch (e) {
    res.status(400).json({ error: 'Failed to parse CSV', detail: e instanceof Error ? e.message : String(e) });
    return;
  }
  let inserted = 0;
  const errors: { row: number; error: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.sensor_id || !r.timestamp || !r.value) {
      errors.push({ row: i + 2, error: 'Missing required field (sensor_id, timestamp, value)' });
      continue;
    }
    const value = Number(r.value);
    if (Number.isNaN(value)) {
      errors.push({ row: i + 2, error: `Non-numeric value: ${r.value}` });
      continue;
    }
    const isFlaggedBad = String(r.quality_flag ?? '').toLowerCase() === 'bad';
    try {
      await pool.query(
        `INSERT INTO sensor_readings (sensor_id, reading_at, value, is_flagged_bad, flag_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [r.sensor_id, r.timestamp, value, isFlaggedBad, isFlaggedBad ? (r.quality_flag ?? 'vendor_flagged') : null],
      );
      inserted++;
    } catch (e) {
      errors.push({ row: i + 2, error: e instanceof Error ? e.message : String(e) });
    }
  }
  res.json({ total_rows: rows.length, inserted, error_count: errors.length, errors: errors.slice(0, 50) });
});

// POST /api/v1/import/asset-specs
// Expects columns matching migration 006: asset_id (must already exist), material,
// diameter_inches, wall_thickness_inches, length_meters, operational_status,
// commodity_type, max_operating_pressure_psi, joint_type, lining_type,
// criticality_rating, installation_cost, install_year, expected_lifetime_years,
// last_inspection_date, last_inspection_condition_grade,
// gps_start_lat, gps_start_long, gps_end_lat, gps_end_long
router.post('/asset-specs', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded (field name: file)' });
    return;
  }
  const pool = req.orgPool!;
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(req.file.buffer);
  } catch (e) {
    res.status(400).json({ error: 'Failed to parse CSV', detail: e instanceof Error ? e.message : String(e) });
    return;
  }
  const columns = [
    'material', 'diameter_inches', 'wall_thickness_inches', 'length_meters',
    'operational_status', 'commodity_type', 'max_operating_pressure_psi',
    'joint_type', 'lining_type', 'criticality_rating', 'installation_cost',
    'install_year', 'expected_lifetime_years', 'last_inspection_date',
    'last_inspection_condition_grade', 'gps_start_lat', 'gps_start_long',
    'gps_end_lat', 'gps_end_long',
  ];
  let updated = 0;
  const errors: { row: number; error: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.asset_id) {
      errors.push({ row: i + 2, error: 'Missing required field: asset_id' });
      continue;
    }
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];
    for (const col of columns) {
      const raw = r[col];
      if (raw === undefined || raw === '') continue;
      values.push(raw);
      setClauses.push(col + " = $" + values.length);
    }
    if (setClauses.length === 0) {
      errors.push({ row: i + 2, error: 'No recognized spec columns present' });
      continue;
    }
    values.push(r.asset_id);
    try {
      const result = await pool.query(
        `UPDATE assets SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${values.length}`,
        values,
      );
      if (result.rowCount === 0) {
        errors.push({ row: i + 2, error: `asset_id not found: ${r.asset_id}` });
      } else {
        updated++;
      }
    } catch (e) {
      errors.push({ row: i + 2, error: e instanceof Error ? e.message : String(e) });
    }
  }
  res.json({ total_rows: rows.length, updated, error_count: errors.length, errors: errors.slice(0, 50) });
});

// POST /api/v1/import/incidents
// Expects columns: asset_id, event_timestamp, event_type, description
router.post('/incidents', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded (field name: file)' });
    return;
  }
  const pool = req.orgPool!;
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(req.file.buffer);
  } catch (e) {
    res.status(400).json({ error: 'Failed to parse CSV', detail: e instanceof Error ? e.message : String(e) });
    return;
  }
  let inserted = 0;
  const errors: { row: number; error: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.asset_id || !r.event_timestamp || !r.event_type) {
      errors.push({ row: i + 2, error: 'Missing required field (asset_id, event_timestamp, event_type)' });
      continue;
    }
    try {
      await pool.query(
        `INSERT INTO asset_incidents (asset_id, event_timestamp, event_type, description, source)
         VALUES ($1, $2, $3, $4, 'vendor_import')`,
        [r.asset_id, r.event_timestamp, r.event_type, r.description ?? null],
      );
      inserted++;
    } catch (e) {
      errors.push({ row: i + 2, error: e instanceof Error ? e.message : String(e) });
    }
  }
  res.json({ total_rows: rows.length, inserted, error_count: errors.length, errors: errors.slice(0, 50) });
});

export default router;
