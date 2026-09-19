# projects/management/commands/seed_data.py
import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from projects.models import LandProject

STATES_DISTRICTS = {
    "Maharashtra": [("Pune", 18.5204, 73.8567), ("Nagpur", 21.1458, 79.0882)],
    "Karnataka": [("Bengaluru Rural", 13.2846, 77.5946), ("Mysuru", 12.2958, 76.6394)],
    "Uttar Pradesh": [("Lucknow", 26.8467, 80.9462), ("Noida", 28.5355, 77.3910)],
    "Tamil Nadu": [("Chennai", 13.0827, 80.2707), ("Coimbatore", 11.0168, 76.9558)],
    "Gujarat": [("Ahmedabad", 23.0225, 72.5714), ("Surat", 21.1702, 72.8311)],
}
PROJECT_TYPES = ["highway", "railway", "irrigation", "industrial", "urban"]

class Command(BaseCommand):
    help = "Seed the database with synthetic land acquisition projects for ML training/demo purposes."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=80)

    def handle(self, *args, **options):
        count = options["count"]
        created = 0

        for i in range(count):
            state = random.choice(list(STATES_DISTRICTS.keys()))
            district, lat, lng = random.choice(STATES_DISTRICTS[state])
            jitter = lambda v: v + random.uniform(-0.3, 0.3)

            compensation = random.uniform(0, 100)
            disputes = random.randint(0, 12)
            approval_delay = random.randint(0, 400)
            possession = random.uniform(0, 100)
            rehab = random.uniform(0, 100)
            responsiveness = random.uniform(1, 10)

            # rough ground-truth heuristic: more disputes/delay/less progress => more likely delayed
            delay_signal = (
                disputes * 4 + approval_delay / 10 +
                (100 - compensation) / 5 + (100 - possession) / 8 +
                (100 - rehab) / 10 + (10 - responsiveness) * 3
            )
            is_delayed = delay_signal > random.uniform(60, 90)

            start = date.today() - timedelta(days=random.randint(180, 1500))

            LandProject.objects.create(
                name=f"{district} {random.choice(PROJECT_TYPES).title()} Project {i+1}",
                project_type=random.choice(PROJECT_TYPES),
                state=state,
                district=district,
                latitude=jitter(lat),
                longitude=jitter(lng),
                land_area_hectares=round(random.uniform(2, 500), 2),
                affected_families=random.randint(5, 2000),
                compensation_disbursed_pct=round(compensation, 1),
                legal_disputes_count=disputes,
                approval_delay_days=approval_delay,
                possession_status_pct=round(possession, 1),
                rehabilitation_progress_pct=round(rehab, 1),
                stakeholder_responsiveness_score=round(responsiveness, 1),
                current_stage=random.choice([c[0] for c in LandProject.STAGE_CHOICES]),
                started_on=start,
                target_completion=start + timedelta(days=random.randint(365, 1800)),
                is_delayed_historical=is_delayed,
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Seeded {created} synthetic projects."))