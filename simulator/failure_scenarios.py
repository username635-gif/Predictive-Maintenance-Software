"""
Failure Scenarios

Predefined failure scenarios for the data simulator.
Each scenario overrides specific sensor values to mimic failure progression.

Scenarios:
  baseline               — Normal operation (default)
  corrosion_critical     — SEG-021 reaching end-of-life (14d RUL)
  leak_active            — Active pinhole leak at SEG-036 (demo highlight)
  pressure_surge         — Pressure surge event at SEG-028
  cp_failure             — Gradual CP system failure at SEG-043
  sensor_storm           — Multiple sensor outages (stress test)
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FailureScenario:
    name: str
    description: str
    # Maps sensor_id → (tick_start, tick_end, override_value_fn)
    _overrides: dict[str, list[tuple[int, int, "OverrideFn"]]] = field(default_factory=dict)

    def get_override(self, sensor_id: str, tick: int) -> Optional[float]:
        for tick_start, tick_end, fn in self._overrides.get(sensor_id, []):
            if tick_start <= tick <= tick_end:
                return fn(tick - tick_start)
        return None


# Type alias
OverrideFn = callable  # (relative_tick: int) -> float


def _ramp(start: float, end: float, ticks: int) -> OverrideFn:
    """Linear ramp from start to end over `ticks` ticks."""
    def fn(t: int) -> float:
        frac = min(t / max(ticks, 1), 1.0)
        return start + frac * (end - start)
    return fn


def _step(value: float) -> OverrideFn:
    """Constant override value."""
    return lambda t: value


def _sinusoidal(baseline: float, amplitude: float, period_ticks: int) -> OverrideFn:
    return lambda t: baseline + amplitude * math.sin(2 * math.pi * t / period_ticks)


# ─────────────────────────────── Scenario Definitions ─────────────────────────

def _build_corrosion_critical() -> FailureScenario:
    sc = FailureScenario(
        name="corrosion_critical",
        description="SEG-021 approaching failure — wall thinning + CP under-protection (14d RUL)",
    )
    # UT thickness on SEG-021 ramps from 7.2 → 6.5 mm over 750 ticks (~25 min at 2s)
    sc._overrides["SEN-0081"] = [(0, 750, _ramp(7.2, 6.5, 750))]
    # CP potential drifting less negative (worse protection)
    sc._overrides["SEN-0084"] = [(0, 750, _ramp(-740, -710, 750))]
    # AE count rising
    sc._overrides["SEN-0083"] = [(0, 750, _ramp(48, 78, 750))]
    return sc


def _build_leak_active() -> FailureScenario:
    sc = FailureScenario(
        name="leak_active",
        description="Active pinhole leak at SEG-036 — DAS spike + flow balance discrepancy",
    )
    # Pressure drops ~12 psi over 120 ticks then stabilises
    sc._overrides["SEN-0142"] = [(0, 120, _ramp(820, 808, 120)), (121, 999, _step(808))]
    # DAS amplitude spikes at tick 10 (leak onset)
    sc._overrides["SEN-0143"] = [(10, 999, _step(92.0))]
    return sc


def _build_pressure_surge() -> FailureScenario:
    sc = FailureScenario(
        name="pressure_surge",
        description="Pressure surge event at SEG-028 — slam-shut valve response",
    )
    # Sinusoidal pressure surge: 820 → 1020 → back over 100 ticks
    sc._overrides["SEN-0110"] = [(0, 100, _sinusoidal(920, 100, 50))]
    return sc


def _build_cp_failure() -> FailureScenario:
    sc = FailureScenario(
        name="cp_failure",
        description="CP rectifier failure at SEG-043 — gradual voltage loss",
    )
    # CP voltage drifts from -850 to -650 mV over 600 ticks
    sc._overrides["SEN-0172"] = [(0, 600, _ramp(-850, -650, 600))]
    return sc


def _build_sensor_storm() -> FailureScenario:
    sc = FailureScenario(
        name="sensor_storm",
        description="Multiple sensor outages — edge gateway stress test",
    )
    # Several sensors go to zero (offline) in a rolling pattern
    for sensor_n in [20, 21, 22, 45, 46, 78, 79]:
        sid = f"SEN-{sensor_n:04d}"
        sc._overrides[sid] = [(50, 200, _step(0.0))]
    return sc


SCENARIOS: dict[str, FailureScenario] = {
    "corrosion_critical": _build_corrosion_critical(),
    "leak_active": _build_leak_active(),
    "pressure_surge": _build_pressure_surge(),
    "cp_failure": _build_cp_failure(),
    "sensor_storm": _build_sensor_storm(),
}
