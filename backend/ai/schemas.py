"""Pydantic schemas for all AI service endpoints."""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class SensorReading(BaseModel):
    sensor_id: str
    sensor_type: str
    value: float
    unit: str
    timestamp: str
    quality: float = Field(default=1.0, ge=0.0, le=1.0)


class PIGFinding(BaseModel):
    mile_marker: float
    metal_loss_percent: float
    depth_mm: float
    feature_type: str


class SensorWindow(BaseModel):
    """Multi-variate sensor window sent from the edge or API gateway."""
    segment_id: str
    pipeline_id: str = "WTPL-001"
    window_readings: List[List[SensorReading]]  # [timestep][sensor]
    latest_readings: List[SensorReading]
    wall_thickness_mm: Optional[float] = None
    cp_potential_mv: Optional[float] = None
    pressure_psi: Optional[float] = None
    flow_balance_pct: Optional[float] = None      # (inlet - outlet) / inlet
    das_rms_level: Optional[float] = None         # fiber-optic DAS RMS amplitude
    water_cut_pct: Optional[float] = None
    co2_partial_pressure_psi: Optional[float] = None
    last_pig_run_days_ago: Optional[int] = None
    pig_max_metal_loss_pct: Optional[float] = None
    installation_year: Optional[int] = None
    soil_resistivity_ohm_cm: Optional[float] = None


# ─────────── Response schemas ─────────────────────────────────────────────────

class AnomalyResponse(BaseModel):
    segment_id: str
    anomaly_score: float = Field(ge=0.0, le=1.0)
    is_anomaly: bool
    reconstruction_error: float
    model_version: str = "lstm_ae_v2"
    inference_ms: float


class RULCause(BaseModel):
    cause: str
    probability: float


class ExplanationFeature(BaseModel):
    feature: str
    contribution: float
    direction: str  # 'positive' | 'negative'
    value: str


class RULResponse(BaseModel):
    segment_id: str
    rul_days: int
    rul_lower: int   # 90% CI lower bound
    rul_upper: int   # 90% CI upper bound
    failure_mode: str
    model_confidence: float
    shap_features: List[ExplanationFeature]
    model_version: str = "xgb_rul_v3"
    inference_ms: float


class RootCauseResponse(BaseModel):
    segment_id: str
    root_causes: List[RULCause]
    top_cause: str
    severity: str
    shap_explanation: List[ExplanationFeature]
    model_version: str = "rf_rc_v2"
    inference_ms: float


class LeakResponse(BaseModel):
    segment_id: str
    is_leak: bool
    confidence: float = Field(ge=0.0, le=1.0)
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    uncertainty_radius_m: Optional[float] = None
    triggering_sensors: List[str]
    model_version: str = "fusion_v1"
    inference_ms: float


class FeedbackPayload(BaseModel):
    prediction_id: str
    was_correct: bool
    actual_root_cause: Optional[str] = None
    technician_notes: Optional[str] = None
    corrected_rul: Optional[int] = None
