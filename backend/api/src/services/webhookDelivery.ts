import { Pool } from 'pg';

// Generic webhook sender — POSTs the full alert (joined with asset info) as
// JSON to whatever WEBHOOK_URL is configured. No assumption about the
// receiving service's expected format; if you later target something with
// a specific payload shape (e.g. Slack's {"text": "..."}), that's a small
// adapter here, not a rebuild.
export async function sendWebhookDelivery(pool: Pool, alertId: string): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[webhookDelivery] WEBHOOK_URL not configured — skipping delivery for alert ${alertId}`);
    return;
  }

  const { rows } = await pool.query(
    `SELECT a.*, ast.name AS asset_name, ast.platform, ast.line, ast.zone
     FROM alerts a JOIN assets ast ON ast.id = a.asset_id WHERE a.id = $1`,
    [alertId],
  );
  const alert = rows[0];
  if (!alert) {
    console.warn(`[webhookDelivery] alert ${alertId} not found — skipping`);
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'alert.created', alert }),
    });
    if (!res.ok) {
      console.error(`[webhookDelivery] webhook POST failed: ${res.status} ${res.statusText}`);
      return; // don't record a delivery row for a failed send
    }
    await pool.query(
      `INSERT INTO alert_deliveries (alert_id, channel, delivery_target) VALUES ($1, 'webhook', $2)`,
      [alertId, webhookUrl],
    );
    console.log(`[webhookDelivery] sent alert ${alertId} to webhook`);
  } catch (err) {
    console.error(`[webhookDelivery] failed to send webhook for alert ${alertId}:`, err);
  }
}
