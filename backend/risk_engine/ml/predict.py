import joblib
import numpy as np
from pathlib import Path


MODEL_PATH = (
    Path(__file__).resolve().parent
    / "model_store"
    / "risk_model.pkl"
)


FEATURES = [
    "land_area_hectares",
    "affected_families",
    "compensation_disbursed_pct",
    "legal_disputes_count",
    "approval_delay_days",
    "possession_status_pct",
    "rehabilitation_progress_pct",
    "stakeholder_responsiveness_score",
]


RECOMMENDATIONS = {
    "compensation_disbursed_pct":
        "Expedite pending compensation disbursement to affected families.",

    "legal_disputes_count":
        "Prioritize legal dispute resolution via fast-track land tribunals.",

    "approval_delay_days":
        "Escalate pending administrative approvals to the nodal department.",

    "rehabilitation_progress_pct":
        "Accelerate R&R site allotment and infrastructure works.",

    "stakeholder_responsiveness_score":
        "Increase stakeholder engagement frequency and grievance redressal.",

    "possession_status_pct":
        "Deploy additional field teams to complete land possession.",
}


def _risk_band(prob):
    if prob < 0.25:
        return "Low"

    if prob < 0.50:
        return "Medium"

    if prob < 0.75:
        return "High"

    return "Critical"


def predict_for_project(project):

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Risk model not found at: {MODEL_PATH}"
        )

    model = joblib.load(MODEL_PATH)

    # Use float() to coerce Decimal fields, and fall back to 0 for any
    # null/None values — avoids numpy ValueError: "float() argument must be
    # a string or a number, not NoneType".
    row = np.array(
        [[
            float(getattr(project, feature) or 0)
            for feature in FEATURES
        ]],
        dtype=float,
    )

    prob = float(
        model.predict_proba(row)[0][1]
    )

    importances = model.feature_importances_

    ranked = sorted(
        zip(FEATURES, importances),
        key=lambda x: x[1],
        reverse=True,
    )[:3]

    top_factors = [
        {
            "factor": feature,
            "importance": round(float(importance), 3),
        }
        for feature, importance in ranked
    ]

    recommendations = [
        RECOMMENDATIONS.get(
            feature,
            f"Review {feature}.",
        )
        for feature, _ in ranked
    ]

    return {
        "risk_score": round(prob * 100, 1),
        "delay_probability": round(prob, 3),
        "risk_band": _risk_band(prob),
        "top_factors": top_factors,
        "recommendations": recommendations,
    }