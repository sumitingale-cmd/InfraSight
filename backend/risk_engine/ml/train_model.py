import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split


MODEL_DIR = Path(__file__).resolve().parent / "model_store"
MODEL_DIR.mkdir(exist_ok=True)


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


def train():
    from projects.models import LandProject

    qs = (
        LandProject.objects
        .exclude(is_delayed_historical__isnull=True)
        .values(*FEATURES, "is_delayed_historical")
    )

    df = pd.DataFrame.from_records(qs)

    if len(df) < 30:
        raise ValueError(
            "Need at least ~30 labeled historical projects "
            "to train a usable model."
        )

    X = df[FEATURES]
    y = df["is_delayed_historical"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=8,
        random_state=42,
    )

    model.fit(X_train, y_train)

    accuracy = model.score(X_test, y_test)

    joblib.dump(
        model,
        MODEL_DIR / "risk_model.pkl",
    )

    from risk_engine.models import ModelVersion

    ModelVersion.objects.create(
        accuracy=accuracy,
        training_sample_size=len(df),
    )

    return accuracy