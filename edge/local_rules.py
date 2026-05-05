"""
Edge Local Rules Engine

Evaluates sensor readings against hard-coded safety thresholds WITHOUT
requiring cloud connectivity. Designed as a never-fail safety net.

Alarm outputs:
  - SQLite local_alarms table (persisted)
  - stdout/structlog (operator terminal / syslog)
  - TODO: Modbus relay output to local alarm panel

Rules are intentionally simple and deterministic — no ML inference here.
The rule set mirrors API 1163 / PHMSA Part 195 limits.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import structlog

log = structlog.get_logger()


@dataclass
class Rule:
    rule_id: str
    name: str
    sensor_type: str
    threshold_high: Optional[float] = None
    threshold_low: Optional[float] = None
    duration_seconds: int = 0          # 0 = instantaneous
    severity: str = "warning"          # 'warning' | 'critical'
    message_template: str = "{sensor_id}: {value} {unit} exceeded threshold"


# ─────────────────────────────── Rule Definitions ─────────────────────────────
RULES: list[Rule] = [
    # Pressure – high (>95% of MAOP = 820 psi → MAOP = 1025 psi)
    Rule(
        rule_id="PR-001",
        name="High Operating Pressure",
        sensor_type="pressure_transmitter",
        threshold_high=980.0,
        severity="warning",
        message_template="{sensor_id}: Pressure {value:.0f} psi — approaching MAOP",
    ),
    Rule(
        rule_id="PR-002",
        name="MAOP Exceedance",
        sensor_type="pressure_transmitter",
        threshold_high=1025.0,
        severity="critical",
        message_template="{sensor_id}: MAOP EXCEEDED — {value:.0f} psi > 1025 psi",
    ),
    # Pressure – low (possible rupture / leak)
    Rule(
        rule_id="PR-003",
        name="Low Pressure (Possible Rupture)",
        sensor_type="pressure_transmitter",
        threshold_low=500.0,
        severity="critical",
        message_template="{sensor_id}: LOW PRESSURE {value:.0f} psi — possible leak/rupture",
    ),
    # Wall thickness – critical thinning (<6.5 mm = 36% remaining of 10.2 nominal)
    Rule(
        rule_id="WT-001",
        name="Critical Wall Thinning",
        sensor_type="ultrasonic_thickness",
        threshold_low=6.5,
        severity="critical",
        message_template="{sensor_id}: CRITICAL wall thickness {value:.2f} mm — immediate action",
    ),
    Rule(
        rule_id="WT-002",
        name="Wall Thinning Warning",
        sensor_type="ultrasonic_thickness",
        threshold_low=8.0,
        severity="warning",
        message_template="{sensor_id}: Wall thickness {value:.2f} mm — monitor closely",
    ),
    # Cathodic protection – under-protection threshold
    Rule(
        rule_id="CP-001",
        name="CP Under-Protection",
        sensor_type="cathodic_protection",
        threshold_high=-750.0,   # less negative = under-protected
        severity="warning",
        message_template="{sensor_id}: CP potential {value:.0f} mV — under-protection limit −850 mV",
    ),
    Rule(
        rule_id="CP-002",
        name="CP Critical Under-Protection",
        sensor_type="cathodic_protection",
        threshold_high=-700.0,
        severity="critical",
        message_template="{sensor_id}: CRITICAL CP under-protection {value:.0f} mV",
    ),
    # Acoustic emission – bursting count
    Rule(
        rule_id="AE-001",
        name="High Acoustic Emission",
        sensor_type="acoustic_emission",
        threshold_high=75.0,
        severity="warning",
        message_template="{sensor_id}: High AE level {value:.1f} dB — inspect for defects",
    ),
    Rule(
        rule_id="AE-002",
        name="Critical Acoustic Emission (Possible Leak)",
        sensor_type="acoustic_emission",
        threshold_high=90.0,
        severity="critical",
        message_template="{sensor_id}: CRITICAL AE {value:.1f} dB — possible active leak",
    ),
]

# Index rules by sensor type for O(1) lookup
_RULES_BY_TYPE: dict[str, list[Rule]] = {}
for r in RULES:
    _RULES_BY_TYPE.setdefault(r.sensor_type, []).append(r)


# ─────────────────────────────── Engine ───────────────────────────────────────
class RulesEngine:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn
        # Track active alarms to avoid duplicate inserts
        self._active: dict[str, str] = {}   # sensor_id → rule_id

    def evaluate(self, reading: dict) -> list[dict]:
        """Evaluate all applicable rules against a sensor reading.
        Returns list of fired alarms (may be empty).
        """
        sensor_type = reading.get("sensor_type", "")
        rules = _RULES_BY_TYPE.get(sensor_type, [])
        fired = []

        for rule in rules:
            triggered = False
            value = reading["value"]

            if rule.threshold_high is not None and value >= rule.threshold_high:
                triggered = True
            if rule.threshold_low is not None and value <= rule.threshold_low:
                triggered = True

            key = f"{reading['sensor_id']}|{rule.rule_id}"
            if triggered and key not in self._active:
                alarm = self._fire_alarm(rule, reading)
                fired.append(alarm)
                self._active[key] = alarm["timestamp"]
            elif not triggered and key in self._active:
                self._clear_alarm(reading["sensor_id"], rule.rule_id)
                del self._active[key]

        return fired

    def _fire_alarm(self, rule: Rule, reading: dict) -> dict:
        timestamp = datetime.now(timezone.utc).isoformat()
        message = rule.message_template.format(
            sensor_id=reading["sensor_id"],
            value=reading["value"],
            unit=reading.get("unit", ""),
        )

        # Persist
        self._conn.execute(
            "INSERT INTO local_alarms (alarm_type, sensor_id, timestamp, value, message) VALUES (?,?,?,?,?)",
            (rule.rule_id, reading["sensor_id"], timestamp, reading["value"], message),
        )
        self._conn.commit()

        if rule.severity == "critical":
            log.critical("ALARM_FIRED", rule=rule.rule_id, msg=message)
        else:
            log.warning("ALARM_FIRED", rule=rule.rule_id, msg=message)

        return {
            "rule_id": rule.rule_id,
            "name": rule.name,
            "sensor_id": reading["sensor_id"],
            "severity": rule.severity,
            "timestamp": timestamp,
            "value": reading["value"],
            "message": message,
        }

    def _clear_alarm(self, sensor_id: str, rule_id: str) -> None:
        self._conn.execute(
            "UPDATE local_alarms SET cleared=1 WHERE sensor_id=? AND alarm_type=? AND cleared=0",
            (sensor_id, rule_id),
        )
        self._conn.commit()
        log.info("ALARM_CLEARED", rule=rule_id, sensor=sensor_id)
