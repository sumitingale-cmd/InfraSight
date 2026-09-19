import environ
from django.core.management.base import BaseCommand
from projects.integrations.datagov_client import fetch_resource

env = environ.Env()

class Command(BaseCommand):
    help = "Preview a data.gov.in resource's raw fields before importing."

    def add_arguments(self, parser):
        parser.add_argument("--resource-id", default=env("DATAGOV_LAND_ACQUISITION_RESOURCE_ID", default=""))

    def handle(self, *args, **options):
        resource_id = options["resource_id"]
        if not resource_id:
            self.stderr.write("No resource ID provided or set in .env")
            return

        api_key = env("DATAGOV_API_KEY")
        data = fetch_resource(resource_id, api_key, limit=5)

        self.stdout.write(self.style.SUCCESS(f"Title: {data.get('title')}"))
        self.stdout.write(f"Total available: {data.get('total')}")
        self.stdout.write(f"Fields: {[f['name'] for f in data.get('field', [])]}")
        self.stdout.write("\nSample records:")
        for rec in data.get("records", []):
            self.stdout.write(str(rec))