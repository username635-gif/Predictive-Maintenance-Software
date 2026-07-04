from __future__ import annotations

from typing import Any, Dict, Iterable, List

from dataclasses import dataclass
from datetime import datetime, timezone

import structlog

from edge.sensor_adapter import SensorAdapter, SensorReading

log = structlog.get_logger()


class ModbusAdapter(SensorAdapter):
    """Modbus TCP register reader using pymodbus."""

    source_type = "modbus"

    def __init__(
        self,
        *,
        host: str,
        port: int = 502,
        unit_id: int = 1,
        register_type: str = "holding",
        sensors: List[Dict[str, Any]],
    ):
        self.host = host
        self.port = port
        self.unit_id = unit_id
        self.register_type = register_type
        self.sensors = sensors

        self._client = None

    async def connect(self) -> None:
        from pymodbus.client import ModbusTcpClient  # type: ignore

        self._client = ModbusTcpClient(host=self.host, port=self.port)
        connected = self._client.connect()
        if not connected:
            raise ConnectionError(f"Modbus TCP connect failed to {self.host}:{self.port}")
        log.info("MODBUS_CONNECTED", host=self.host, port=self.port, unit_id=self.unit_id)

    async def disconnect(self) -> None:
        if self._client is None:
            return
        try:
            self._client.close()
        finally:
            log.info("MODBUS_DISCONNECTED", host=self.host, port=self.port)
        self._client = None

    def _read_registers_sync(self, register_address: int, count: int) -> List[int]:
        if self._client is None:
            raise RuntimeError("ModbusAdapter.connect() must be called before read().")

        rt = self.register_type.lower()
        if rt == "holding":
            resp = self._client.read_holding_registers(register_address, count, unit=self.unit_id)
        elif rt == "input":
            resp = self._client.read_input_registers(register_address, count, unit=self.unit_id)
        else:
            raise ValueError(f"Unsupported register_type: {self.register_type}")

        if resp is None or getattr(resp, "isError", lambda: False)():
            raise RuntimeError(f"Modbus read error at address={register_address}")

        return list(resp.registers)

    async def read(self) -> Iterable[SensorReading]:
        import asyncio

        if self._client is None:
            raise RuntimeError("ModbusAdapter.connect() must be called before read().")

        now = datetime.now(timezone.utc).isoformat()
        loop = asyncio.get_running_loop()

        readings: List[SensorReading] = []

        for s in self.sensors:
            sensor_id = s["sensor_id"]
            segment_id = s.get("segment_id", sensor_id)
            sensor_type = s.get("sensor_type", "")
            unit = s.get("unit", "")
            q = float(s.get("quality", 1.0))

            register_address = int(s["register_address"])
            register_count = int(s.get("register_count", 1))
            scale = float(s.get("scale", 1.0))
            offset = float(s.get("offset", 0.0))

            def _do_read() -> float:
                regs = self._read_registers_sync(register_address, register_count)
                raw = float(regs[0])
                return raw * scale + offset

            try:
                value_f = await loop.run_in_executor(None, _do_read)
            except Exception as exc:
                log.warning(
                    "MODBUS_READ_FAIL",
                    host=self.host,
                    sensor_id=sensor_id,
                    address=register_address,
                    error=str(exc),
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

