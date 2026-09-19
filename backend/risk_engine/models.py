from django.db import models
from django.utils import timezone
import random

from projects.models import LandProject


# ============================================================
# RISK PREDICTION
# ============================================================

class RiskPrediction(models.Model):

    project = models.ForeignKey(
        LandProject,
        on_delete=models.CASCADE,
        related_name="predictions",
    )

    risk_score = models.FloatField()
    delay_probability = models.FloatField()
    risk_band = models.CharField(max_length=10)

    top_factors = models.JSONField(default=list)
    recommendations = models.JSONField(default=list)

    predicted_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return (
            f"{self.project.name} - "
            f"{self.risk_band} - "
            f"{self.risk_score}"
        )


# ============================================================
# RISK PREDICTION LOG
# ============================================================

class RiskPredictionLog(models.Model):

    project = models.ForeignKey(
        LandProject,
        on_delete=models.CASCADE,
        related_name="prediction_logs",
    )

    risk_score = models.FloatField()

    risk_band = models.CharField(
        max_length=10
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return (
            f"{self.project.name} - "
            f"{self.risk_band} - "
            f"{self.risk_score}"
        )


# ============================================================
# MODEL VERSION
# ============================================================

class ModelVersion(models.Model):

    trained_at = models.DateTimeField(
        auto_now_add=True
    )

    accuracy = models.FloatField()

    training_sample_size = models.PositiveIntegerField()

    notes = models.CharField(
        max_length=255,
        blank=True,
    )

    def __str__(self):
        return (
            f"Model {self.id} - "
            f"{self.accuracy}"
        )


# ============================================================
# ACTION ITEM
# ============================================================

class ActionItem(models.Model):

    SEVERITY_CHOICES = [
        ("critical", "Critical"),
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("overdue", "Overdue"),
        ("completed", "Completed"),
        ("resolved", "Resolved"),
    ]

    action_ref = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
    )

    project = models.ForeignKey(
        LandProject,
        on_delete=models.CASCADE,
        related_name="action_items",
        null=True,
        blank=True,
    )

    title = models.CharField(
        max_length=200
    )

    category = models.CharField(
        max_length=80,
        blank=True,
    )

    severity = models.CharField(
        max_length=10,
        choices=SEVERITY_CHOICES,
        default="medium",
    )

    status = models.CharField(
        max_length=12,
        choices=STATUS_CHOICES,
        default="pending",
    )

    ai_attribution = models.TextField(
        blank=True
    )

    evidence_notes = models.TextField(
        blank=True
    )

    assigned_authority = models.CharField(
        max_length=150,
        blank=True
    )

    statutory_deadline = models.DateField(
        null=True,
        blank=True
    )

    execution_current = models.PositiveIntegerField(
        default=0
    )

    execution_total = models.PositiveIntegerField(
        default=0
    )

    model_influence_pct = models.FloatField(
        null=True,
        blank=True
    )

    is_custom = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    resolved_at = models.DateTimeField(
        null=True,
        blank=True
    )

    class Meta:
        ordering = [
            "-created_at"
        ]

    def save(self, *args, **kwargs):

        if not self.action_ref:

            self.action_ref = (
                f"ACT-{timezone.now().year}-"
                f"{random.randint(100, 999)}"
            )

        # Automatically mark overdue actions
        if (
            self.statutory_deadline
            and self.statutory_deadline
            < timezone.now().date()
            and self.status in (
                "pending",
                "in_progress",
            )
        ):
            self.status = "overdue"

        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"[{self.severity}] "
            f"{self.action_ref} — "
            f"{self.title}"
        )