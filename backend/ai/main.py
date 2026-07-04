"""
ReliabilityOS AI Service — FastAPI
Provides three ML endpoints:
  POST /predict/anomaly   — LSTM Autoencoder anomaly scoring
  POST /predict/rul       — XGBoost Remaining Useful Life regression
  POST /predict/root-cause — Random Forest root-cause classification
  POST /predict/leak      — Probabilistic fusion leak detector

All models use lightweight in-memory stubs that mimic real model behaviour.
Replace model.predict() calls with loaded ONNX/joblib models for production.
"""

from __future__ import annotations

import time
import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from models.anomaly_detector import AnomalyDetector
from models.rul_predictor import RULPredictor
from models.root_cause_classifier import RootCauseClassifier
from models.leak_detector import LeakDetector
from schemas import (
    SensorWindow,
    AnomalyResponse,
    RULResponse,
    RootCauseResponse,
    LeakResponse,
    FeedbackPayload,
)

# ─────────────────────────────── Structured Logging ──────────────────────────
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ]
)
log = structlog.get_logger()

# ─────────────────────────────── Model Registry ───────────────────────────────
models: dict = {}

# ─────────────────────────────── Provenance Registry ─────────────────────────
from ai_service.model_registry import get_model_metadata


def _provenance_response(model_key: str, validation_note: str) -> dict:
    meta = get_model_metadata(model_key)
    return {
        "version": meta.model_version,
        "validated": False,
        "validation_note": validation_note,
        "training_data_description": meta.training_data_description,
        "validation_method": meta.validation_method,
        "last_validated_date": meta.last_validated_date,
        "precision": meta.precision,
        "recall": meta.recall,
        "false_positive_rate": meta.false_positive_rate,
    }







@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Loading AI models…")
    t0 = time.time()
    models["anomaly"] = AnomalyDetector()
    models["rul"] = RULPredictor()
    models["root_cause"] = RootCauseClassifier()
    models["leak"] = LeakDetector()
    log.info("Models ready", elapsed_ms=round((time.time() - t0) * 1000))
    yield
    log.info("AI service shutting down — releasing model memory")
    models.clear()


# ─────────────────────────────── App ─────────────────────────────────────────
app = FastAPI(
    title="ReliabilityOS AI Service",
    description="Predictive Maintenance ML Inference API for Oil & Gas Pipelines",
    version="1.0.0",
    lifespan=lifespan,
)

Instrumentator().instrument(app).expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────── Health ├──────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": list(models.keys()),
        "timestamp": time.time(),
    }


# ─────────────────────────────── Anomaly Detection ───────────────────────────
@app.post("/predict/anomaly")
def predict_anomaly(payload: SensorWindow):

    """
    Input: sliding window of multi-variate sensor readings (last N timesteps).
    Output: anomaly score 0–1 and binary flag.
    """
    try:
        prediction = models["anomaly"].predict(payload)
        log.info("anomaly_prediction", segment=payload.segment_id, score=prediction.anomaly_score)
        return {
            "prediction": prediction,
            "model_metadata": _provenance_response(
                model_key="anomaly",
                validated=False,
                validation_note="Trained on synthetic/demo scenarios only; pending real failure-history validation.",
            ),
        }
    except Exception as exc:
        log.error("anomaly_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc



# ─────────────────────────────── RUL Prediction ──────────────────────────────
@app.post("/predict/rul")
def predict_rul(payload: SensorWindow):

    """
    Input: engineered features from sensor window.
    Output: predicted RUL in days with 90% confidence interval.
    """
    try:
        prediction = models["rul"].predict(payload)
        log.info("rul_prediction", segment=payload.segment_id, rul_days=prediction.rul_days)
        return {
            "prediction": prediction,
            "model_metadata": _provenance_response(
                model_key="rul",
                validated=False,
                validation_note="Trained on synthetic scenarios only; pending real failure-history validation.",
            ),
        }

    except Exception as exc:
        log.error("rul_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ─────────────────────────────── Root Cause Classification ───────────────────
@app.post("/predict/root-cause", response_model=RootCauseResponse)
def predict_root_cause(payload: SensorWindow):
    """
    Multi-label classification of failure root causes with SHAP explanations.
    """
    try:
        prediction = models["root_cause"].predict(payload)
        log.info(
            "root_cause_prediction",
            segment=payload.segment_id,
            top=prediction.root_causes[0].cause,
        )
        return {
            "prediction": prediction,
            "model_metadata": _provenance_response(
                model_key="root_cause",
                validated=False,
                validation_note="Trained on synthetic failure modes mapped to simulated sensor patterns; pending real failure-history validation.",
            ),
        }

    except Exception as exc:
        log.error("root_cause_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ─────────────────────────────── Leak Detection ──────────────────────────────
@app.post("/predict/leak", response_model=LeakResponse)
def predict_leak(payload: SensorWindow):
    """
    Probabilistic sensor fusion for leak detection from DAS + flow balance + pressure.
    """
    try:
        prediction = models["leak"].predict(payload)
        if prediction.is_leak:
            log.warning("LEAK_DETECTED", segment=payload.segment_id, confidence=prediction.confidence)
        return {
            "prediction": prediction,
            "model_metadata": _provenance_response(
                model_key="leak",
                validated=False,
                validation_note="Calibrated on synthetic leak/no-leak simulations and Bayesian priors; pending real leak-history validation.",
            ),
        }
    except Exception as exc:
        log.error("leak_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc



# ─────────────────────────────── Feedback Loop ───────────────────────────────
@app.post("/feedback")
def record_feedback(payload: FeedbackPayload):
    """
    Record technician ground-truth for model re-training.
    In production, appends to a training dataset and triggers refit.
    """
    log.info(
        "feedback_received",
        prediction_id=payload.prediction_id,
        was_correct=payload.was_correct,
        actual_cause=payload.actual_root_cause,
    )
    return {"status": "accepted", "message": "Feedback queued for next training cycle."}
