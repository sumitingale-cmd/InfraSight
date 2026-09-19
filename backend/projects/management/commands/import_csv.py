import csv
from datetime import datetime
from django.core.management.base import BaseCommand
from projects.models import LandProject

REQUIRED = ["name", "project_type", "state", "district", "latitude", "longitude",
            "land_area_hectares", "affected_families", "started_on", "target_completion"]

NUMERIC_FIELDS = [
    "latitude", "longitude", "land_area_hectares", "affected_families",
    "compensation_disbursed_pct", "legal_disputes_count", "approval_delay_days",
    "possession_status_pct", "rehabilitation_progress_pct", "stakeholder_responsiveness_score",
]

def parse_bool(val):
    if val is None or val.strip() == "":
        return None
    return val.strip().lower() in ("true", "1", "yes")

def parse_date(val):
    return datetime.strptime(val.strip(), "%Y-%m-%d").date()

class Command(BaseCommand):
    help = "Import LandProject rows from a CSV file (e.g. compiled from data.gov.in downloads or manual Bhoomi Rashi lookups)."

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
                missing = [field for field in REQUIRED if not row.get(field, "").strip()]
                if missing:
                    self.stderr.write(f"Row {i}: skipped, missing required fields {missing}")
                    skipped += 1
                    continue

                try:
                    data = {k: v.strip() for k, v in row.items()}
                    for field in NUMERIC_FIELDS:
                        if data.get(field, "").strip():
                            data[field] = float(data[field])
                        else:
                            data.pop(field, None)  # let model default apply

                    data["started_on"] = parse_date(data["started_on"])
                    data["target_completion"] = parse_date(data["target_completion"])
                    data["is_delayed_historical"] = parse_bool(data.get("is_delayed_historical"))

                    if not dry_run:
                        LandProject.objects.create(**data)
                    created += 1
                except (ValueError, KeyError) as e:
                    self.stderr.write(f"Row {i}: skipped, {e}")
                    skipped += 1

        mode = "[DRY RUN] Would have imported" if dry_run else "Imported"
        self.stdout.write(self.style.SUCCESS(f"{mode} {created} rows. Skipped {skipped}."))