import re

from rest_framework import serializers

from .models import Hadith, Narrator, TransmissionEdge

NARRATED_RE = re.compile(r"^Narrated\s+([^:]+):", re.I)


COMPACT_NARRATOR_FIELDS = (
    "id",
    "name",
    "arabic_name",
    "birth_display",
    "death_display",
    "birth_place",
    "death_place",
    "tabaqah",
    "region",
    "tawthiq",
    "grade",
)


class NarratorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Narrator
        fields = "__all__"


class CompactNarratorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Narrator
        fields = COMPACT_NARRATOR_FIELDS


class HadithSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hadith
        fields = "__all__"


class HadithListSerializer(serializers.ModelSerializer):
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Hadith
        fields = (
            "id",
            "hadith_number",
            "in_book_reference",
            "chapter_title",
            "chapter_title_arabic",
            "chapter_number",
            "preview",
        )

    def get_preview(self, obj: Hadith) -> str:
        text = getattr(obj, "_preview", None) or (obj.english_matn or "")[:80]
        match = NARRATED_RE.match(text)
        if match:
            return f"Narrated {match.group(1).strip()}"
        return f"Hadith {obj.hadith_number}"


class TransmissionEdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransmissionEdge
        fields = "__all__"
