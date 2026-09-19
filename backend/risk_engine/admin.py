# risk_engine/admin.py
from django.contrib import admin
from .models import RiskPrediction

@admin.register(RiskPrediction)
class RiskPredictionAdmin(admin.ModelAdmin):
    list_display = ("project", "risk_band", "risk_score", "delay_probability", "predicted_at")
    list_filter = ("risk_band",)