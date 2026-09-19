from django.db import models

class LandProject(models.Model):
    PROJECT_TYPES = (
        ("highway", "Highway"), ("railway", "Railway"),
        ("irrigation", "Irrigation"), ("industrial", "Industrial Corridor"),
        ("urban", "Urban Infrastructure"),
    )
    STAGE_CHOICES = (
        ("notification", "Notification"), ("survey", "Survey"),
        ("declaration", "Declaration"), ("award", "Award"),
        ("compensation", "Compensation"),
        ("possession", "Possession"), ("rehabilitation", "Rehabilitation"),
        ("completed", "Completed"),
    )

    name = models.CharField(max_length=200)
    project_type = models.CharField(max_length=20, choices=PROJECT_TYPES)
    state = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    latitude = models.FloatField()
    longitude = models.FloatField()

    land_area_hectares = models.FloatField()
    affected_families = models.PositiveIntegerField()
    compensation_disbursed_pct = models.FloatField(default=0)
    legal_disputes_count = models.PositiveIntegerField(default=0)
    approval_delay_days = models.PositiveIntegerField(default=0)
    possession_status_pct = models.FloatField(default=0)
    rehabilitation_progress_pct = models.FloatField(default=0)
    stakeholder_responsiveness_score = models.FloatField(default=5.0)  # 0-10
    current_stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default="notification")

    started_on = models.DateField(null=True, blank=True)
    target_completion = models.DateField(null=True, blank=True)
    is_delayed_historical = models.BooleanField(null=True, blank=True)  # ground truth for training

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    def __str__(self):
        return self.name

class NationalAcquisitionBenchmark(models.Model):
    year = models.CharField(max_length=10)            # e.g. "2013-14"
    area_acquired_ha = models.FloatField()
    expenditure_cr = models.FloatField()
    avg_cost_cr_per_ha = models.FloatField()
    source = models.CharField(max_length=100, default="data.gov.in / MoRTH-NHAI")

    class Meta:
        ordering = ["year"]

    def __str__(self):
        return f"{self.year}: ₹{self.avg_cost_cr_per_ha} Cr/Ha"