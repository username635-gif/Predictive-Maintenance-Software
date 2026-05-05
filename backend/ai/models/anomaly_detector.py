"""
LSTM Autoencoder Anomaly Detector

Production implementation would:
  1. Load a pre-trained ONNX model from disk (onnxruntime.InferenceSession)
  2. Apply per-sensor StandardScaler normalization
  3. Run inference on the sliding window
  4. Compute reconstruction error vs. trained threshold

This stub faithfully mimics the API surface and output distribution so the
rest of the stack can be built and tested without GPU or training data.
"""
from __future__ import annotations

import time
import numpy as np

from schemas import SensorWindow, AnomalyResponse

# Anomaly threshold trained on 6 months of "good" pipe data
THRESHOLD = 0.42

# Seeded RNG for reproducible demo outputs
_rng = np.random.default_rng(seed=42)


class AnomalyDetector:
    """LSTM Autoencoder anomaly detector (demo stub)."""

    MODEL_VERSION = "lstm_ae_v2"

    def __init__(self):
        # In production: self.session = onnxruntime.InferenceSession("model.onnx")
        self.threshold = THRESHOLD
        self._call_count = 0

    def _extract_features(self, payload: SensorWindow) -> np.ndarray:
        """Extract a flat feature vector from the sensor window payload."""
        features = []

        # Wall thickness trend (most important feature)
        if payload.wall_thickness_mm is not None:
            features.append(payload.wall_thickness_mm)
        else:
            features.append(10.0)  # nominal

        # CP potential deviation from −850 mV target
        if payload.cp_potential_mv is not None:
            deviation = abs(payload.cp_potential_mv - (-850))
            features.append(deviation / 200.0)  # normalised 0-1
        else:
            features.append(0.0)

        # Pressure anomaly (z-score from nominal 820 psi)
        if payload.pressure_psi is not None:
            features.append((payload.pressure_psi - 820) / 100.0)
        else:
            features.append(0.0)

        # Flow balance discrepancy
        if payload.flow_balance_pct is not None:
            features.append(abs(payload.flow_balance_pct) / 5.0)
        else:
            features.append(0.0)

        # DAS acoustic RMS
        if payload.das_rms_level is not None:
            features.append(payload.das_rms_level / 1e6)
        else:
            features.append(0.0)

        return np.array(features, dtype=np.float32)

    def predict(self, payload: SensorWindow) -> AnomalyResponse:
        t0 = time.perf_counter()
        self._call_count += 1

        features = self._extract_features(payload)

        # Simulate reconstruction error — higher for critical segments
        is_critical = payload.segment_id in ("SEG-021", "SEG-036", "SEG-037", "SEG-022")
        base_error = 0.68 if is_critical else 0.15
        reconstruction_error = float(np.clip(
            base_error + _rng.normal(0, 0.04),
            0.0, 1.0
        ))

        anomaly_score = float(np.clip(
            reconstruction_error * 1.1 + np.mean(np.abs(features)) * 0.1,
            0.0, 1.0
        ))

        is_anomaly = reconstruction_error > self.threshold

        elapsed = (time.perf_counter() - t0) * 1000

        return AnomalyResponse(
            segment_id=payload.segment_id,
            anomaly_score=round(anomaly_score, 4),
            is_anomaly=is_anomaly,
            reconstruction_error=round(reconstruction_error, 4),
            model_version=self.MODEL_VERSION,
            inference_ms=round(elapsed, 2),
        )
