import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
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

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
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

  const orgLookup = await lookupOrgForEmail(normalizedEmail);
  if (!orgLookup) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const orgPool = await getOrgPool(orgLookup.organizationId);
  const { rows } = await orgPool.query(
    `SELECT id, email, password_hash, name, role, status FROM users WHERE email = $1`,
    [normalizedEmail],
  );
  const user = rows[0];
  if (!user || !user.password_hash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (user.status === "unverified") {
    res.status(403).json({ error: "Please verify your email before logging in", status: "unverified" });
    return;
  }
  if (user.status === "deactivated") {
    res.status(403).json({ error: "This account has been deactivated", status: "deactivated" });
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
  res.json({ token, user: tokenPayload, status: user.status });
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const orgPool = req.orgPool!;
  const { rows } = await orgPool.query(
    `SELECT id, email, name, role, status FROM users WHERE id = $1`,
    [req.user!.id],
  );
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "User no longer exists" });
    return;
  }
  const roleChanged = user.role !== req.user!.role;
  let token: string | undefined;
  if (roleChanged) {
    const tokenPayload: AuthedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: req.user!.organizationId,
    };
    token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: "7d" });
  }
  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: req.user!.organizationId },
    status: user.status,
    ...(token ? { token } : {}),
  });
});

router.post("/invites", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const { email, name, role } = req.body ?? {};
  if (typeof email !== "string" || typeof name !== "string") {
    res.status(400).json({ error: "email and name are required" });
    return;
  }
  const validRoles = ["technician", "manager", "admin"];
  if (role !== undefined && role !== null && !validRoles.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const assignedRole = role ?? null;

  const controlPool = getPgPoolOrThrow();
  try {
    await controlPool.query(
      `INSERT INTO org_users (email, organization_id) VALUES ($1, $2)`,
      [normalizedEmail, req.user!.organizationId],
    );
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "A user with that email already exists" });
      return;
    }
    throw err;
  }

  const orgPool = req.orgPool!;
  try {
    const { rows } = await orgPool.query(
      `INSERT INTO users (email, name, role, status, invited_by)
       VALUES ($1, $2, $3, 'invited', $4)
       RETURNING id, email, name, role, status, created_at`,
      [normalizedEmail, name, assignedRole, req.user!.id],
    );
    console.log(`[invite] Signup link for ${normalizedEmail}: http://localhost:3000/signup?email=${encodeURIComponent(normalizedEmail)}`);
    res.status(201).json({ user: rows[0] });
  } catch (err: any) {
    await controlPool.query(`DELETE FROM org_users WHERE email = $1`, [normalizedEmail]).catch((cleanupErr) => {
      console.error(`[invite] FAILED TO CLEAN UP orphaned org_users row for ${normalizedEmail} -- manual fix needed:`, cleanupErr);
    });
    if (err.code === "23505") {
      res.status(409).json({ error: "A user with that email already exists" });
      return;
    }
    throw err;
  }
});

router.post("/signup", signupLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();

  const orgLookup = await lookupOrgForEmail(normalizedEmail);
  if (!orgLookup) {
    res.status(404).json({ error: "No invite found for this email" });
    return;
  }
  const orgPool = await getOrgPool(orgLookup.organizationId);
  const { rows } = await orgPool.query(`SELECT id, status FROM users WHERE email = $1`, [normalizedEmail]);
  const user = rows[0];
  if (!user || user.status !== "invited") {
    res.status(409).json({ error: "This email has already completed signup, or was never invited" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await orgPool.query(
    `UPDATE users SET password_hash = $1, status = 'unverified',
       verification_token = $2, verification_token_expires_at = $3
     WHERE id = $4`,
    [passwordHash, verificationToken, expiresAt, user.id],
  );

  console.log(`[signup] Verification link for ${normalizedEmail}: http://localhost:3000/verify?email=${encodeURIComponent(normalizedEmail)}&token=${verificationToken}`);

  res.status(200).json({ message: "Account created. Check your email to verify." });
});

router.post("/verify", async (req: Request, res: Response) => {
  const { email, token } = req.body ?? {};
  if (typeof email !== "string" || typeof token !== "string") {
    res.status(400).json({ error: "email and token are required" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const orgLookup = await lookupOrgForEmail(normalizedEmail);
  if (!orgLookup) {
    res.status(400).json({ error: "Invalid or expired verification link" });
    return;
  }
  const orgPool = await getOrgPool(orgLookup.organizationId);
  const { rows } = await orgPool.query(
    `SELECT id, role, verification_token, verification_token_expires_at
     FROM users WHERE email = $1 AND status = 'unverified'`,
    [normalizedEmail],
  );
  const user = rows[0];
  if (!user || user.verification_token !== token) {
    res.status(400).json({ error: "Invalid or expired verification link" });
    return;
  }
  if (!user.verification_token_expires_at || new Date(user.verification_token_expires_at) < new Date()) {
    res.status(400).json({ error: "Invalid or expired verification link" });
    return;
  }
  const newStatus = user.role ? "active" : "pending";
  await orgPool.query(
    `UPDATE users SET status = $1, verification_token = NULL, verification_token_expires_at = NULL
     WHERE id = $2`,
    [newStatus, user.id],
  );
  res.status(200).json({ status: newStatus });
});

// Admin sets/changes a user's role. If that user was 'pending' (verified,
// no role yet), this also flips them to 'active' as a side effect -- any
// other status (invited/unverified/active/deactivated) is left as-is, so
// this can't be used to un-deactivate someone or skip verification.
router.patch("/users/:id/role", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body ?? {};
  const validRoles = ["technician", "manager", "admin"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
    return;
  }
  const orgPool = req.orgPool!;
  const { rows } = await orgPool.query(`SELECT id, status FROM users WHERE id = $1`, [id]);
  const user = rows[0];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const newStatus = user.status === "pending" ? "active" : user.status;
  const { rows: updated } = await orgPool.query(
    `UPDATE users SET role = $1, status = $2 WHERE id = $3
     RETURNING id, email, name, role, status`,
    [role, newStatus, id],
  );
  res.status(200).json({ user: updated[0] });
});

export default router;
