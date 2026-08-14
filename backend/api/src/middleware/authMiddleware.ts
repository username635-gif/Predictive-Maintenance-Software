import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: 'technician' | 'manager' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Set it in your .env before starting the server.');
  }
  return secret;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthedUser;
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...allowedRoles: AuthedUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: `Requires one of: ${allowedRoles.join(', ')}` });
      return;
    }
    next();
  };
}