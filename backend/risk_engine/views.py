import os
import pickle
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated

from projects.models import LandProject

from .models import (
    RiskPrediction,
    RiskPredictionLog,
    ActionItem,
)

from .ml.predict import predict_for_project

from .serializers import (
    ActionItemSerializer,
    ActionItemCreateSerializer,
    ProjectCreateSerializer,
    RiskPredictionLogSerializer,
)


# ============================================================
# MODEL CONFIGURATION
# ============================================================

MODEL_PATH = os.path.join(
    settings.BASE_DIR,
    "risk_engine",
    "ml",
    "model_store",
    "risk_model.pkl",
)

MODEL_VERSION = "v6.2"


# ============================================================
# PREDICT RISK
# ============================================================

class PredictRiskView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request, project_id):

        # ----------------------------------------------------
        # Find project
        # ----------------------------------------------------

        try:

            project = LandProject.objects.get(
                pk=project_id
            )

        except LandProject.DoesNotExist:

            return Response(
                {
                    "detail": "Project not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # ----------------------------------------------------
        # Run prediction
        # ----------------------------------------------------

        try:

            result = predict_for_project(
                project
            )

            # ------------------------------------------------
            # Save full prediction
            # ------------------------------------------------

            prediction = RiskPrediction.objects.create(
                project=project,
                **result,
            )

            # ------------------------------------------------
            # Save prediction history
            # ------------------------------------------------

            RiskPredictionLog.objects.create(
                project=project,
                risk_score=result["risk_score"],
                risk_band=result["risk_band"],
            )

            # ------------------------------------------------
            # Create ActionItem for High/Critical
            # ------------------------------------------------

            if prediction.risk_band in [
                "High",
                "Critical",
            ]:

                already_open = (
                    ActionItem.objects.filter(
                        project=project,
                        is_custom=False,
                        status__in=[
                            "pending",
                            "in_progress",
                            "overdue",
                        ],
                    ).exists()
                )

                if not already_open:

                    ActionItem.objects.create(

                        project=project,

                        title=(
                            f"{project.name} flagged "
                            f"{prediction.risk_band} risk "
                            "— review required"
                        ),

                        category="AI Risk Alert",

                        severity=(
                            prediction.risk_band.lower()
                        ),

                        status="pending",

                        ai_attribution=(
                            "Automatically generated "
                            "from the latest AI risk "
                            "prediction."
                        ),

                        evidence_notes=(
                            f"Predicted risk score: "
                            f"{prediction.risk_score}. "
                            f"Delay probability: "
                            f"{prediction.delay_probability}."
                        ),

                        assigned_authority=(
                            "Land Acquisition Authority"
                        ),

                        statutory_deadline=(
                            timezone.now().date()
                            + timedelta(days=14)
                        ),

                        execution_current=0,

                        execution_total=0,

                        model_influence_pct=None,

                        is_custom=False,
                    )

            # ------------------------------------------------
            # Return prediction
            # ------------------------------------------------

            return Response(
                result,
                status=status.HTTP_200_OK,
            )

        except Exception as exc:

            return Response(
                {
                    "detail": "Risk prediction failed.",
                    "error": str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ============================================================
# RISK PREDICTION HISTORY
# ============================================================

class RiskPredictionHistoryView(
    generics.ListAPIView
):

    serializer_class = RiskPredictionLogSerializer

    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        return (
            RiskPredictionLog.objects
            .filter(
                project_id=self.kwargs[
                    "project_id"
                ]
            )
            .order_by("-created_at")
        )


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

class DashboardSummaryView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        latest = (
            RiskPrediction.objects
            .select_related("project")
            .order_by("-predicted_at")[:200]
        )

        data = []

        for prediction in latest:

            project = prediction.project

            data.append(
                {
                    "project": project.name,
                    "state": project.state,
                    "district": project.district,
                    "lat": project.latitude,
                    "lng": project.longitude,
                    "risk_band": prediction.risk_band,
                    "risk_score": prediction.risk_score,
                }
            )

        return Response(data)


# ============================================================
# MODEL STATUS
# ============================================================

class ModelStatusView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        active = os.path.exists(
            MODEL_PATH
        )

        return Response(
            {
                "version": MODEL_VERSION,
                "active": active,
            }
        )


# ============================================================
# ACTION CENTER - SYNC
# ============================================================

def _sync_action_items():

    """
    Create an ActionItem for every project whose latest
    RiskPrediction is High or Critical.

    Existing open automatic actions are not duplicated.
    """

    latest_predictions = (
        RiskPrediction.objects
        .select_related("project")
        .order_by(
            "project_id",
            "-predicted_at",
        )
    )

    latest_by_project = {}

    # --------------------------------------------------------
    # Get latest prediction for each project
    # --------------------------------------------------------

    for prediction in latest_predictions:

        if prediction.project_id not in latest_by_project:

            latest_by_project[
                prediction.project_id
            ] = prediction

    # --------------------------------------------------------
    # Create actions
    # --------------------------------------------------------

    for prediction in latest_by_project.values():

        if prediction.risk_band not in [
            "High",
            "Critical",
        ]:
            continue

        project = prediction.project

        already_open = (
            ActionItem.objects.filter(
                project=project,
                is_custom=False,
                status__in=[
                    "pending",
                    "in_progress",
                    "overdue",
                ],
            ).exists()
        )

        if already_open:
            continue

        ActionItem.objects.create(

            project=project,

            title=(
                f"{project.name} flagged "
                f"{prediction.risk_band} risk "
                "— review required"
            ),

            category="AI Risk Alert",

            severity=(
                prediction.risk_band.lower()
            ),

            status="pending",

            ai_attribution=(
                "Automatically generated from "
                "the latest AI risk prediction."
            ),

            evidence_notes=(
                f"Predicted risk score: "
                f"{prediction.risk_score}. "
                f"Delay probability: "
                f"{prediction.delay_probability}."
            ),

            assigned_authority=(
                "Land Acquisition Authority"
            ),

            statutory_deadline=(
                timezone.now().date()
                + timedelta(days=14)
            ),

            execution_current=0,

            execution_total=0,

            model_influence_pct=None,

            is_custom=False,
        )


# ============================================================
# ACTION CENTER - LIST
# ============================================================

class ActionCenterListView(
    generics.ListAPIView
):

    serializer_class = ActionItemSerializer

    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        _sync_action_items()

        status_filter = (
            self.request.query_params.get(
                "status",
                "open",
            )
        )

        queryset = (
            ActionItem.objects
            .select_related("project")
            .all()
        )

        # ----------------------------------------------------
        # Open actions
        # ----------------------------------------------------

        if status_filter == "open":

            return queryset.exclude(
                status__in=[
                    "resolved",
                    "completed",
                ]
            )

        # ----------------------------------------------------
        # All actions
        # ----------------------------------------------------

        if status_filter == "all":

            return queryset

        # ----------------------------------------------------
        # Specific status
        # ----------------------------------------------------

        return queryset.filter(
            status=status_filter
        )


# ============================================================
# ACTION CENTER - CREATE CUSTOM ACTION
# ============================================================

class ActionItemCreateView(
    generics.CreateAPIView
):

    serializer_class = (
        ActionItemCreateSerializer
    )

    permission_classes = [
        IsAuthenticated
    ]

    def perform_create(
        self,
        serializer,
    ):

        serializer.save(
            is_custom=True
        )


# ============================================================
# ACTION CENTER - RESOLVE
# ============================================================

class ActionItemResolveView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request, pk):

        try:

            item = ActionItem.objects.get(
                pk=pk
            )

        except ActionItem.DoesNotExist:

            return Response(
                {
                    "detail": (
                        "Action item not found."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        item.status = "resolved"

        item.resolved_at = (
            timezone.now()
        )

        item.save(
            update_fields=[
                "status",
                "resolved_at",
            ]
        )

        return Response(
            ActionItemSerializer(item).data,
            status=status.HTTP_200_OK,
        )


# ============================================================
# CREATE PROJECT
# ============================================================

class ProjectCreateView(
    generics.CreateAPIView
):

    queryset = LandProject.objects.all()

    serializer_class = (
        ProjectCreateSerializer
    )

    permission_classes = [
        IsAuthenticated
    ]


# ============================================================
# PER-PROJECT ACTION ITEMS
# ============================================================

class ProjectActionItemsView(generics.ListAPIView):
    """
    GET /api/risk/action-center/project/<project_id>/
    Returns all ActionItems for a specific project, optionally filtered
    by ?status=open|all|pending|in_progress|overdue|completed|resolved
    """

    serializer_class = ActionItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs["project_id"]
        status_filter = self.request.query_params.get("status", "all")

        queryset = (
            ActionItem.objects
            .filter(project_id=project_id)
            .select_related("project")
            .order_by("-created_at")
        )

        if status_filter == "open":
            return queryset.exclude(status__in=["resolved", "completed"])

        if status_filter == "all":
            return queryset

        return queryset.filter(status=status_filter)


# ============================================================
# RISK EXPLAINABILITY / XAI
# ============================================================

class RiskExplainabilityView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
        project_id,
    ):

        # ----------------------------------------------------
        # Find project
        # ----------------------------------------------------

        try:

            project = LandProject.objects.get(
                pk=project_id
            )

        except LandProject.DoesNotExist:

            return Response(
                {
                    "detail": "Project not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # ----------------------------------------------------
        # Check model
        # ----------------------------------------------------

        if not os.path.exists(
            MODEL_PATH
        ):

            return Response(
                {
                    "detail": (
                        "Model not trained yet."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # ----------------------------------------------------
        # Load model (saved with joblib.dump — must use joblib.load,
        # pickle.load fails with "STACK_GLOBAL requires str")
        # ----------------------------------------------------

        try:

            import joblib

            model = joblib.load(MODEL_PATH)

        except Exception as exc:

            return Response(
                {
                    "detail": (
                        "Unable to load risk model."
                    ),
                    "error": str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # ----------------------------------------------------
        # Feature names
        # ----------------------------------------------------

        feature_names = list(
            getattr(
                model,
                "feature_names_in_",
                [],
            )
        )

        # ----------------------------------------------------
        # Feature importances
        # ----------------------------------------------------

        importances = getattr(
            model,
            "feature_importances_",
            None,
        )

        if (
            importances is None
            or len(importances) == 0
        ):

            return Response(
                {
                    "detail": (
                        "This model type doesn't "
                        "expose feature importances."
                    )
                },
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        # ----------------------------------------------------
        # Fallback names
        # ----------------------------------------------------

        if not feature_names:

            feature_names = [
                f"feature_{i}"
                for i in range(
                    len(importances)
                )
            ]

        # ----------------------------------------------------
        # Keep arrays same length
        # ----------------------------------------------------

        count = min(
            len(feature_names),
            len(importances),
        )

        feature_names = feature_names[
            :count
        ]

        importances = importances[
            :count
        ]

        # ----------------------------------------------------
        # Rank features
        # ----------------------------------------------------

        ranked = sorted(
            zip(
                feature_names,
                importances,
            ),
            key=lambda x: float(x[1]),
            reverse=True,
        )[:8]

        # ----------------------------------------------------
        # Maximum importance
        # ----------------------------------------------------

        max_importance = (
            max(
                float(importance)
                for _, importance in ranked
            )
            if ranked
            else 0
        )

        # ----------------------------------------------------
        # Feature response
        # ----------------------------------------------------

        features = []

        for name, importance in ranked:

            importance_value = float(
                importance
            )

            if max_importance > 0:

                direction = (
                    "increases_risk"
                    if importance_value
                    >= max_importance / 2
                    else "decreases_risk"
                )

            else:

                direction = "neutral"

            features.append(
                {
                    "name": (
                        str(name)
                        .replace("_", " ")
                        .title()
                    ),

                    "importance": round(
                        importance_value,
                        4,
                    ),

                    "direction": direction,
                }
            )

        # ----------------------------------------------------
        # Latest prediction
        # ----------------------------------------------------

        latest_prediction = (
            RiskPrediction.objects
            .filter(
                project=project
            )
            .order_by(
                "-predicted_at"
            )
            .first()
        )

        if latest_prediction:

            risk_band = (
                latest_prediction.risk_band
            )

            risk_score = (
                latest_prediction.risk_score
            )

        else:

            risk_band = "Unknown"

            risk_score = None

        # ----------------------------------------------------
        # Summary
        # ----------------------------------------------------

        if features:

            top_name = features[0]["name"]

            if risk_score is not None:

                summary = (
                    f"{project.name} is currently "
                    f"rated {risk_band} "
                    f"(score {risk_score}). "
                    f"The model weighs "
                    f"'{top_name}' most heavily "
                    "among the factors shown below."
                )

            else:

                summary = (
                    f"{project.name} does not have "
                    "a latest risk prediction yet. "
                    f"The model weighs "
                    f"'{top_name}' most heavily "
                    "among the factors shown below."
                )

        else:

            summary = (
                f"No explainability factors are "
                f"available for {project.name}."
            )

        return Response(
            {
                "features": features,
                "summary": summary,
            }
        )