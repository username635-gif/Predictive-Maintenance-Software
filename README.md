# ReliabilityOS

> **Predictive Maintenance Platform for Oil & Gas Pipelines**  
> Control-room grade · Offline-first · Explainable AI · PWA

---

## Overview

ReliabilityOS ingests live sensor data from a 500-mile pipeline corridor, runs multi-model AI inference to predict failures up to 90 days ahead, provides plain-English explanations, and generates prescriptive work orders — all while operating seamlessly offline on edge hardware.

```
┌─────────────────────────────────────────────────────────┐
│                  ReliabilityOS Stack                    │
├───────────────┬───────────────┬─────────────────────────┤
│  React PWA    │  Node.js API  │  Python FastAPI AI      │
│  (Port 5173)  │  (Port 8080)  │  (Port 8000)            │
├───────────────┴───────────────┴─────────────────────────┤
│  InfluxDB (timeseries) · PostgreSQL (relational)        │
│  Eclipse Mosquitto MQTT · SQLite (edge buffer)          │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start (Docker)

### Prerequisites
- Docker Desktop ≥ 4.25 or Docker Engine ≥ 24 + Compose plugin
- 8 GB RAM recommended (AI models + databases)

```bash
# 1. Clone and configure
git clone https://github.com/your-org/reliabilityos.git
cd reliabilityos
cp .env.example .env
# Edit .env — at minimum change all *_PASSWORD values

# 2. Start full stack
docker compose up -d

# 3. (Optional) Start data simulator
docker compose --profile simulator up -d

# 4. Open the app
open http://localhost:5173
```

### Run a failure scenario
```bash
SIMULATOR_SCENARIO=leak_active docker compose --profile simulator up -d simulator
```

Available scenarios: `corrosion_critical` · `leak_active` · `pressure_surge` · `cp_failure` · `sensor_storm`

---

## Manual Setup (Development)

### 1. Frontend

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
```

### 2. Backend API

```bash
cd backend/api
npm install
cp ../../.env.example .env
npm run dev     # http://localhost:8080
```

### 3. AI Service

```bash
cd backend/ai
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Edge Gateway (optional)

```bash
cd edge
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.yaml.example config.yaml   # edit GATEWAY_ID, CLOUD_API_URL
python gateway.py
```

### 5. Data Simulator (optional)

```bash
cd simulator
pip install -r requirements.txt
python sensor_simulator.py                        # baseline
python sensor_simulator.py --scenario leak_active  # leak demo
python sensor_simulator.py --list-scenarios        # see all
```

---

## Architecture

```
Field Sensors (OPC-UA/HART/Modbus)
       │
       ▼
Edge Gateway (Raspberry Pi 4 / Industrial PC)
  ├── Local Rules Engine  → immediate alarm relay
  ├── SQLite ring buffer  → survives cloud outage
  └── MQTT Bridge         → store-and-forward to cloud
       │
       ▼ MQTT (TLS)
Eclipse Mosquitto Broker
       │
       ├── Node.js API  ─────────────────────► React PWA (WebSocket)
       │    ├── REST endpoints
       │    ├── Socket.IO real-time
       │    └── Work order CRUD
       │
       └── Python AI Service
            ├── LSTM Autoencoder  → anomaly score
            ├── XGBoost           → RUL prediction + SHAP
            ├── Random Forest     → root-cause classification
            └── Bayesian Fusion   → leak detection
```

### Data Flow
1. Sensors publish to MQTT every 5 seconds
2. Edge gateway evaluates local alarm rules (no cloud needed)
3. Edge gateway forwards to cloud broker (or buffers if offline)
4. Node.js API stores readings in InfluxDB, triggers AI inference
5. AI service returns predictions with SHAP explanations
6. Frontend receives real-time updates via Socket.IO

### Offline Operation (3 Modes)

| Mode | Description | Capability |
|------|-------------|------------|
| **Connected** | Full cloud connectivity | Real-time AI, full sync |
| **Buffered** | Cloud offline, sensors running | Local rules, EdgeSQLite buffer up to 100K readings |
| **Islanded** | All comms offline | Local alarm panel via Modbus relay, offline PWA |

The React frontend is a Progressive Web App — map tiles, sensor history, and pending work orders are all cached in IndexedDB and served from the service worker when offline.

---

## UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ReliabilityOS  [Map|Strip]  $4.3M ROI  🔴2  ⚙ WO  📋 Reports   │  ← TopBar
├──────────────────────┬─────────────────┬─────────────────────────┤
│                      │                 │                         │
│   GIS Pipeline Map   │  Asset List     │    Detail Drawer        │
│      OR              │  (sorted by     │   ┌─────────────────┐   │
│  Longitudinal Strip  │   criticality)  │   │ SEG-021 Mi 200  │   │
│                      │  ████ SEG-021   │   │ Health:  18%    │   │
│   ●──●──█──●──●──●   │  ▓▓▓▓ SEG-036   │   │ RUL: 14 days   │   │
│   green/yellow/red   │  ░░░░ SEG-015   │   │ [EXPLAIN ▼]    │   │
│                      │  ...            │   │ [Create WO]    │   │
│      70%             │      20%        │         10%             │
└──────────────────────┴─────────────────┴─────────────────────────┘
```

---

## API Reference

All endpoints return JSON. Rate limit: 1000 req/15min.

