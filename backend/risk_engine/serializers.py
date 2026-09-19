from rest_framework import serializers

from .models import (
    ActionItem,
    RiskPredictionLog,
)

from projects.models import LandProject


# ============================================================
# ACTION ITEM SERIALIZER
# ============================================================

class ActionItemSerializer(
    serializers.ModelSerializer
):

    project_name = serializers.CharField(
        source="project.name",
        read_only=True,
        default=None,
    )

    class Meta:

        model = ActionItem

        fields = [
            "id",
            "action_ref",
            "project",
            "project_name",
            "title",
            "category",
            "severity",
            "status",
            "ai_attribution",
            "evidence_notes",
            "assigned_authority",
            "statutory_deadline",
            "execution_current",
            "execution_total",
            "model_influence_pct",
            "is_custom",
            "created_at",
            "resolved_at",
        ]

        read_only_fields = [
            "id",
            "action_ref",
            "project_name",
            "created_at",
            "resolved_at",
        ]


# ============================================================
# CUSTOM ACTION CREATE SERIALIZER
# ============================================================

class ActionItemCreateSerializer(
    serializers.ModelSerializer
):

    class Meta:

        model = ActionItem

        fields = [
            "project",
            "title",
            "category",
            "severity",
            "status",
            "assigned_authority",
            "statutory_deadline",
            "ai_attribution",
            "is_custom",
        ]

        read_only_fields = [
            "is_custom",
        ]


# ============================================================
# PROJECT CREATE SERIALIZER
# ============================================================

class ProjectCreateSerializer(
    serializers.ModelSerializer
):

    # Wizard extras: accepted (write-only) so the multi-step
    # New Project form never 400s on unknown fields across DRF versions.
    corridor_section = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )
    acquired_to_date_hectares = serializers.FloatField(
        required=False, write_only=True
    )
    total_parcels = serializers.IntegerField(
        required=False, write_only=True
    )
    parcels_acquired = serializers.IntegerField(
        required=False, write_only=True
    )
    government_land_pct = serializers.FloatField(
        required=False, write_only=True
    )
    private_land_pct = serializers.FloatField(
        required=False, write_only=True
    )
    forest_land_pct = serializers.FloatField(
        required=False, write_only=True
    )

    class Meta:

        model = LandProject

        fields = [
            "id",
            "name",
            "district",
            "state",
            "project_type",
            "corridor_section",
            "land_area_hectares",
            "acquired_to_date_hectares",
            "total_parcels",
            "parcels_acquired",
            "government_land_pct",
            "private_land_pct",
            "forest_land_pct",
            "affected_families",
            "latitude",
            "longitude",
            "compensation_disbursed_pct",
            "legal_disputes_count",
            "approval_delay_days",
            "possession_status_pct",
            "rehabilitation_progress_pct",
            "stakeholder_responsiveness_score",
            "current_stage",
            "started_on",
            "target_completion",
        ]

        read_only_fields = [
            "id",
        ]

        extra_kwargs = {
            "started_on": {"required": False, "allow_null": True},
            "target_completion": {"required": False, "allow_null": True},
        }

    # Drop wizard-only extras before hitting the model — they are
    # accepted for compatibility but not stored on LandProject.
    _WIZARD_ONLY_FIELDS = (
        "corridor_section",
        "acquired_to_date_hectares",
        "total_parcels",
        "parcels_acquired",
        "government_land_pct",
        "private_land_pct",
        "forest_land_pct",
    )

    def create(self, validated_data):
        for field in self._WIZARD_ONLY_FIELDS:
            validated_data.pop(field, None)
        return super().create(validated_data)


# ============================================================
# RISK PREDICTION HISTORY SERIALIZER
# ============================================================

class RiskPredictionLogSerializer(
    serializers.ModelSerializer
):

    class Meta:

        model = RiskPredictionLog

        fields = [
            "id",
            "risk_score",
            "risk_band",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "risk_score",
            "risk_band",
            "created_at",
        ]