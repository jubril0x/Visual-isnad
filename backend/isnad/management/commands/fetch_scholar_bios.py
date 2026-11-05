from concurrent.futures import ThreadPoolExecutor, as_completed

from django.core.management.base import BaseCommand

from isnad.models import Narrator, TransmissionEdge
from isnad.scholar_bios import (
    UNMATCHED_ID_START,
    extract_brief_biography,
    fetch_page,
    is_mostly_arabic,
    load_cache,
    looks_like_interests,
    save_cache,
)


class Command(BaseCommand):
    help = "Import Brief Biography text from muslimscholars.info for narrators already in the database."

    def add_arguments(self, parser):
        parser.add_argument("--in-chain", action="store_true", help="Only narrators who appear in isnad edges.")
        parser.add_argument("--limit", type=int, default=0)
        parser.add_argument("--workers", type=int, default=6)
        parser.add_argument("--force", action="store_true", help="Re-fetch even if a biography is already cached.")
        parser.add_argument(
            "--refill-empty",
            action="store_true",
            help="Re-fetch narrators whose cached biography is blank, Arabic-only, or a leftover interests string.",
        )

    def handle(self, *args, **options):
        cache = load_cache()

        queryset = Narrator.objects.filter(id__lt=UNMATCHED_ID_START)
        if options["in_chain"]:
            edge_ids = set(TransmissionEdge.objects.values_list("teacher_id", flat=True)) | set(
                TransmissionEdge.objects.values_list("student_id", flat=True)
            )
            queryset = queryset.filter(id__in=edge_ids)

        ids = list(queryset.order_by("id").values_list("id", flat=True))
        if options["limit"]:
            ids = ids[: options["limit"]]

        pending = []
        for scholar_id in ids:
            cached = cache.get(str(scholar_id))
            missing = str(scholar_id) not in cache
            weak = (not cached) or looks_like_interests(cached) or is_mostly_arabic(cached)
            if options["force"] or missing or (options["refill_empty"] and weak):
                pending.append(scholar_id)
        self.stdout.write(
            f"{len(ids)} narrators selected; {len(pending)} need a fetch; {len(ids) - len(pending)} already cached."
        )
        if not pending and not options["force"]:
            updated = self.apply_cache(cache, ids)
            self.stdout.write(self.style.SUCCESS(f"Updated {updated} narrator biographies from cache."))
            return

        fetched = 0
        failures = 0
        workers = max(1, options["workers"])

        def job(scholar_id: int) -> tuple[int, str, str]:
            try:
                page = fetch_page(scholar_id)
                return scholar_id, extract_brief_biography(page), ""
            except Exception as exc:  # noqa: BLE001 - persist and continue
                return scholar_id, "", str(exc)

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(job, scholar_id) for scholar_id in pending]
            for future in as_completed(futures):
                scholar_id, bio, error = future.result()
                cache[str(scholar_id)] = bio
                fetched += 1
                if error:
                    failures += 1
                    self.stderr.write(f"Failed {scholar_id}: {error}")
                if fetched % 40 == 0:
                    save_cache(cache)
                    self.stdout.write(f"Fetched {fetched}/{len(pending)}...")

        save_cache(cache)
        updated = self.apply_cache(cache, ids)
        nonempty = sum(1 for scholar_id in ids if cache.get(str(scholar_id)))
        self.stdout.write(
            self.style.SUCCESS(
                f"Imported biographies for {nonempty}/{len(ids)} narrators "
                f"({failures} fetch failures). Updated {updated} rows."
            )
        )

    def apply_cache(self, cache: dict, ids: list[int]) -> int:
        by_id = {narrator.id: narrator for narrator in Narrator.objects.filter(id__in=ids)}
        changed = []
        for scholar_id in ids:
            bio = (cache.get(str(scholar_id)) or "").strip()
            narrator = by_id.get(scholar_id)
            if not narrator or narrator.biography == bio:
                continue
            if not bio and narrator.biography:
                if not looks_like_interests(narrator.biography) and not is_mostly_arabic(narrator.biography):
                    continue
            narrator.biography = bio
            changed.append(narrator)
        if changed:
            Narrator.objects.bulk_update(changed, ["biography"], batch_size=200)
        return len(changed)
