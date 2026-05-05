"""
ReliabilityOS Sensor Data Simulator

Generates realistic sensor readings for all sensors in the pipeline and
publishes them to MQTT topics consumed by edge gateways.

Features:
  - Steady-state noise around nominal values (correlated Gaussian)
  - Configurable failure scenarios (see failure_scenarios.py)
  - Replay mode: reads historical data from CSV and re-publishes at speed
  - Gradual degradation: corrosion rate, CP voltage drift

Usage:
  python sensor_simulator.py                   # baseline (no failures)
  python sensor_simulator.py --scenario leak   # activate leak scenario
  python sensor_simulator.py --scenario corrosion_critical
  python sensor_simulator.py --list-scenarios
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import paho.mqtt.client as mqtt
import structlog
from dotenv import load_dotenv

from failure_scenarios import SCENARIOS, FailureScenario

load_dotenv()
log = structlog.get_logger()

# ─────────────────────────────── Configuration ────────────────────────────────
MQTT_HOST = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
PUBLISH_INTERVAL_S = float(os.environ.get("PUBLISH_INTERVAL_S", "2.0"))

# ─────────────────────────────── Sensor Definitions ──────────────────────────
@dataclass
class SensorConfig:
    sensor_id: str
    sensor_type: str
    segment_id: str
    gateway_id: str
    nominal_value: float
    noise_std: float
    unit: str
    normal_range: tuple[float, float]
    corrosion_rate_per_year: float = 0.0   # for UT sensors
    cp_drift_per_year: float = 0.0          # for CP sensors

    def topic(self) -> str:
        return f"reliabilityos/{self.gateway_id}/sensors/{self.sensor_id}/data"


def build_sensor_configs() -> list[SensorConfig]:
    """Create sensor configurations for all 50 segments × 4 sensor types = 200 sensors."""
    configs = []
    gateways = {
        0: "EG-01", 10: "EG-01",
        1: "EG-01", 11: "EG-01",
        2: "EG-02", 12: "EG-02",
        3: "EG-02", 13: "EG-02",
        4: "EG-03", 20: "EG-03",
        5: "EG-04", 25: "EG-04",   # EG-04 is the offline gateway
        6: "EG-05", 35: "EG-05",   # EG-05 is near the leak
        7: "EG-06", 49: "EG-06",
    }

    for i in range(50):
        seg_id = f"SEG-{i + 1:03d}"
        gw = gateways.get(i // 5 * 5, f"EG-0{(i // 10) % 6 + 1}")
        is_critical = seg_id in ("SEG-021", "SEG-036", "SEG-037")
        is_warning = seg_id in ("SEG-015", "SEG-022", "SEG-043")

        wall_nominal = 10.2 if not is_critical else (6.8 if seg_id == "SEG-021" else 8.5)
        corr_rate = 0.18 if seg_id == "SEG-021" else (0.08 if is_warning else 0.02)

        cp_nominal = -870.0 if not is_critical else (-720.0 if seg_id == "SEG-021" else -800.0)
        cp_drift = 5.0 if seg_id == "SEG-021" else 1.0

        pressure_nominal = 820 + 80 * math.sin(i * 0.4)

        ae_nominal = 35.0 if not is_critical else 62.0

        n = i * 4
        configs += [
            SensorConfig(
                sensor_id=f"SEN-{n + 1:04d}",
                sensor_type="ultrasonic_thickness",
                segment_id=seg_id,
                gateway_id=gw,
                nominal_value=wall_nominal,
                noise_std=0.04,
                unit="mm",
                normal_range=(8.0, 10.5),
                corrosion_rate_per_year=corr_rate,
            ),
            SensorConfig(
                sensor_id=f"SEN-{n + 2:04d}",
                sensor_type="pressure_transmitter",
                segment_id=seg_id,
                gateway_id=gw,
                nominal_value=pressure_nominal,
                noise_std=5.0,
                unit="psi",
                normal_range=(700, 980),
            ),
            SensorConfig(
                sensor_id=f"SEN-{n + 3:04d}",
                sensor_type="acoustic_emission",
                segment_id=seg_id,
                gateway_id=gw,
                nominal_value=ae_nominal,
                noise_std=3.0,
                unit="dB",
                normal_range=(20, 65),
            ),
            SensorConfig(
                sensor_id=f"SEN-{n + 4:04d}",
                sensor_type="cathodic_protection",
                segment_id=seg_id,
                gateway_id=gw,
                nominal_value=cp_nominal,
                noise_std=8.0,
                unit="mV",
                normal_range=(-950, -800),
                cp_drift_per_year=cp_drift,
            ),
        ]

    return configs


# ─────────────────────────────── Simulator ────────────────────────────────────
class SensorSimulator:
    def __init__(
        self,
        scenario_name: Optional[str] = None,
        mqtt_host: str = MQTT_HOST,
        mqtt_port: int = MQTT_PORT,
    ):
        self.sensors = build_sensor_configs()
        self.scenario: Optional[FailureScenario] = SCENARIOS.get(scenario_name)
        self._values = {s.sensor_id: s.nominal_value for s in self.sensors}
        self._rng = np.random.default_rng(seed=0)
        self._tick = 0
        self._start_time = time.time()

        if self.scenario:
            log.warning("SCENARIO_ACTIVE", scenario=scenario_name, description=self.scenario.description)

        self._mqtt = mqtt.Client(client_id="reliabilityos-simulator", protocol=mqtt.MQTTv5)
        self._mqtt.on_connect = lambda c, u, f, rc, p: log.info("SIM_MQTT_CONNECTED", rc=rc)
        self._mqtt.connect(mqtt_host, mqtt_port, keepalive=60)
        self._mqtt.loop_start()

    def run(self) -> None:
        log.info("SIMULATOR_START", sensor_count=len(self.sensors), interval=PUBLISH_INTERVAL_S)
        try:
            while True:
                self._tick += 1
                elapsed_years = (time.time() - self._start_time) / (365.25 * 86400)

                for sensor in self.sensors:
                    value = self._compute_value(sensor, elapsed_years)
                    reading = self._make_reading(sensor, value)
                    payload = json.dumps(reading)
                    self._mqtt.publish(sensor.topic(), payload, qos=0)

                if self._tick % 50 == 0:
                    log.info("SIM_TICK", tick=self._tick, elapsed_min=round((time.time() - self._start_time) / 60, 1))

                time.sleep(PUBLISH_INTERVAL_S)
        except KeyboardInterrupt:
            log.info("SIMULATOR_STOP")
            self._mqtt.loop_stop()

    def _compute_value(self, sensor: SensorConfig, elapsed_years: float) -> float:
        base = sensor.nominal_value

        # Apply slow drift (corrosion / CP voltage)
        if sensor.corrosion_rate_per_year > 0:
            base -= sensor.corrosion_rate_per_year * elapsed_years

        if sensor.cp_drift_per_year > 0:
            base += sensor.cp_drift_per_year * elapsed_years    # CP becomes less negative = worse

        # Apply active failure scenario overrides
        if self.scenario:
            override = self.scenario.get_override(sensor.sensor_id, self._tick)
            if override is not None:
                base = override

        # Gaussian noise
        value = float(base + self._rng.normal(0, sensor.noise_std))
        return value

    def _make_reading(self, sensor: SensorConfig, value: float) -> dict:
        quality = 1.0 if abs(value - sensor.nominal_value) < sensor.noise_std * 3 else 0.8
        return {
            "sensor_id": sensor.sensor_id,
            "sensor_type": sensor.sensor_type,
            "segment_id": sensor.segment_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "value": round(value, 3),
            "unit": sensor.unit,
            "quality": round(quality, 2),
        }


# ─────────────────────────────── CLI ─────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="ReliabilityOS Sensor Simulator")
    parser.add_argument("--scenario", default=None, help="Failure scenario name")
    parser.add_argument("--list-scenarios", action="store_true")
    args = parser.parse_args()

    if args.list_scenarios:
        print("\nAvailable failure scenarios:")
        for name, sc in SCENARIOS.items():
            print(f"  {name:30s} — {sc.description}")
        sys.exit(0)

    if args.scenario and args.scenario not in SCENARIOS:
        print(f"Unknown scenario: {args.scenario}")
        print(f"Available: {', '.join(SCENARIOS.keys())}")
        sys.exit(1)

    sim = SensorSimulator(scenario_name=args.scenario)
    sim.run()


if __name__ == "__main__":
    main()
