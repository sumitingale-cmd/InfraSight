import environ
from django.core.management.base import BaseCommand
from projects.integrations.datagov_client import fetch_resource
from projects.models import NationalAcquisitionBenchmark

env = environ.Env()
RESOURCE_ID = "c399c3e8-ef60-4441-9cf8-36ae322ccd19"

class Command(BaseCommand):
    help = "Import the real NHAI year-wise land acquisition cost benchmark from data.gov.in."

    def handle(self, *args, **options):
        api_key = env("DATAGOV_API_KEY")
        data = fetch_resource(RESOURCE_ID, api_key, limit=10)

        created = 0
        for rec in data.get("records", []):
            NationalAcquisitionBenchmark.objects.update_or_create(
                year=rec["_year"],
                defaults={
                    "area_acquired_ha": rec["area_acquired__ha__"],
                    "expenditure_cr": rec["expenditure__rs__cr__"],
                    "avg_cost_cr_per_ha": rec["average_cost__rs__cr__"],
                },
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Imported {created} real benchmark years."))