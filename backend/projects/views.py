from rest_framework.views import APIView
from rest_framework.response import Response
from .models import NationalAcquisitionBenchmark
from .serializers import NationalAcquisitionBenchmarkSerializer
# projects/views.py
from rest_framework import viewsets, permissions
from .models import LandProject
from .serializers import LandProjectSerializer

class LandProjectViewSet(viewsets.ModelViewSet):
    queryset = LandProject.objects.all().order_by("-created_at")
    serializer_class = LandProjectSerializer
    permission_classes = [permissions.IsAuthenticated]


class NationalBenchmarkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = NationalAcquisitionBenchmark.objects.all()
        return Response(NationalAcquisitionBenchmarkSerializer(qs, many=True).data)