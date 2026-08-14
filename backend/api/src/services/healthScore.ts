import { Pool } from "pg";

// Points added to an asset's risk total per open alert, by tier.
// Higher risk points = lower health score.
const TIER_WEIGHTS: Record<string, number> = { red: 40, yellow: 20, green: 5 };

// An alert that has sat open a long time or been ignored repeatedly is worse
// than a fresh alert at the same tier -- these add extra risk, capped so one
// bad alert can't single-handedly zero out the score.
const DWELL_POINTS_PER_DAY = 2;
const MAX_DWELL_POINTS = 20;
const IGNORED_POINTS_PER_COUNT = 5;
const MAX_IGNORED_POINTS = 20;

interface AlertRow {
  asset_id: string;
  tier: string;
  dwell_start_at: string | null;
  ignored_count: number;
}

export interface HealthScoreResult {
  assetId: string;
  healthScore: number; // 0-100, 100 = healthiest. This is a heuristic estimate,
                        // not a validated prediction -- it has not been checked
                        // against real failure outcomes yet.
  openAlertCount: number;
  breakdown: { tierPoints: number; dwellPoints: number; ignoredPoints: number };
}

function scoreFromAlerts(assetId: string, rows: AlertRow[]): HealthScoreResult {
  let tierPoints = 0;
  let dwellPoints = 0;
  let ignoredPoints = 0;

  for (const row of rows) {
    tierPoints += TIER_WEIGHTS[row.tier] ?? 0;

    if (row.dwell_start_at) {
      const dwellDays = (Date.now() - new Date(row.dwell_start_at).getTime()) / 86400000;
      dwellPoints += Math.min(dwellDays * DWELL_POINTS_PER_DAY, MAX_DWELL_POINTS);
    }

    ignoredPoints += Math.min((row.ignored_count ?? 0) * IGNORED_POINTS_PER_COUNT, MAX_IGNORED_POINTS);
  }

  const totalRiskPoints = tierPoints + dwellPoints + ignoredPoints;
  const healthScore = Math.max(0, Math.round(100 - totalRiskPoints));

  return {
    assetId,
    healthScore,
    openAlertCount: rows.length,
    breakdown: { tierPoints, dwellPoints: Math.round(dwellPoints), ignoredPoints },
  };
}

export async function computeHealthScore(pool: Pool, assetId: string): Promise<HealthScoreResult> {
  const { rows } = await pool.query<AlertRow>(
    `SELECT asset_id, tier, dwell_start_at, ignored_count
     FROM alerts
     WHERE asset_id = $1 AND status IN ('open', 'acknowledged', 'escalated')`,
    [assetId]
  );
  return scoreFromAlerts(assetId, rows);
}

// Bulk version -- 2 queries total regardless of asset count, not N+1.
export async function computeAllHealthScores(pool: Pool): Promise<Map<string, HealthScoreResult>> {
  const { rows: assets } = await pool.query<{ id: string }>(`SELECT id FROM assets`);
  const { rows: alerts } = await pool.query<AlertRow>(
    `SELECT asset_id, tier, dwell_start_at, ignored_count
     FROM alerts
     WHERE status IN ('open', 'acknowledged', 'escalated')`
  );

  const byAsset = new Map<string, AlertRow[]>();
  for (const alert of alerts) {
    const list = byAsset.get(alert.asset_id) ?? [];
    list.push(alert);
    byAsset.set(alert.asset_id, list);
  }

  const results = new Map<string, HealthScoreResult>();
  for (const asset of assets) {
    results.set(asset.id, scoreFromAlerts(asset.id, byAsset.get(asset.id) ?? []));
  }
  return results;
}
