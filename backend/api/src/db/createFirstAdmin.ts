/**
 * Creates the first admin user. Run once, manually, then this route/script
 * isn't needed again — all future users go through POST /api/v1/auth/users
 * with a real admin token.
 *
 * Run with: npx ts-node src\db\createFirstAdmin.ts <email> <password> <name>
 */
import bcrypt from 'bcryptjs';
import { getPgPool } from './pg';

async function main() {
  const [, , email, password, name] = process.argv;
  if (!email || !password || !name) {
    console.error('Usage: npx ts-node src\\db\\createFirstAdmin.ts <email> <password> <name>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const pool = await getPgPool();
  const passwordHash = await bcrypt.hash(password, 12);

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1,$2,$3,'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2
     RETURNING id, email, name, role`,
    [email.toLowerCase().trim(), passwordHash, name],
  );

  console.log('✅ Admin user ready:', rows[0]);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});