"""
ReliabilityOS Edge Gateway

Runs on an industrial PC at each remote monitoring station.
Operates in three modes:
  1. CONNECTED  — live pass-through of sensor data to cloud via MQTT
  2. BUFFERED   — sensors online, cloud offline → SQLite ring buffer
  3. ISLANDED   — sensors + cloud offline → local alarm rules only

Architecture:
  Sensor drivers → Local SQLite → MQTT bridge → Cloud API
                ↕
          Local Rules Engine (pressure/AE thresholds)
          → Modbus/relay output for local alarm panels
"""
from __future__ import annotations

import json
import os
import signal
import sqlite3
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
import schedule
import structlog
import yaml
from dotenv import load_dotenv

from edge.local_rules import RulesEngine
from edge.mqtt_bridge import MQTTBridge

load_dotenv()

log = structlog.get_logger()

# ─────────────────────────────── YAML config (cloud.* block only) ─────────────
# Precedence: env var > config.yaml > hardcoded default below. This lets an
# operator override a checked-in config.yaml at deploy time via env vars,
# while still getting sane values if config.yaml is missing or malformed.
#
# GATEWAY_API_KEY is deliberately NOT loaded from config.yaml, ever --
# config.yaml is a tracked file in this repo (confirmed via git ls-files),
# so writing a real key into it would commit a live secret to git history.
# It is env-var-only, sourced from a local .env (gitignored) or the
# deployment environment.
_CONFIG_PATH = Path(__file__).resolve().parent / "config.yaml"


def _load_yaml_config(path: Path) -> dict:
    if not path.exists():
        log.warning("CONFIG_YAML_MISSING", path=str(path))
        return {}
    try:
        with open(path, "r") as f:
            data = yaml.safe_load(f) or {}
        if not isinstance(data, dict):
            log.warning("CONFIG_YAML_INVALID", path=str(path), reason="top-level is not a mapping")
            return {}
        return data
    except Exception as exc:
        log.warning("CONFIG_YAML_PARSE_ERROR", path=str(path), error=str(exc))
        return {}


_yaml_config = _load_yaml_config(_CONFIG_PATH)
_yaml_cloud = _yaml_config.get("cloud", {}) if isinstance(_yaml_config.get("cloud"), dict) else {}

# ─────────────────────────────── Config ───────────────────────────────────────
GATEWAY_ID = os.environ.get("GATEWAY_ID", "EG-04")
GATEWAY_DESCRIPTION = os.environ.get("GATEWAY_DESCRIPTION", "Mile 250 Remote Station")
CLOUD_API_URL = os.environ.get("CLOUD_API_URL", _yaml_cloud.get("api_url", "http://localhost:8080"))
CLOUD_SYNC_INTERVAL_S = int(os.environ.get("CLOUD_SYNC_INTERVAL_S", _yaml_cloud.get("sync_interval_seconds", 30)))
CLOUD_TIMEOUT_S = int(os.environ.get("CLOUD_TIMEOUT_S", _yaml_cloud.get("timeout_seconds", 10)))
CLOUD_RETRY_LIMIT = int(os.environ.get("CLOUD_RETRY_LIMIT", _yaml_cloud.get("retry_limit", 3)))
GATEWAY_API_KEY = os.environ.get("GATEWAY_API_KEY", "")
SENSOR_POLL_INTERVAL_S = int(os.environ.get("SENSOR_POLL_INTERVAL_S", "5"))
DB_PATH = Path(os.environ.get("DB_PATH", "gateway_buffer.db"))
MQTT_HOST = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MAX_BUFFER_ROWS = int(os.environ.get("MAX_BUFFER_ROWS", "100000"))

if not GATEWAY_API_KEY:
    log.warning(
        "GATEWAY_API_KEY_UNSET",
        detail="No gateway API key configured -- cloud sync will be rejected with 401 until GATEWAY_API_KEY is set in the environment.",
    )

# ─────────────────────────────── ConnectivityState ────────────────────────────
class ConnectivityState:
    CONNECTED = "connected"
    BUFFERED = "buffered"    # cloud offline, sensors online
    ISLANDED = "islanded"   # all comms offline

_state = ConnectivityState.CONNECTED
_state_lock = threading.Lock()


def set_state(new_state: str) -> None:
    global _state
    with _state_lock:
        if _state != new_state:
            log.warning("STATE_CHANGE", old=_state, new=new_state, gateway=GATEWAY_ID)
            _state = new_state


def get_state() -> str:
    with _state_lock:
        return _state


