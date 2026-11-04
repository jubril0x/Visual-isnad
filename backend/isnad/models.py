from django.db import models


class Narrator(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=255)
    arabic_name = models.CharField(max_length=255, blank=True)
    aliases = models.TextField(blank=True)
    birth_year = models.IntegerField(null=True, blank=True)
    death_year = models.IntegerField(null=True, blank=True)
    birth_display = models.CharField(max_length=100, blank=True)
    death_display = models.CharField(max_length=100, blank=True)
    birth_place = models.CharField(max_length=255, blank=True)
    death_place = models.CharField(max_length=255, blank=True)
    tabaqah = models.CharField(max_length=255, blank=True)
    region = models.CharField(max_length=255, blank=True)
    tawthiq = models.CharField(max_length=255, blank=True)
    grade = models.CharField(max_length=255, blank=True)
    tags = models.TextField(blank=True)
    biography = models.TextField(blank=True)
    parents = models.TextField(blank=True)
    teachers_inds = models.TextField(blank=True)
    students_inds = models.TextField(blank=True)

    def __str__(self):
        return self.name or self.arabic_name or str(self.id)


class Hadith(models.Model):
    hadith_number = models.CharField(max_length=50)
    in_book_reference = models.CharField(max_length=100, blank=True)
    book_title = models.CharField(max_length=255)
    chapter_number = models.CharField(max_length=50, blank=True)
    chapter_title = models.CharField(max_length=255, blank=True)
    chapter_title_arabic = models.CharField(max_length=255, blank=True)
    arabic_isnad = models.TextField(blank=True)
    arabic_matn = models.TextField(blank=True)
    arabic_full = models.TextField(blank=True)
    english_matn = models.TextField(blank=True)
    topic = models.CharField(max_length=255, blank=True)
    reference_url = models.URLField(blank=True)
    grade = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.book_title} {self.hadith_number}"


class TransmissionEdge(models.Model):
    teacher = models.ForeignKey(
        Narrator,
        on_delete=models.CASCADE,
        related_name="taught_edges",
    )
    student = models.ForeignKey(
        Narrator,
        on_delete=models.CASCADE,
        related_name="learned_edges",
    )
    hadith = models.ForeignKey(
        Hadith,
        on_delete=models.CASCADE,
        related_name="transmission_edges",
    )
    terminology = models.CharField(max_length=100, blank=True)
    sequence = models.PositiveSmallIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["hadith", "sequence"]),
        ]

    def __str__(self):
        return f"{self.teacher} → {self.student} ({self.hadith})"
