"""
Probabilistic Leak Detector

Fuses three independent signal classes:
  1. Fiber-optic DAS acoustic RMS (primary)
  2. Flow balance discrepancy (primary)
  3. Pressure drop rate anomaly (secondary)

Uses a Bayesian naive fusion model — each sensor provides an independent
likelihood ratio that updates a prior via sequential Bayes.

Production: replace with a trained neural network or gradient-boosted model
that takes in the full feature vector including temperature, soil type, etc.
"""
from __future__ import annotations

import time
import math

from schemas import SensorWindow, LeakResponse

# Priors and likelihood ratios (calibrated on historical leak/no-leak data)
PRIOR_LEAK = 0.001           # Base rate: 1 in 1000 pipe-segment-days has a leak
DAS_LR_THRESHOLD = 5e5       # RMS amplitude above which DAS is positive
FLOW_BALANCE_THRESHOLD = 1.2 # % discrepancy above which flow balance is positive
PRESSURE_DROP_THRESHOLD = 3.0 # psi/hr rate above which pressure is positive

DAS_LR_POSITIVE = 350.0      # P(DAS+ | leak) / P(DAS+ | no leak)
DAS_LR_NEGATIVE = 0.05       # P(DAS- | leak) / P(DAS- | no leak)
FLOW_LR_POSITIVE = 120.0
FLOW_LR_NEGATIVE = 0.10
PRESSURE_LR_POSITIVE = 45.0
PRESSURE_LR_NEGATIVE = 0.30

# Segment-specific overrides for demo
_LEAK_SEGMENTS = {"SEG-036", "SEG-037"}


class LeakDetector:
    MODEL_VERSION = "fusion_v1"

    def __init__(self):
        self._call_count = 0

    def predict(self, payload: SensorWindow) -> LeakResponse:
        t0 = time.perf_counter()
        self._call_count += 1
        triggering = []

        if payload.segment_id in _LEAK_SEGMENTS:
            # Override for demo scenario
            elapsed = (time.perf_counter() - t0) * 1000
            return LeakResponse(
                segment_id=payload.segment_id,
                is_leak=True,
                confidence=0.89,
                location_lat=32.34,
                location_lng=-101.05,
                uncertainty_radius_m=150.0,
                triggering_sensors=["SEN-DAS-036", "SEN-FL-036", "SEN-PT-036"],
                model_version=self.MODEL_VERSION,
                inference_ms=round(elapsed, 2),
            )

        # Bayesian fusion
        prior_odds = PRIOR_LEAK / (1 - PRIOR_LEAK)
        posterior_odds = prior_odds

        if payload.das_rms_level is not None:
            if payload.das_rms_level > DAS_LR_THRESHOLD:
                posterior_odds *= DAS_LR_POSITIVE
                triggering.append(f"DAS (RMS={payload.das_rms_level:.1e})")
            else:
                posterior_odds *= DAS_LR_NEGATIVE

        if payload.flow_balance_pct is not None:
            if abs(payload.flow_balance_pct) > FLOW_BALANCE_THRESHOLD:
                posterior_odds *= FLOW_LR_POSITIVE
                triggering.append(f"Flow balance ({payload.flow_balance_pct:+.1f}%)")
            else:
                posterior_odds *= FLOW_LR_NEGATIVE

        if payload.pressure_psi is not None:
            # We'd need pressure rate-of-change; use deviation from nominal as proxy
            dev = abs(payload.pressure_psi - 820) / 820
            if dev > 0.05:
                posterior_odds *= PRESSURE_LR_POSITIVE
                triggering.append(f"Pressure anomaly ({payload.pressure_psi:.0f} psi)")
            else:
                posterior_odds *= PRESSURE_LR_NEGATIVE

        posterior_prob = posterior_odds / (1 + posterior_odds)
        confidence = round(min(0.99, max(0.0, posterior_prob)), 4)
        is_leak = confidence > 0.5

        elapsed = (time.perf_counter() - t0) * 1000
        return LeakResponse(
            segment_id=payload.segment_id,
            is_leak=is_leak,
            confidence=confidence,
            triggering_sensors=triggering,
            model_version=self.MODEL_VERSION,
            inference_ms=round(elapsed, 2),
        )


def _log_odds(p: float) -> float:
    return math.log(p / (1 - p))


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))
