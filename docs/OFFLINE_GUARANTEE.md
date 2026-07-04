# OFFLINE GUARANTEE (Zero Connectivity Boundary)

This document states exactly what continues to work when the network is unplugged (0 connectivity) and what stops.

> Assumption for this guarantee: the **Edge Gateway** is running and still able to read sensors locally (OPC-UA / Modbus / simulator). Only cloud/network connectivity is removed.

---

## What still works with zero connectivity

### 1) Local, rule-based critical alarms (pressure spike / wall-thickness drop)
- The Edge runs `edge/local_rules.py` locally.
- It evaluates deterministic thresholds **in-process** with no cloud calls.
- When a **critical** rule fires, the gateway:
  - writes an entry to the local SQLite database table `local_alarms` (persisted on disk)
  - writes a technician-facing local state file: **`DB_PATH` directory / `edge_alarm_state.json`**
  - appends an event line to **`DB_PATH` directory / `edge_alarm_events.log`**
  - logs `ALARM_FIRED` via `structlog` (`critical` severity uses `log.critical`)

Consequence for a demo: unplugging the network should still produce local critical alarm artifacts and logs **immediately** when the threshold condition occurs.

### 2) Alarm persistence and operator polling
- Because alarm events and state are written to disk locally, a technician tablet app (or any local process) can poll:
  - `edge_alarm_state.json` for “is a critical alarm active?”
  - `edge_alarm_events.log` for the stream of recent critical events

### 3) Local sensor buffering (if sensors keep flowing)
- `edge/gateway.py` continues to ingest readings and write to its local SQLite buffer (`readings` table).
- If the cloud is unreachable, cloud sync simply does not mark readings as synced.

---

## What requires connectivity (stops when unplugged)

### 1) ML anomaly detection (cloud/AI service inference path)
- The ML models (anomaly detector, leak detector, root cause classifier, etc.) are not part of the local rule engine.
- Their outputs are not guaranteed to update without the required upstream connectivity.

### 2) RUL (Remaining Useful Life) prediction
- RUL prediction requires the inference pipeline (the AI service / model execution path) being reachable as part of the connected system.
- Offline: no guarantee of new RUL computations or refreshed RUL views.

### 3) Cross-segment correlation and any cloud-mediated aggregation
- Any correlation logic that depends on cloud-provided history, cross-segment context, or API calls requires connectivity.
- When network is removed, those cross-segment features must not be assumed to update.

### 4) Cross-device/UI sync to backend routes
- API calls to `backend/api` routes (work orders, alert updates, audit writes, predictions persistence, etc.) require network access.
- The offline UI may remain partially functional, but server-side updates are not guaranteed.

---

## Exact boundary summary (engineers can test)

### If network is unplugged:
✅ Critical alarms still trigger **locally** via threshold rules, with:
- `local_alarms` DB writes
- `edge_alarm_state.json` updates
- `edge_alarm_events.log` appends

❌ ML-based anomaly detection, RUL prediction, and cross-segment correlation are **not guaranteed** and should be treated as unavailable without connectivity.

---

## Demo instruction (the “prove it” moment)
1. Start the Edge gateway with a functioning sensor feed.
2. Unplug network (or stop cloud reachability).
3. Induce a condition that crosses a known critical threshold (e.g., **wall thickness ≤ 6.5 mm** or **pressure ≥ 1025 psi** depending on your sensor mappings).
4. Verify on the edge host:
   - `edge_alarm_state.json` flips to `critical_active: true`
   - `edge_alarm_events.log` gains a new event line
   - `local_alarms` contains new critical entries
5. The UI offline banner should state that critical alarms trigger locally.

