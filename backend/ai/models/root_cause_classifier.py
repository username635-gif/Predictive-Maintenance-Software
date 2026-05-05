"""
Random Forest Root-Cause Classifier

Classifies failure mechanisms: external corrosion, internal corrosion,
CP failure, mechanical damage, weld defect, third-party damage, etc.

Production: joblib.load the trained RandomForestClassifier + LabelEncoder.
"""
from __future__ import annotations

import time

from schemas import SensorWindow, RootCauseResponse, RULCause, ExplanationFeature

_CAUSES = [
    "External Corrosion (Soil)",
    "Internal Corrosion (CO₂)",
    "Coating Disbondment",
    "Cathodic Protection Failure",
    "Anode Depletion",
    "Mechanical Damage",
    "Weld Seam Defect",
    "Microbiologically Influenced Corrosion",
    "Third-Party Damage",
    "Erosion-Corrosion",
    "Stress Corrosion Cracking",
    "Pinhole Leak (Active)",
]

_SEGMENT_RC: dict[str, list[RULCause]] = {
    "SEG-021": [
        RULCause(cause="External Corrosion (Soil)", probability=0.74),
        RULCause(cause="Coating Disbondment", probability=0.18),
        RULCause(cause="Stray Current", probability=0.08),
    ],
    "SEG-036": [
        RULCause(cause="Pinhole Leak (Active)", probability=0.89),
        RULCause(cause="Weld Seam Defect", probability=0.07),
        RULCause(cause="Third-Party Damage", probability=0.04),
    ],
    "SEG-015": [
        RULCause(cause="Internal Corrosion (CO₂)", probability=0.62),
        RULCause(cause="Erosion-Corrosion", probability=0.28),
        RULCause(cause="Microbiologically Influenced Corrosion", probability=0.10),
    ],
    "SEG-043": [
        RULCause(cause="Cathodic Protection Failure", probability=0.71),
        RULCause(cause="Anode Depletion", probability=0.21),
        RULCause(cause="Coating Disbondment", probability=0.08),
    ],
}

_RC_EXPLANATION: dict[str, list[ExplanationFeature]] = {
    "External Corrosion (Soil)": [
        ExplanationFeature(feature="CP Potential Deviation", contribution=32, direction="positive", value="−720 mV (under-protected)"),
        ExplanationFeature(feature="Soil Resistivity", contribution=28, direction="positive", value="320 Ω·cm (corrosive)"),
        ExplanationFeature(feature="Coating Age Interaction", contribution=20, direction="positive", value="15-year coating, disbonded 2 sites"),
        ExplanationFeature(feature="UT Thickness Trend", contribution=14, direction="positive", value="Outside (top quadrant)"),
        ExplanationFeature(feature="AE Frequency Spectrum", contribution=6, direction="positive", value="Low-freq corrosion signature"),
    ],
    "Pinhole Leak (Active)": [
        ExplanationFeature(feature="Fiber-Optic DAS (Acoustic)", contribution=52, direction="positive", value="Leak signature 2.4×10⁶ magnitude"),
        ExplanationFeature(feature="Flow Balance Discrepancy", contribution=28, direction="positive", value="−1.8% vs inlet"),
        ExplanationFeature(feature="Pressure Drop Rate", contribution=13, direction="positive", value="−4.2 psi/hr anomalous"),
        ExplanationFeature(feature="AE Frequency Spectrum", contribution=7, direction="positive", value="Turbulent flow signature"),
    ],
}


class RootCauseClassifier:
    MODEL_VERSION = "rf_rc_v2"

    def __init__(self):
        self._call_count = 0

    def predict(self, payload: SensorWindow) -> RootCauseResponse:
        t0 = time.perf_counter()
        self._call_count += 1

        seg = payload.segment_id
        if seg in _SEGMENT_RC:
            causes = _SEGMENT_RC[seg]
        else:
            causes = [
                RULCause(cause="External Corrosion (Soil)", probability=0.45),
                RULCause(cause="Coating Disbondment", probability=0.33),
                RULCause(cause="Cathodic Protection Failure", probability=0.22),
            ]

        top = causes[0].cause
        explanation = _RC_EXPLANATION.get(top, [
            ExplanationFeature(feature="Multiple sensor signals", contribution=60, direction="positive", value="Combined anomaly"),
            ExplanationFeature(feature="Historical PIG findings", contribution=25, direction="positive", value="Prior corrosion sites"),
            ExplanationFeature(feature="Asset age × environment", contribution=15, direction="positive", value="High corrosivity zone"),
        ])

        severity = "critical" if causes[0].probability > 0.7 else "high" if causes[0].probability > 0.5 else "medium"
        elapsed = (time.perf_counter() - t0) * 1000

        return RootCauseResponse(
            segment_id=seg,
            root_causes=causes,
            top_cause=top,
            severity=severity,
            shap_explanation=explanation,
            model_version=self.MODEL_VERSION,
            inference_ms=round(elapsed, 2),
        )
