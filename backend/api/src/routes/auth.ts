import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { lookupOrgForEmail, getOrgPool, getPgPoolOrThrow } from "../db/pg";
import { requireAuth, requireRole, AuthedUser } from "../middleware/authMiddleware";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set.");
  return secret;
}

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();

  // Step 1: which org does this email belong to? Control-plane lookup only
  // -- no password data lives here, just routing information.
  const orgLookup = await lookupOrgForEmail(normalizedEmail);
  if (!orgLookup) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Step 2: connect to THAT org's own database and check the real user record.
  const orgPool = await getOrgPool(orgLookup.organizationId);
  const { rows } = await orgPool.query(
    `SELECT id, email, password_hash, name, role FROM users WHERE email = $1`,
    [normalizedEmail],
  );
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  await orgPool.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

  const tokenPayload: AuthedUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: orgLookup.organizationId,
  };
  const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: "7d" });
  res.json({ token, user: tokenPayload });
});

router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

router.post("/users", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string") {
    res.status(400).json({ error: "email, password, and name are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }
  const validRoles = ["technician", "manager", "admin"];
  const assignedRole = validRoles.includes(role) ? role : "technician";
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 12);

  // New user goes into the ADMIN'S OWN org database (req.orgPool), not the
  // control-plane DB. Previously this inserted into the shared DB directly,
  // which only worked by coincidence because the bootstrap org's database
  // and the control-plane database happen to be the same physical DB.
  const orgPool = req.orgPool!;
  try {
    const { rows } = await orgPool.query(
      `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4)
       RETURNING id, email, name, role, created_at`,
      [normalizedEmail, passwordHash, name, assignedRole],
    );
    // Also register this email in the control-plane org_users lookup, using
    // the ADMIN's own organizationId from their token -- so this new user
    // logs into the same org, not a different one.
    const controlPool = getPgPoolOrThrow();
    await controlPool.query(
      `INSERT INTO org_users (email, organization_id) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [normalizedEmail, req.user!.organizationId],
    );
    res.status(201).json({ user: rows[0] });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "A user with that email already exists" });
      return;
    }
    throw err;
  }
});

export default router;
