from __future__ import annotations

from typing import Any, Dict


def to_unified_mqtt_payload(*, reading: Dict[str, Any], gateway_id: str, group_id: str) -> Dict[str, Any]:
    """Ensure payload includes the unified schema fields.

    This is a thin helper to keep schema consistent across adapter sources.
    """

    payload = dict(reading)

    # New traceability field; adapters should set it, but keep a fallback.
    payload.setdefault("source", "")
    payload["gateway_id"] = gateway_id
    payload["group_id"] = group_id
    return payload

