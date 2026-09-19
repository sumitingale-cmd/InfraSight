from .models import NationalAcquisitionBenchmark
from django.contrib import admin

@admin.register(NationalAcquisitionBenchmark)
class NationalAcquisitionBenchmarkAdmin(admin.ModelAdmin):
    list_display = ("year", "area_acquired_ha", "expenditure_cr", "avg_cost_cr_per_ha")