import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import jwt from 'jsonwebtoken';
import authRouter from './routes/auth';
import sensorsRouter from './routes/sensors';
import sensorsBulkRouter from './routes/sensorsBulk';
import predictionsRouter from './routes/predictions';
import workordersRouter from './routes/workorders';
import roiRouter from './routes/roi';
import alertsRouter from './routes/alerts';
import pigRouter from './routes/pig';
import auditRouter from './routes/audit';
import gatewaysRouter from './routes/gateways';
import assetsRouter from './routes/assets';
import importRouter from './routes/import';
import orgsRouter from './routes/orgs';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth, requireRole } from './middleware/authMiddleware';
import { requireGatewayKey } from './middleware/gatewayAuth';
import { getPgPool } from './db/pg';
import { startMqttConsumer } from './services/mqttConsumer';

dotenv.config();

// Await Postgres connection before starting HTTP server (fix startup race).
getPgPool().catch((e) => {
  console.error('[Postgres] Failed to connect during startup:', e);
  process.exit(1);
});

const PORT = process.env.PORT || 8080;
const app = express();
const httpServer = createServer(app);

// ───────────────────────────── Security Middleware ─────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ───────────────────────────── Socket.IO ─────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Reject any socket connection that doesn't present a valid JWT in the
// handshake. This is the WebSocket equivalent of requireAuth — closes the
// gap where the live alert/asset/sensor stream and the workorder:create /
// alert:acknowledge writes were reachable with no auth at all.
//
// Frontend must connect with: io(url, { auth: { token: '<jwt>' } })
// If your current frontend doesn't send this, connections will now fail
// until it's updated — that's expected, not a new bug.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) {
    next(new Error('Unauthorized: missing token'));
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next(new Error('Server misconfigured: JWT_SECRET not set'));
    return;
  }
  try {
    const payload = jwt.verify(token, secret) as {
      id: string;
      email: string;
      name: string;
      role: 'technician' | 'manager' | 'admin';
    };
    socket.data.user = payload;
    next();
  } catch (err) {
    next(new Error('Unauthorized: invalid or expired token'));
  }
});

