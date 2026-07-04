from __future__ import annotations

from typing import Any, Dict, Iterable, List

from edge.sensor_adapter import SensorAdapter, SensorReading


class SimulatorAdapter(SensorAdapter):
    """Adapter wrapper for existing simulator.

    Not used in this phase (explicitly: do not touch sensor_simulator.py),
    but provided for adapter wiring completeness.
    """

    source_type = "simulator"

    def __init__(self, *, sensors: List[Dict[str, Any]]):
        self._sensors = sensors

    async def connect(self) -> None:
        return

    async def disconnect(self) -> None:
        return

    async def read(self) -> Iterable[SensorReading]:
        # TODO: Wire into existing simulator implementation.
        return []

