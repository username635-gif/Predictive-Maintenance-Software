"""
XGBoost Remaining Useful Life Predictor

Production: loads XGBoost model via joblib and a pre-computed SHAP explainer.
This stub returns realistic RUL values and SHAP feature importances
for demo and integration testing.
"""
from __future__ import annotations

import time
import numpy as np

from schemas import SensorWindow, RULResponse, ExplanationFeature

_rng = np.random.default_rng(seed=99)

# Segment-specific RUL overrides for the demo narrative
_SEGMENT_RUL: dict[str, tuple[int, int, int]] = {
    "SEG-021": (14, 9, 21),
    "SEG-022": (28, 18, 42),
    "SEG-036": (0, 0, 3),
    "SEG-015": (67, 45, 92),
    "SEG-043": (82, 60, 115),
}


def _rul_from_features(payload: SensorWindow) -> tuple[int, int, int]:
    """Compute RUL (days) and 90% CI from sensor features."""
    # Base: infinite life (365d) degraded by feature signals
    base = 365

    if payload.wall_thickness_mm is not None:
        # Wall loss fraction below nominal (10.2 mm)
        loss_frac = max(0.0, (10.2 - payload.wall_thickness_mm) / 10.2)
        base -= int(loss_frac * 300)

    if payload.cp_potential_mv is not None:
        under_prot = max(0.0, -720 - payload.cp_potential_mv) / 200
        base -= int(under_prot * 80)

    if payload.flow_balance_pct is not None and abs(payload.flow_balance_pct) > 1.0:
        base -= 150  # likely leak

    rul = max(0, base + int(_rng.normal(0, 8)))
    lower = max(0, rul - int(_rng.uniform(10, 25)))
    upper = rul + int(_rng.uniform(10, 30))
    return rul, lower, upper


class RULPredictor:
    MODEL_VERSION = "xgb_rul_v3"

    def __init__(self):
        # Production: self.model = joblib.load("models/xgb_rul.joblib")
        #             self.explainer = shap.TreeExplainer(self.model)
        self._call_count = 0

    def predict(self, payload: SensorWindow) -> RULResponse:
        t0 = time.perf_counter()
        self._call_count += 1

        seg = payload.segment_id
        if seg in _SEGMENT_RUL:
            rul, lower, upper = _SEGMENT_RUL[seg]
        else:
            rul, lower, upper = _rul_from_features(payload)

        # Build SHAP explanation
        shap_features = _build_explanation(payload, rul)

        failure_mode = _failure_mode(payload, rul)
        confidence = round(min(0.97, 0.60 + _rng.uniform(0, 0.3)), 2)

        elapsed = (time.perf_counter() - t0) * 1000

        return RULResponse(
            segment_id=seg,
            rul_days=rul,
            rul_lower=lower,
            rul_upper=upper,
            failure_mode=failure_mode,
            model_confidence=confidence,
            shap_features=shap_features,
            model_version=self.MODEL_VERSION,
            inference_ms=round(elapsed, 2),
        )


def _failure_mode(payload: SensorWindow, rul: int) -> str:
    if payload.flow_balance_pct is not None and abs(payload.flow_balance_pct) > 1.0:
        return "Active HC release — DAS + flow balance confirmation"
    if rul < 30:
        return "External wall loss leading to pinhole leak"
    if payload.cp_potential_mv is not None and payload.cp_potential_mv > -750:
        return "CP under-protection enabling corrosion onset"
    return "Progressive wall thinning — monitoring advised"


def _build_explanation(payload: SensorWindow, rul: int) -> list[ExplanationFeature]:
    feats = []

    if payload.wall_thickness_mm is not None:
        loss = round(10.2 - payload.wall_thickness_mm, 2)
        feats.append(ExplanationFeature(
            feature="UT Wall Thickness Trend (30d)",
            contribution=38,
            direction="positive",
            value=f"−{loss} mm/month",
        ))

    if payload.cp_potential_mv is not None:
        mV = int(payload.cp_potential_mv)
        status = "under-protected" if mV > -850 else "adequate"
        feats.append(ExplanationFeature(
            feature="CP Potential Deviation",
            contribution=27,
            direction="positive" if mV > -850 else "negative",
            value=f"{mV} mV ({status})",
        ))

    if payload.das_rms_level is not None and payload.das_rms_level > 5e5:
        feats.append(ExplanationFeature(
            feature="Fiber-Optic DAS (Acoustic)",
            contribution=52,
            direction="positive",
            value=f"Leak signature {payload.das_rms_level:.1e}",
        ))
    elif rul < 60:
        feats.append(ExplanationFeature(
            feature="Acoustic Emission Count",
            contribution=19,
            direction="positive",
            value="142 events/day ↑",
        ))

    if payload.soil_resistivity_ohm_cm is not None:
        feats.append(ExplanationFeature(
            feature="Soil Resistivity (GIS layer)",
            contribution=11,
            direction="positive",
            value=f"{int(payload.soil_resistivity_ohm_cm)} Ω·cm (corrosive)",
        ))

    if not feats:
        feats.append(ExplanationFeature(
            feature="No significant anomaly features",
            contribution=0,
            direction="negative",
            value="All parameters nominal",
        ))

    return feats
