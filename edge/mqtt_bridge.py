"""
MQTT Bridge + Sensor Adapter Orchestrator

1) Subscribes to sensor topics published by field instruments and passes
   each reading to the gateway callback.
2) Instantiates configured sensor adapters from edge/config.yaml and
   publishes unified sensor readings to MQTT with a `source` field.

Topic structure:
  reliabilityos/{gateway_id}/sensors/{sensor_id}/data
  reliabilityos/{gateway_id}/sensors/{sensor_id}/status

Outbound (cloud bridge):
  reliabilityos/cloud/sensors/batch   – bulk batch upload
"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional

import paho.mqtt.client as mqtt
import structlog
import yaml

from edge.adapters.adapters_factory import create_adapter
from edge.mqtt_schema import to_unified_mqtt_payload
from edge.sensor_adapter import SensorReading

log = structlog.get_logger()


@dataclass(frozen=True)
class AdapterGroup:
    id: str
    adapter: str
    cfg: Dict[str, object]


class MQTTBridge:
    def __init__(
        self,
        host: str,
        port: int,
        gateway_id: str,
        on_reading: Callable[[dict], None],
        *,
        config_path: str | None = None,
    ):
        self.host = host
        self.port = port
        self.gateway_id = gateway_id
        self.on_reading = on_reading
        self.config_path = config_path

        self._stop_event = threading.Event()

        self._client = mqtt.Client(
            client_id=f"reliabilityos-edge-{gateway_id}",
            protocol=mqtt.MQTTv5,
        )
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        self._client.on_disconnect = self._on_disconnect

        self._adapter_thread: Optional[threading.Thread] = None

    def start_loop(self) -> None:
        # Start adapter polling loop first (so it can publish readings).
        self._adapter_thread = threading.Thread(target=self._adapter_poll_loop, daemon=True)
        self._adapter_thread.start()

        backoff = 1.0
        while not self._stop_event.is_set():
            try:
                self._client.connect(self.host, self.port, keepalive=60)
                self._client.loop_forever()
                backoff = 1.0  # reset on clean disconnect
            except (ConnectionRefusedError, OSError) as exc:
                log.warning("MQTT_CONNECT_FAIL", error=str(exc), retry_in=backoff)
                time.sleep(min(backoff, 60))
                backoff = min(backoff * 2, 60)

    def stop(self) -> None:
        self._stop_event.set()
        self._client.disconnect()

    def publish_batch(self, readings: list[dict]) -> None:
        payload = json.dumps(readings)
        self._client.publish(
            f"reliabilityos/cloud/sensors/batch",
            payload,
            qos=1,
        )

    # ─── MQTT callbacks ─────────────────────────────────────────────────────
    def _on_connect(self, client, userdata, flags, rc, properties=None) -> None:
        if rc == 0:
            log.info("MQTT_CONNECTED", host=self.host, port=self.port, gw=self.gateway_id)
            topic = f"reliabilityos/{self.gateway_id}/sensors/+/data"
            client.subscribe(topic, qos=1)
            log.info("MQTT_SUBSCRIBED", topic=topic)
        else:
            log.error("MQTT_CONNECT_ERROR", rc=rc)

    def _on_message(self, client, userdata, msg: mqtt.MQTTMessage) -> None:
        try:
            reading = json.loads(msg.payload.decode("utf-8"))
            reading["_topic"] = msg.topic
            self.on_reading(reading)
        except json.JSONDecodeError as exc:
            log.warning("MQTT_BAD_PAYLOAD", topic=msg.topic, error=str(exc))
        except Exception as exc:
            log.error("MQTT_MESSAGE_ERROR", error=str(exc))

    def _on_disconnect(self, client, userdata, rc, properties=None) -> None:
        if rc != 0:
            log.warning("MQTT_DISCONNECTED_UNCLEAN", rc=rc, gw=self.gateway_id)
        else:
            log.info("MQTT_DISCONNECTED", gw=self.gateway_id)

    # ─── Adapter polling + MQTT publishing ──────────────────────────────────
    def _load_config(self) -> Dict[str, object]:
        path = self.config_path
        if not path:
            # Default: edge/config.yaml relative to repository root.
            path = str(Path(__file__).resolve().parent / "config.yaml")

        with open(path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        return cfg

    def _adapter_poll_loop(self) -> None:
        cfg = self._load_config()
        sensors_cfg = cfg.get("sensors", {}) or {}

        poll_interval = float(sensors_cfg.get("poll_interval_seconds", 5))
        groups_cfg = sensors_cfg.get("groups", []) or []

        if not groups_cfg:
            log.warning("NO_SENSOR_ADAPTERS_CONFIGURED", poll_interval=poll_interval)
            return

        groups: List[AdapterGroup] = []
        for g in groups_cfg:
            groups.append(
                AdapterGroup(
                    id=str(g["id"]),
                    adapter=str(g["adapter"]),
                    cfg=dict(g),
                )
            )

        # Normalize group config into adapter config expected by adapters_factory.
        # Each group config becomes one adapter instance.
        adapter_instances = []
        for group in groups:
            adapter_cfg = dict(group.cfg)
            adapter_cfg.pop("id", None)
            adapter_cfg.pop("adapter", None)

            # Map single-node/group fields into `sensors=[...]`.
            # Expected schema for groups (per task):
            #   - id
            #   - adapter
            #   - connection params (endpoint/host/etc)
            #   - node_id or register_address/... 
            #   - sensor_type, unit (optional)
            sensor_dict: Dict[str, object] = {
                "sensor_id": adapter_cfg.get("id") or group.id,
                "segment_id": adapter_cfg.get("segment_id") or adapter_cfg.get("id") or group.id,
                "sensor_type": adapter_cfg.get("sensor_type", ""),
                "unit": adapter_cfg.get("unit", ""),
            }
            # Remove `id` if present; group.id is the stable identifier.
            sensor_dict.pop("id", None)

            if "node_id" in adapter_cfg:
                sensor_dict["node_id"] = adapter_cfg["node_id"]

            if "register_address" in adapter_cfg:
                sensor_dict["register_address"] = adapter_cfg["register_address"]

            # For modbus scaling options.
            for k in ("register_count", "scale", "offset", "quality", "unit_id"):
                if k in adapter_cfg:
                    sensor_dict[k] = adapter_cfg[k]

            adapter_cfg["sensors"] = [sensor_dict]

            adapter_instances.append((group, create_adapter({"adapter": group.adapter, **adapter_cfg})))

        import asyncio

        async def _run() -> None:
            for _, adapter in adapter_instances:
                await adapter.connect()

            while not self._stop_event.is_set():
                for group, adapter in adapter_instances:
                    try:
                        readings: Iterable[SensorReading] = await adapter.read()
                        for r in readings:
                            payload = to_unified_mqtt_payload(
                                reading=r.to_payload(),
                                gateway_id=self.gateway_id,
                                group_id=group.id,
                            )
                            topic = f"reliabilityos/{self.gateway_id}/sensors/{r.sensor_id}/data"
                            self._client.publish(topic, json.dumps(payload), qos=1)
                    except Exception as exc:
                        log.warning(
                            "ADAPTER_READ_FAIL",
                            adapter=group.adapter,
                            group_id=group.id,
                            error=str(exc),
                        )

                await asyncio.sleep(poll_interval)

            for _, adapter in adapter_instances:
                await adapter.disconnect()

        asyncio.run(_run())


