from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List

import structlog

from edge.sensor_adapter import SensorAdapter, SensorReading

log = structlog.get_logger()


@dataclass(frozen=True)
class OpcUaNode:
    node_id: str


class OpcUaAdapter(SensorAdapter):
    """OPC-UA adapter backed by a real asyncua client."""

    source_type = "opcua"

    def __init__(
        self,
        *,
        endpoint: str,
        sensors: List[Dict[str, Any]],
        unit: str = "",
        quality: float = 1.0,
    ):
        self.endpoint = endpoint
        self._sensors = sensors
        self._default_unit = unit
        self._default_quality = quality
        self._client = None

    async def connect(self) -> None:
        from asyncua import Client  # type: ignore

        self._client = Client(url=self.endpoint)
        await self._client.connect()
        log.info("OPCUA_CONNECTED", endpoint=self.endpoint)

    async def disconnect(self) -> None:
        if self._client is None:
            return
        await self._client.disconnect()
        log.info("OPCUA_DISCONNECTED", endpoint=self.endpoint)
        self._client = None

    async def read(self) -> Iterable[SensorReading]:
        if self._client is None:
            raise RuntimeError("OpcUaAdapter.connect() must be called before read().")

        now = datetime.now(timezone.utc).isoformat()

        readings: List[SensorReading] = []
        for s in self._sensors:
            sensor_id = s["sensor_id"]
            segment_id = s.get("segment_id", sensor_id)
            node_id = s["node_id"]
            sensor_type = s.get("sensor_type", "")
            unit = s.get("unit", self._default_unit)
            q = float(s.get("quality", self._default_quality))

            try:
                value = await self._client.get_node(node_id).read_value()
            except Exception as exc:
                log.warning(
                    "OPCUA_READ_FAIL",
                    endpoint=self.endpoint,
                    sensor_id=sensor_id,
                    node_id=node_id,
                    error=str(exc),
                )
                continue

            try:
                value_f = float(value)
            except Exception:
                log.warning(
                    "OPCUA_NON_NUMERIC",
                    sensor_id=sensor_id,
                    node_id=node_id,
                    value=str(value),
                )
                continue

            readings.append(
                SensorReading(
                    sensor_id=sensor_id,
                    segment_id=segment_id,
                    timestamp=now,
                    value=value_f,
                    unit=unit,
                    quality=q,
                    sensor_type=sensor_type,
                    source=self.source_type,
                )
            )

        return readings


# TODO: integration test requires live OPC-UA server
# (logic is unit-tested against the opcua-asyncio test server in
# `edge/adapters/opcua_adapter_test.py`).

