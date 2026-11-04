from rest_framework import serializers

from .models import Hadith, Narrator, TransmissionEdge


class NarratorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Narrator
        fields = "__all__"


class HadithSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hadith
        fields = "__all__"


class TransmissionEdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransmissionEdge
        fields = "__all__"
