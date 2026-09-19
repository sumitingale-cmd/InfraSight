# projects/urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import LandProjectViewSet, NationalBenchmarkView

router = DefaultRouter()
router.register("", LandProjectViewSet, basename="project")

# NOTE: custom routes must come FIRST — the router registered at ""
# would otherwise swallow "national-benchmark/" as a detail lookup
# (returning 404 "No LandProject matches the given query") and break
# the Dashboard benchmark chart.
urlpatterns = [
    path("national-benchmark/", NationalBenchmarkView.as_view()),
] + router.urls