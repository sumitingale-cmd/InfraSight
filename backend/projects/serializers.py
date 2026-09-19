from rest_framework import serializers
from .models import LandProject, NationalAcquisitionBenchmark


class LandProjectSerializer(serializers.ModelSerializer):
    """
    Full project serializer.

    Adds `latest_prediction` as a nested snapshot of the most-recent
    RiskPrediction for the project so ProjectDetail can pre-populate
    risk data without a second API call.
    """

    latest_prediction = serializers.SerializerMethodField()

    class Meta:
        model = LandProject
        fields = "__all__"

    def get_latest_prediction(self, obj):
        prediction = (
            obj.predictions
            .order_by("-predicted_at")
            .first()
        )
        if prediction is None:
            return None
        return {
            "risk_score":        prediction.risk_score,
            "delay_probability": prediction.delay_probability,
            "risk_band":         prediction.risk_band,
            "top_factors":       prediction.top_factors,
            "recommendations":   prediction.recommendations,
            "predicted_at":      prediction.predicted_at.isoformat(),
        }


class NationalAcquisitionBenchmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = NationalAcquisitionBenchmark
        fields = "__all__"
