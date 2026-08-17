import { Router, Request, Response, NextFunction } from "express";
import { getPgPoolOrThrow } from "../db/pg";
import { provisionOrganization } from "../services/orgProvisioning";

const router = Router();

// Platform-level gate, deliberately NOT requireAuth/requireRole -- this
// endpoint creates databases and must be reachable before any org or user
// exists. Only whoever holds PLATFORM_ADMIN_KEY (you) can call it.
function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-platform-admin-key");
  const expected = process.env.PLATFORM_ADMIN_KEY;
  if (!expected) {
    res.status(500).json({ error: "PLATFORM_ADMIN_KEY is not configured on the server" });
    return;
  }
  if (key !== expected) {
    res.status(401).json({ error: "Invalid or missing platform admin key" });
    return;
  }
  next();
}

router.post("/", requirePlatformAdmin, async (req: Request, res: Response) => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const pool = getPgPoolOrThrow();
  try {
    const result = await provisionOrganization(pool, name.trim());
    res.status(201).json({ organization: result });
  } catch (err: any) {
    console.error("[orgs] provisioning failed:", err);
    res.status(500).json({ error: "Failed to provision organization", detail: err.message });
  }
});

export default router;