// Real-time active-alerts emission every 5 seconds. Replaces the old mock's
// synthetic sensor-noise loop — this queries real Postgres for whatever
// alerts are currently open/acknowledged/escalated.
setInterval(async () => {
  try {
    const pool = await getPgPool();
    const { rows: activeAlerts } = await pool.query(
      `SELECT a.*, ast.name AS asset_name FROM alerts a
       JOIN assets ast ON ast.id = a.asset_id
       WHERE a.status IN ('open','acknowledged','escalated')
       ORDER BY a.created_at DESC`,
    );
    io.emit('alerts:active', activeAlerts);
  } catch (err) {
    console.error('[live-emit] failed to query active alerts:', err);
  }
}, 5000);

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id} (${socket.data.user?.email ?? 'unknown'})`);

  // Registered synchronously, before any await below runs. Previously these
  // were registered AFTER the state:init query awaited, which meant any
  // workorder:create / alert:acknowledge sent immediately on connect was
  // silently dropped -- Socket.IO does not buffer events for handlers that
  // don't exist yet. Verified live during the Socket.IO audit: an emit on
  // connect produced no response and no log line at all; the identical
  // emit 3s later succeeded. Moving these here closes that gap for real,
  // instead of relying on the frontend's client-side write queue.
  socket.on('workorder:create', async (payload: Record<string, unknown>) => {
    try {
      const pool = await getPgPool();
      const { rows } = await pool.query(
        `INSERT INTO work_orders (title, segment_id, description, repair_procedure, estimated_downtime_hours, assigned_to, due_date, prediction_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          payload.title ?? 'New Work Order',
          payload.segment_id ?? payload.asset_id,
          payload.description ?? null,
          payload.repair_procedure ?? null,
          payload.estimated_downtime_hours ?? 4,
          payload.assigned_to ?? 'Unassigned',
          payload.due_date ?? null,
          payload.prediction_id ?? null,
        ],
      );
      io.emit('workorder:created', rows[0]);
      console.log(`📋 Work order created: ${rows[0].id}`);
    } catch (err) {
      console.error('[workorder:create] failed:', err);
      socket.emit('workorder:create:error', { message: 'Failed to create work order' });
    }
  });

  socket.on('alert:acknowledge', async (alertId: string) => {
    try {
      const pool = await getPgPool();
      const { rows } = await pool.query(
        `UPDATE alerts SET status = 'acknowledged', updated_at = now()
         WHERE id = $1 AND status IN ('open','escalated') RETURNING *`,
        [alertId],
      );
      if (rows.length > 0) io.emit('alert:acknowledged', rows[0]);
    } catch (err) {
      console.error('[alert:acknowledge] failed:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });

  // state:init can safely run after the listeners above are registered --
  // it doesn't need to block them, and this ordering closes the race.
  (async () => {
    try {
      const pool = await getPgPool();
      const [assets, sensors, alerts, predictions] = await Promise.all([
        pool.query('SELECT * FROM assets'),
        pool.query('SELECT * FROM sensors'),
        pool.query(`SELECT a.*, ast.name AS asset_name FROM alerts a
                    JOIN assets ast ON ast.id = a.asset_id
                    WHERE a.status IN ('open','acknowledged','escalated')`),
        pool.query('SELECT * FROM predictions ORDER BY created_at DESC'),
      ]);
      socket.emit('state:init', {
        assets: assets.rows,
        sensors: sensors.rows,
        alerts: alerts.rows,
        predictions: predictions.rows,
      });
    } catch (err) {
      console.error('[state:init] failed:', err);
      socket.emit('state:init', { assets: [], sensors: [], alerts: [], predictions: [], error: 'Failed to load initial state' });
    }
  })();
});

// ───────────────────────────── HTTP Middleware ────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ───────────────────────────── Routes ────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Auth routes are intentionally NOT behind requireAuth — /login and /me
// need to be reachable without a token. auth.ts applies requireAuth itself
// on the routes inside it that need it (e.g. POST /users).
app.use('/api/v1/auth', authRouter);

// Platform-level org provisioning -- self-gated via requirePlatformAdmin inside orgs.ts,
// deliberately not behind requireAuth (no org/user exists yet when this is called).
app.use('/api/v1/orgs', orgsRouter);

// Field-gateway ingestion -- authenticated by a per-gateway API key
// (requireGatewayKey), NOT a user JWT. MUST be mounted before the
// requireAuth-protected '/api/v1/sensors' line below: Express matches
// app.use mounts in registration order, and a more specific path
// registered first takes the request before a broader prefix registered
// later ever sees it. If these two lines are ever reordered, gateway
// requests to /bulk would incorrectly hit requireAuth and get rejected
// for missing a JWT that a gateway will never have.
app.use('/api/v1/sensors/bulk', requireGatewayKey, sensorsBulkRouter);

// Every route below was previously mounted with ZERO auth enforcement.
// requireAuth is now applied at the mount point for all of them.
// roi.ts additionally requires admin/manager — CONFIRM this matches your
// intended access model, it's a guess based on ROI/cost data being more
// sensitive than raw sensor readings, not something you specified.
app.use('/api/v1/sensors', requireAuth, sensorsRouter);
app.use('/api/v1/predictions', requireAuth, predictionsRouter);
app.use('/api/v1/workorders', requireAuth, workordersRouter);
app.use('/api/v1/roi', requireAuth, requireRole('admin', 'manager'), roiRouter);
app.use('/api/v1/alerts', requireAuth, alertsRouter);
app.use('/api/v1/pig', requireAuth, pigRouter);
app.use('/api/v1/gateways', requireAuth, gatewaysRouter);
app.use('/api/v1/audit', requireAuth, auditRouter);
app.use('/api/v1/assets', requireAuth, assetsRouter);
app.use('/api/v1/import', requireAuth, requireRole('admin'), importRouter);

// ───────────────────────────── Error Handler ─────────────────────────────────
app.use(errorHandler);

// ───────────────────────────── Start Server ───────────────────────────────────
startMqttConsumer(`mqtt://${process.env.MQTT_HOST || 'localhost'}:${process.env.MQTT_PORT || 1883}`);

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║          ReliabilityOS API Server  v1.0.0                ║
║  Listening on port ${PORT}                                   ║
║  WebSocket: enabled (Socket.io)                          ║
║  Environment: ${process.env.NODE_ENV || 'development'}                         ║
╚══════════════════════════════════════════════════════════╝
  `);
});

export { app, io };
