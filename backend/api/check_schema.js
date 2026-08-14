const { Pool } = require("pg");
require("dotenv").config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const tables = ["assets", "sensors", "alerts", "predictions", "work_orders", "segments"];
  for (const t of tables) {
    const exists = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`,
      [t]
    );
    console.log(`\n--- ${t} (exists: ${exists.rows[0].exists}) ---`);
    if (!exists.rows[0].exists) continue;
    const cols = await pool.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [t]
    );
    console.table(cols.rows);
    const sample = await pool.query(`SELECT * FROM ${t} LIMIT 2`);
    console.log("sample row(s):", JSON.stringify(sample.rows, null, 2));
  }
  await pool.end();
})();
