import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import sensorsRouter from './routes/sensors';
import predictionsRouter from './routes/predictions';
import workordersRouter from './routes/workorders';
import roiRouter from './routes/roi';
import alertsRouter from './routes/alerts';
import pigRouter from './routes/pig';
import auditRouter from './routes/audit';
import { errorHandler } from './middleware/errorHandler';
import { mockDatabase } from './data/mockDatabase';

dotenv.config();


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
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Real-time sensor data emission every 2 seconds
let tickCount = 0;
setInterval(() => {
  tickCount++;
  const updatedSensors = mockDatabase.generateLiveSensorReadings(tickCount);
  io.emit('sensor:readings', updatedSensors);

  // Occasional anomaly spike on critical segments every ~30 ticks
  if (tickCount % 30 === 0) {
    const anomalyEvent = mockDatabase.generateAnomalyEvent();
    if (anomalyEvent) {
      io.emit('anomaly:detected', anomalyEvent);
    }
  }
}, 2000);

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Send full initial state on connect
  socket.emit('state:init', {
    segments: mockDatabase.getSegments(),
    sensors: mockDatabase.getSensors(),
    predictions: mockDatabase.getPredictions(),
    alerts: mockDatabase.getAlerts(),
    edgeGateways: mockDatabase.getEdgeGateways(),
  });

  socket.on('workorder:create', (payload) => {
    const wo = mockDatabase.createWorkOrder(payload);
    io.emit('workorder:created', wo);
    console.log(`📋 Work order created: ${wo.id}`);
  });

  socket.on('alert:acknowledge', (alertId: string) => {
    mockDatabase.acknowledgeAlert(alertId);
    io.emit('alert:acknowledged', alertId);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ───────────────────────────── HTTP Middleware ────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ───────────────────────────── Routes ────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use('/api/v1/sensors', sensorsRouter);
app.use('/api/v1/predictions', predictionsRouter);
app.use('/api/v1/workorders', workordersRouter);
app.use('/api/v1/roi', roiRouter);
app.use('/api/v1/alerts', alertsRouter);
app.use('/api/v1/pig', pigRouter);
app.use('/api/v1/audit', auditRouter);


// ───────────────────────────── Error Handler ─────────────────────────────────
app.use(errorHandler);

// ───────────────────────────── Start Server ───────────────────────────────────
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
