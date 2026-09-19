from django.core.management.base import BaseCommand
from risk_engine.ml.train_model import train

class Command(BaseCommand):
    help = "Retrain the land acquisition delay risk model on current labeled project data."

    def handle(self, *args, **options):
        accuracy = train()
        self.stdout.write(self.style.SUCCESS(f"Retrained. Held-out accuracy: {accuracy:.3f}"))