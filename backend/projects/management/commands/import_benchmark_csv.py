import csv
from django.core.management.base import BaseCommand
from projects.models import NationalAcquisitionBenchmark

REQUIRED = ["year", "area_acquired_ha", "expenditure_cr", "avg_cost_cr_per_ha"]

class Command(BaseCommand):
    help = "Import NationalAcquisitionBenchmark rows from a locally downloaded CSV (fallback for the unreliable data.gov.in live API)."

    def add_arguments(self, parser):
        parser.add_argument("csv_path")
        parser.add_argument("--dry-run", action="store_true", help="Validate without saving to the database.")

    def handle(self, *args, **options):
        path = options["csv_path"]
        dry_run = options["dry_run"]
        created, skipped = 0, 0

        with open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader, start=2):  # row 1 is the header
                data = {k: v.strip() for k, v in row.items()}
                missing = [field for field in REQUIRED if not data.get(field, "").strip()]
                if missing:
                    self.stderr.write(f"Row {i}: skipped, missing required fields {missing}")
                    skipped += 1
                    continue

                try:
                    year = data["year"]
                    area_acquired_ha = float(data["area_acquired_ha"])
                    expenditure_cr = float(data["expenditure_cr"])
                    avg_cost_cr_per_ha = float(data["avg_cost_cr_per_ha"])
                    source = data.get("source", "").strip() or "data.gov.in / MoRTH-NHAI"

                    if not dry_run:
                        NationalAcquisitionBenchmark.objects.update_or_create(
                            year=year,
                            defaults={
                                "area_acquired_ha": area_acquired_ha,
                                "expenditure_cr": expenditure_cr,
                                "avg_cost_cr_per_ha": avg_cost_cr_per_ha,
                                "source": source,
                            },
                        )
                    created += 1
                except ValueError as e:
                    self.stderr.write(f"Row {i}: skipped, {e}")
                    skipped += 1

        mode = "[DRY RUN] Would have imported" if dry_run else "Imported"
        self.stdout.write(self.style.SUCCESS(f"{mode} {created} rows. Skipped {skipped}."))