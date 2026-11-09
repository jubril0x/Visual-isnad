import re

from django.db import migrations, models


BOOK_REF_RE = re.compile(r"Book\s+(\d+)", re.I)


def populate_book_number(apps, schema_editor):
    Hadith = apps.get_model("isnad", "Hadith")
    batch = []
    for hadith in Hadith.objects.only("id", "in_book_reference").iterator(chunk_size=1000):
        match = BOOK_REF_RE.search(hadith.in_book_reference or "")
        if not match:
            continue
        hadith.book_number = int(match.group(1))
        batch.append(hadith)
        if len(batch) >= 500:
            Hadith.objects.bulk_update(batch, ["book_number"])
            batch.clear()
    if batch:
        Hadith.objects.bulk_update(batch, ["book_number"])


class Migration(migrations.Migration):

    dependencies = [
        ("isnad", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="hadith",
            name="book_number",
            field=models.PositiveSmallIntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.AlterField(
            model_name="hadith",
            name="hadith_number",
            field=models.CharField(db_index=True, max_length=50),
        ),
        migrations.AlterField(
            model_name="hadith",
            name="in_book_reference",
            field=models.CharField(blank=True, db_index=True, max_length=100),
        ),
        migrations.AlterField(
            model_name="narrator",
            name="name",
            field=models.CharField(db_index=True, max_length=255),
        ),
        migrations.RunPython(populate_book_number, migrations.RunPython.noop),
    ]
