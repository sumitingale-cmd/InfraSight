from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ("admin", "Administrator"),
        ("policymaker", "Policymaker"),
        ("officer", "Field Officer"),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="officer")
    department = models.CharField(max_length=120, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role})"