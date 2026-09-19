from django.urls import path

from .views import (
    PredictRiskView,
    RiskPredictionHistoryView,
    DashboardSummaryView,
    ModelStatusView,
    ActionCenterListView,
    ActionItemCreateView,
    ActionItemResolveView,
    ProjectActionItemsView,
    ProjectCreateView,
    RiskExplainabilityView,
)


urlpatterns = [

    # ============================================================
    # RISK PREDICTION
    # ============================================================

    path(
        "predict/<int:project_id>/",
        PredictRiskView.as_view(),
        name="predict-risk",
    ),

    # ============================================================
    # RISK PREDICTION HISTORY
    # ============================================================

    path(
        "history/<int:project_id>/",
        RiskPredictionHistoryView.as_view(),
        name="risk-history",
    ),

    # ============================================================
    # DASHBOARD
    # ============================================================

    path(
        "dashboard-summary/",
        DashboardSummaryView.as_view(),
        name="dashboard-summary",
    ),

    # ============================================================
    # ML MODEL STATUS
    # ============================================================

    path(
        "ml/model-status/",
        ModelStatusView.as_view(),
        name="model-status",
    ),

    # ============================================================
    # ACTION CENTER
    # ============================================================

    path(
        "action-center/",
        ActionCenterListView.as_view(),
        name="action-center-list",
    ),

    path(
        "action-center/custom/",
        ActionItemCreateView.as_view(),
        name="action-center-custom-create",
    ),

    path(
        "action-center/<int:pk>/resolve/",
        ActionItemResolveView.as_view(),
        name="action-center-resolve",
    ),

    # ============================================================
    # PER-PROJECT ACTION ITEMS
    # ============================================================

    path(
        "action-center/project/<int:project_id>/",
        ProjectActionItemsView.as_view(),
        name="project-action-items",
    ),

    # ============================================================
    # PROJECT CREATION
    # ============================================================

    path(
        "projects/create/",
        ProjectCreateView.as_view(),
        name="project-create",
    ),

    # ============================================================
    # RISK EXPLAINABILITY / XAI
    # ============================================================

    path(
        "xai/<int:project_id>/",
        RiskExplainabilityView.as_view(),
        name="risk-xai",
    ),
]