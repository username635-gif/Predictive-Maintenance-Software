"""Model registry for AI inference provenance.

This module centralizes model metadata returned alongside predictions.

IMPORTANT:
- Placeholder values are intentionally marked as "PENDING VALIDATION".
- We do NOT fabricate numeric performance metrics.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Literal, Dict


ValidationFlag = Literal["PENDING VALIDATION"]


@dataclass(frozen=True)
class ModelMetadata:
    model_version: str
    training_data_description: str
    validation_method: str
    last_validated_date: Optional[str]

    # Do not fabricate metrics.
    precision: Optional[float]
    recall: Optional[float]
    false_positive_rate: Optional[float]


# Registry keyed by model name used by the inference service.
MODEL_REGISTRY: Dict[str, ModelMetadata] = {
    "anomaly": ModelMetadata(
        model_version="lstm_ae_v2",
        training_data_description="Trained on synthetic and demo pipeline scenarios derived from nominal operating profiles; no confirmed field failure-event labels yet.",
        validation_method="not yet validated against real failure-history data (synthetic scenario holdout only)",
        last_validated_date=None,
        precision=None,
        recall=None,
        false_positive_rate=None,
    ),
    "rul": ModelMetadata(
        model_version="xgb_rul_v3",
        training_data_description="RUL training created from simulated degradation trajectories + synthetic sensor windows; real inspection-to-failure alignment pending.",
        validation_method="not yet validated against real failure-history data (synthetic scenario only)",
        last_validated_date=None,
        precision=None,
        recall=None,
        false_positive_rate=None,
    ),
    "root_cause": ModelMetadata(
        model_version="rf_rc_v2",
        training_data_description="Root-cause labels generated from synthetic failure modes mapped to simulated sensor patterns; field-labelled causality pending.",
        validation_method="not yet validated against real failure-history data (synthetic scenario only)",
        last_validated_date=None,
        precision=None,
        recall=None,
        false_positive_rate=None,
    ),
    "leak": ModelMetadata(
        model_version="fusion_v1",
        training_data_description="Calibrated on synthetic leak/no-leak simulations and Bayesian priors; real leak confirmation pending.",
        validation_method="not yet validated against real failure-history data (synthetic scenarios only)",
        last_validated_date=None,
        precision=None,
        recall=None,
        false_positive_rate=None,
    ),
}


def get_model_metadata(model_key: str) -> ModelMetadata:
    return MODEL_REGISTRY[model_key]

