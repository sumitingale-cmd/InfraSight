from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    full_name = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True
    )

    department = serializers.CharField(
        required=False,
        allow_blank=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "full_name",
            "password",
            "role",
            "department",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        full_name = validated_data.pop("full_name", "")

        user = User.objects.create_user(
            **validated_data
        )

        # Store full name if the User model supports it.
        if full_name:
            if hasattr(user, "full_name"):
                user.full_name = full_name
                user.save(update_fields=["full_name"])

            elif hasattr(user, "first_name"):
                user.first_name = full_name
                user.save(update_fields=["first_name"])

        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "department",
        ]