# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("InfraSight role", {"fields": ("role", "department")}),
    )
    list_display = ("username", "email", "role", "department", "is_staff")