# ─────────────────────────────── SQLite Buffer ────────────────────────────────
def init_db(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id   TEXT    NOT NULL,
            segment_id  TEXT    NOT NULL,
            timestamp   TEXT    NOT NULL,
            value       REAL    NOT NULL,
            unit        TEXT    NOT NULL,
            quality     REAL    NOT NULL DEFAULT 1.0,
            synced      INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_synced ON readings (synced, id)
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS local_alarms (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            alarm_type  TEXT    NOT NULL,
            sensor_id   TEXT    NOT NULL,
            timestamp   TEXT    NOT NULL,
            value       REAL    NOT NULL,
            message     TEXT    NOT NULL,
            cleared     INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.commit()
    log.info("SQLite buffer initialised", path=str(path))
    return conn


def buffer_reading(conn: sqlite3.Connection, reading: dict) -> None:
    conn.execute(
        "INSERT INTO readings (sensor_id, segment_id, timestamp, value, unit, quality) VALUES (?,?,?,?,?,?)",
        (
            reading["sensor_id"],
            reading["segment_id"],
            reading["timestamp"],
            reading["value"],
            reading["unit"],
            reading.get("quality", 1.0),
        ),
    )
    conn.commit()

    # Evict oldest rows if buffer is full
    count = conn.execute("SELECT COUNT(*) FROM readings WHERE synced=0").fetchone()[0]
    if count > MAX_BUFFER_ROWS:
        conn.execute(
            "DELETE FROM readings WHERE id IN (SELECT id FROM readings WHERE synced=0 ORDER BY id ASC LIMIT ?)",
            (count - MAX_BUFFER_ROWS,),
        )
        conn.commit()


def get_unsynced(conn: sqlite3.Connection, limit: int = 500) -> list[dict]:
    rows = conn.execute(
        "SELECT id, sensor_id, segment_id, timestamp, value, unit, quality FROM readings WHERE synced=0 ORDER BY id ASC LIMIT ?",
        (limit,),
    ).fetchall()
    return [
        {"_row_id": r[0], "sensor_id": r[1], "segment_id": r[2],
         "timestamp": r[3], "value": r[4], "unit": r[5], "quality": r[6]}
        for r in rows
    ]


def mark_synced(conn: sqlite3.Connection, row_ids: list[int]) -> None:
    conn.execute(
        f"UPDATE readings SET synced=1 WHERE id IN ({','.join('?' for _ in row_ids)})",
        row_ids,
    )
    conn.commit()


def buffer_fill_pct(conn: sqlite3.Connection) -> float:
    count = conn.execute("SELECT COUNT(*) FROM readings WHERE synced=0").fetchone()[0]
    return round((count / MAX_BUFFER_ROWS) * 100, 1)


# ─────────────────────────────── Cloud Sync ───────────────────────────────────
def check_cloud_connectivity() -> bool:
    try:
        resp = requests.get(f"{CLOUD_API_URL}/health", timeout=3)
        return resp.status_code == 200
    except Exception:
        return False


def sync_to_cloud(conn: sqlite3.Connection) -> None:
    rows = get_unsynced(conn, limit=500)
    if not rows:
        return

    try:
        resp = requests.post(
            f"{CLOUD_API_URL}/api/v1/sensors/bulk",
            json={"gateway_id": GATEWAY_ID, "readings": rows},
            headers={"X-Gateway-Key": GATEWAY_API_KEY},
            timeout=CLOUD_TIMEOUT_S,
        )
        if resp.status_code in (200, 201):
            ids = [r["_row_id"] for r in rows]
            mark_synced(conn, ids)
            log.info("SYNCED", count=len(rows), gateway=GATEWAY_ID)
        elif resp.status_code == 401:
            log.error("SYNC_UNAUTHORIZED", detail="Gateway key rejected by cloud -- check GATEWAY_API_KEY", status=resp.status_code)
        else:
            log.warning("SYNC_FAILED", status=resp.status_code)
    except Exception as exc:
        log.error("SYNC_ERROR", error=str(exc))
        set_state(ConnectivityState.BUFFERED)


# ─────────────────────────────── Main Loop ────────────────────────────────────
def main() -> None:
    log.info("EDGE_GATEWAY_START", id=GATEWAY_ID, description=GATEWAY_DESCRIPTION)

    conn = init_db(DB_PATH)
    rules = RulesEngine(conn)
    bridge = MQTTBridge(
        host=MQTT_HOST,
        port=MQTT_PORT,
        gateway_id=GATEWAY_ID,
        on_reading=lambda r: on_sensor_reading(r, conn, rules),
        config_path=str(Path(__file__).resolve().parent / "config.yaml"),
    )


    # Periodic cloud sync
    schedule.every(CLOUD_SYNC_INTERVAL_S).seconds.do(lambda: sync_task(conn))
    schedule.every(60).seconds.do(lambda: heartbeat())

    def sync_task(db_conn: sqlite3.Connection) -> None:
        cloud_ok = check_cloud_connectivity()
        current = get_state()
        if cloud_ok:
            if current != ConnectivityState.CONNECTED:
                set_state(ConnectivityState.CONNECTED)
            sync_to_cloud(db_conn)
        else:
            set_state(ConnectivityState.BUFFERED)

    def heartbeat() -> None:
        state = get_state()
        fill = buffer_fill_pct(conn)
        log.info("HEARTBEAT", gateway=GATEWAY_ID, state=state, buffer_pct=fill)

    # Start MQTT bridge in background thread
    bridge_thread = threading.Thread(target=bridge.start_loop, daemon=True)
    bridge_thread.start()

    # Graceful shutdown
    def _shutdown(signum, frame):
        log.info("SHUTDOWN_SIGNAL", signal=signum)
        bridge.stop()
        conn.close()
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    log.info("EDGE_GATEWAY_READY", gateway=GATEWAY_ID)

    while True:
        schedule.run_pending()
        time.sleep(1)


def on_sensor_reading(reading: dict, conn: sqlite3.Connection, rules: "RulesEngine") -> None:
    """Called for every incoming sensor reading from MQTT."""
    buffer_reading(conn, reading)
    rules.evaluate(reading)

    # Report connectivity state to operators
    state = get_state()
    if state == ConnectivityState.ISLANDED:
        log.warning("ISLANDED_MODE", sensor=reading["sensor_id"], value=reading["value"])


if __name__ == "__main__":
    main()
