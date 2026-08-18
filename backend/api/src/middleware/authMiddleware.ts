import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { getOrgPool } from "../db/pg";

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: "technician" | "manager" | "admin" | null;
  organizationId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
      orgPool?: Pool; // set by requireAuth -- the requesting user's org database
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Set it in your .env before starting the server.");
  }
  return secret;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const token = header.slice("Bearer ".length);
  let payload: AuthedUser;
  try {
    payload = jwt.verify(token, getJwtSecret()) as AuthedUser;
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (!payload.organizationId) {
    res.status(401).json({ error: "Token missing organization context -- please log in again" });
    return;
  }
  try {
    req.orgPool = await getOrgPool(payload.organizationId);
  } catch (err) {
    res.status(500).json({ error: "Could not resolve organization database" });
    return;
  }
  req.user = payload;
  next();
}

export function requireRole(...allowedRoles: AuthedUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: `Requires one of: ${allowedRoles.join(", ")}` });
      return;
    }
    next();
  };
}
