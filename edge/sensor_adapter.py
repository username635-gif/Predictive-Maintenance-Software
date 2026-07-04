from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional


@dataclass(frozen=True)
class SensorReading:
    """Unified reading schema for downstream systems (MQTT, InfluxDB, UI).

    Fields are intentionally stable across adapter implementations.
    """

    sensor_id: str
    segment_id: str
    timestamp: str
    value: float
    unit: str
    quality: float = 1.0

    # Existing downstream logic may depend on sensor_type.
    sensor_type: str = ""

    # New: traceability across data provenance.
    source: str = ""  # e.g. "opcua", "modbus", "mqtt_native", "simulator"

    # Optional adapter-specific metadata.
    meta: Dict[str, Any] | None = None

    def to_payload(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "sensor_id": self.sensor_id,
            "segment_id": self.segment_id,
            "timestamp": self.timestamp,
            "value": self.value,
            "unit": self.unit,
            "quality": self.quality,
            "sensor_type": self.sensor_type,
            "source": self.source,
        }
        if self.meta:
            payload["meta"] = self.meta
        return payload


class SensorAdapter(ABC):
    """Adapter interface for pluggable sensor ingestion."""

    # Concrete adapters should override.
    source_type: str = ""

    @abstractmethod
    async def connect(self) -> None:
        """Open any network connections / sessions required for reading."""

    @abstractmethod
    async def read(self) -> Iterable[SensorReading]:
        """Read current sensor values.

        Returns an iterable of readings (often 1, but adapters may batch).
        """

    @abstractmethod
    async def disconnect(self) -> None:
        """Close connections/sessions."""