### Sensors
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/sensors` | List all sensors (filter: `?segment_id=SEG-021&status=online`) |
| GET | `/api/v1/sensors/:id` | Single sensor + 24h history |
| GET | `/api/v1/sensors/health/summary` | Online/degraded/offline counts |

### Predictions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/predictions` | All AI predictions |
| GET | `/api/v1/predictions/segment/:segmentId` | Prediction for segment |
| POST | `/api/v1/predictions/:id/feedback` | Technician ground-truth feedback |

### Work Orders
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/workorders` | List (filter: `?status=pending&priority=critical`) |
| POST | `/api/v1/workorders` | Create work order |
| PATCH | `/api/v1/workorders/:id` | Update status/assignee |
| POST | `/api/v1/workorders/sync` | Bulk offline sync |

### Alerts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/alerts/active` | Unacknowledged alerts |
| POST | `/api/v1/alerts/:id/acknowledge` | Acknowledge alert |

### AI Service
| Method | Path | Description |
|--------|------|-------------|
| POST | `/predict/anomaly` | LSTM anomaly score |
| POST | `/predict/rul` | XGBoost RUL + SHAP |
| POST | `/predict/root-cause` | RF root-cause classification |
| POST | `/predict/leak` | Bayesian leak detection |
| POST | `/feedback` | Ground-truth feedback loop |

---

## Demo Scenarios — Validation Checklist

Run through all 8 scenarios to validate the demo:

### ✅ Scenario 1: Dashboard loads in <2 seconds
- Open http://localhost:5173
- Map renders immediately from cached data
- ROI counter animates in top bar

### ✅ Scenario 2: Critical segment story
1. Map shows red segments at Miles 200–210 and 350–360
2. Click **SEG-021** (Mile 200)
3. Detail drawer shows: Health 18%, RUL **14 days**, Severity CRITICAL
4. Root cause: External Corrosion 74%, Coating Disbondment 18%

### ✅ Scenario 3: Explainable AI
1. With SEG-021 selected, click **EXPLAIN**
2. Feature contribution bars appear:
   - UT Wall Thickness Trend: 38%
   - CP Potential Deviation: 27%
   - Acoustic Emission Count: 19%
3. Plain-English description is readable, not jargon

### ✅ Scenario 4: Work order creation
1. Click **Create Work Order** in the detail drawer
2. Form pre-fills: segment, priority (Critical), title, safety notes, parts list
3. Work order appears in the WO list
4. On mobile, a simplified form renders with larger touch targets

### ✅ Scenario 5: Offline mode
1. Click **Sim Offline** in the top bar (dev control)
2. Grey offline banner appears with "Last sync: Xm ago"
3. Map continues to work (tiles cached by service worker)
4. Create a new work order → it shows "(queued)" badge
5. Click **Sim Online** → banner disappears, "Syncing…" → badge clears

### ✅ Scenario 6: PIG comparison tool
1. Click the purple **PIG** button (bottom-right)
2. Select Run 1: April 2022, Run 2: September 2024 for SEG-021
3. Bar chart shows metal loss growth at each anomaly location
4. Table shows growth rate: 8.5%/yr at Mile 205.1 (alarm highlighted)
5. 2-year forecast shown as dashed bar

### ✅ Scenario 7: Leak alert
1. Click **Sim Leak** in the top bar (dev control)
2. Full-screen red overlay appears with pulsing concentric rings
3. Alert shows: Confidence 89%, Location (32.34°N, 101.05°W ±150m)
4. Triggering sensors listed: DAS, Flow Balance, Pressure
5. Click **Acknowledge → Dispatch Response Team**
6. Alert clears, map shows acknowledged icon

### ✅ Scenario 8: ROI counter
1. Click the green **$X.XM** ROI counter in the top bar
2. ROI modal opens with 5 months of history
3. KPIs: Total ROI, Downtime Avoided (58 hrs), Emergencies Avoided (5)
4. Edit cost assumptions → totals update in real time

---

## Configuration

Key environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | API server port |
| `DATABASE_URL` | PostgreSQL URL | Relational data |
| `INFLUX_TOKEN` | — | InfluxDB auth token |
| `AI_SERVICE_URL` | `http://ai:8000` | AI microservice URL |
| `MQTT_HOST` | `mosquitto` | MQTT broker hostname |
| `GATEWAY_ID` | `EG-04` | Edge gateway identifier |
| `PUBLISH_INTERVAL_S` | `2` | Simulator publish rate |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Zustand, React-Leaflet, Recharts |
| PWA | vite-plugin-pwa, Workbox (tile caching, offline API) |
| Backend API | Node.js, Express 4, Socket.io, TypeScript |
| AI Service | Python 3.12, FastAPI, XGBoost, scikit-learn, ONNX Runtime |
| Edge Gateway | Python 3.12, paho-mqtt, SQLite |
| MQTT Broker | Eclipse Mosquitto 2.0 |
| Time-series DB | InfluxDB 2.7 |
| Relational DB | PostgreSQL 16 |
| Container | Docker Compose |

---

## Regulatory Compliance

ReliabilityOS outputs are designed to support compliance with:

- **API 1163** — In-Line Inspection Systems Qualification Standard
- **PHMSA 49 CFR Part 195** — Transportation of Hazardous Liquids by Pipeline
- **API 570** — Piping Inspection Code
- **ASME B31.4** — Pipeline Transportation Systems for Liquids

All AI predictions include uncertainty quantification (90% confidence intervals) and full audit trails to satisfy ILI reporting requirements.

---

## Licence

MIT — see `LICENSE`

---

## Contributing

1. Fork → branch (`feature/your-feature`) → PR
2. Run `npm test` in `frontend/` and `backend/api/`
3. Run `pytest` in `backend/ai/`
4. All new AI features must include a SHAP explanation
