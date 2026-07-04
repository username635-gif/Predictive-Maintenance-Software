from __future__ import annotations

from typing import Any, Dict

from edge.adapters.modbus_adapter import ModbusAdapter
from edge.adapters.opcua_adapter import OpcUaAdapter
from edge.adapters.simulator_adapter import SimulatorAdapter
from edge.sensor_adapter import SensorAdapter



def create_adapter(cfg: Dict[str, Any]) -> SensorAdapter:
    adapter_type = (cfg.get("adapter") or "").lower()

    if adapter_type == "opcua":
        return OpcUaAdapter(
            endpoint=cfg["endpoint"],
            sensors=cfg.get("sensors", []),
            unit=cfg.get("unit", ""),
            quality=float(cfg.get("quality", 1.0)),
        )

    if adapter_type == "modbus":
        return ModbusAdapter(
            host=cfg["host"],
            port=int(cfg.get("port", 502)),
            unit_id=int(cfg.get("unit_id", 1)),
            register_type=cfg.get("register_type", "holding"),
            sensors=cfg.get("sensors", []),
        )

    if adapter_type == "simulator":
        return SimulatorAdapter(sensors=cfg.get("sensors", []))

    raise ValueError(f"Unsupported adapter type: {adapter_type}")


