import csv
import re
from collections import defaultdict
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from isnad.models import Hadith, Narrator, TransmissionEdge

INVISIBLE = dict.fromkeys(map(ord, "\u200f\u200e\u200c\u200d\u200b"), None)
TASHKEEL_RE = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
SPACE_RE = re.compile(r"\s+")
HONORIFIC_RE = re.compile(
    r"رضي الله عن\S*|رضى الله عن\S*|صلى الله عليه وسلم|عليه السلام|صلعم"
)
PARENT_ID_RE = re.compile(r"\[(\d+)\]")
YEAR_RE = re.compile(r"(\d+)\s*(BH|AH)", re.I)
HADITH_NO_RE = re.compile(r"bukhari:(\d+)", re.I)
GENERATION_RE = re.compile(r"\[([^\]]*(?:generation|century)[^\]]*)\]", re.I)

STOP_TOKENS = {
    "بن",
    "ابن",
    "بنت",
    "ابي",
    "ابو",
    "ابا",
    "ام",
    "ال",
    "عن",
    "قال",
    "قالت",
    "يقول",
    "الله",
    "رضي",
    "عنه",
    "عنها",
    "عنهم",
}

FATHER_KEYS = {"ابيه", "ابوه", "ابيها", "اباها"}
PROPHET_KEYS = {"رسول الله", "النبي", "نبي الله", "رسول الله صلى الله عليه وسلم"}
BUKHARI_ID = 30001
PROPHET_ID = 1
UNMATCHED_ID_START = 800000

TERM_SPLIT_RE = re.compile(
    r"و?(حدثنا|حدثني|اخبرنا|اخبرني|انبانا|انباني|عن|سمعت|سمعنا|انه سمع|انها سمعت)\s+"
)
SKIP_NAME_KEYS = {"هرقل", "جبريل", "الملك", "و", "ح"}
TAHWIL_RE = re.compile(r"(?:^|[\s،,])ح(?:[\s،,]|$)")

DATA_DIR = Path(settings.BASE_DIR).parent / "data"


def clean_text(value: str) -> str:
    if not value:
        return ""
    value = str(value).translate(INVISIBLE)
    return SPACE_RE.sub(" ", value).strip()


def normalize_arabic(value: str) -> str:
    if not value:
        return ""
    text = TASHKEEL_RE.sub("", clean_text(value))
    text = (
        text.replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .replace("ة", "ه")
        .replace("ى", "ي")
        .replace("ؤ", "و")
        .replace("ئ", "ي")
        .replace("\u06cc", "ي")
        .replace("\u06d2", "ي")
        .replace("\u06a9", "ك")
        .replace("\u06c1", "ه")
        .replace("\u06be", "ه")
        .replace("ه", "ه")
    )
    text = HONORIFIC_RE.sub(" ", text)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return SPACE_RE.sub(" ", text).strip()


def extract_arabic_span(raw_name: str) -> str:
    spans = re.findall(r"[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)*", str(raw_name))
    if not spans:
        return ""
    arabic = max(spans, key=len)
    return HONORIFIC_RE.sub(" ", arabic).strip()


def extract_english_name(raw_name: str) -> str:
    english = re.sub(r"[\u0600-\u06FF]+", " ", str(raw_name))
    english = re.sub(r"\([^)]*\)", " ", english)
    english = clean_text(english).replace("(saw)", "")
    english = re.sub(r"[()]+", " ", english)
    return SPACE_RE.sub(" ", english).strip(" -_,")[:255]


def parse_int(value):
    if value in (None, "", "NA", "N/A"):
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def hijri_display(date_blob: str, hijri_num, default_era: str) -> str:
    if not hijri_num:
        return ""
    blob = date_blob or ""
    match = YEAR_RE.search(blob)
    if match:
        return f"{match.group(1)} {match.group(2).upper()}"
    return f"{hijri_num} {default_era}"


def parse_id_list(value: str) -> list[int]:
    if not value or value.strip() in {"NA", "N/A"}:
        return []
    ids = []
    seen = set()
    for part in value.split(","):
        part = part.strip()
        if not part or part in {"NA", "N/A"}:
            continue
        try:
            number = int(part)
        except ValueError:
            continue
        if number not in seen:
            ids.append(number)
            seen.add(number)
    return ids


def distinctive_tokens(normalized: str) -> list[str]:
    tokens = []
    for token in normalized.split():
        if token in STOP_TOKENS or len(token) < 3:
            continue
        tokens.append(token)
    return tokens


def split_isnad_matn(arabic_text: str) -> tuple[str, str]:
    text = clean_text(arabic_text)
    if not text:
        return "", ""

    for quote in ('"', "«", "\u201c", "\u00ab"):
        idx = text.find(quote)
        if idx > 25:
            return text[:idx].strip(" ،,:"), text[idx:].strip()

    story_cut = re.search(
        r"(أَنَّ هِرَقْل|ان هرقل|فِي قَوْلِهِ تَعَالَى|في قوله تعالى|أَنَّهَا قَالَتْ|انها قالت|سَأَلَ رَسُولَ|سال رسول)",
        text,
    )
    if story_cut and story_cut.start() > 20:
        return text[: story_cut.start()].strip(" ،,:"), text[story_cut.start() :].strip()

    vocalized = re.search(
        r"صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ(?:\s*[،,]?\s*(?:يَقُولُ|فَقَالَ|قَالَ))?",
        text,
    )
    if vocalized and vocalized.end() < len(text) - 8:
        isnad = text[: vocalized.end()].strip(" ،,:")
        matn = text[vocalized.end() :].strip(" :،,")
        matn = re.sub(r"^(يَقُولُ|فَقَالَ|قَالَ)\s*", "", matn)
        return isnad, matn
    return text, ""


def _clean_person_name(name: str) -> str:
    name = name.strip(" ،,:ـ-")
    name = re.sub(r"^(و|قال|قالت|يقول)\s+", "", name)
    name = re.sub(r"\s+(قال|قالت|يقول|نحو[ه]|مثله)$", "", name)
    name = re.sub(r"\s+(على المنبر|علي المنبر)$", "", name)
    name = re.sub(r"\s+اخبره$", "", name)
    name = re.sub(r"ـ+", " ", name)
    return SPACE_RE.sub(" ", name).strip()


def _looks_like_name(name: str) -> bool:
    if not name or name in SKIP_NAME_KEYS:
        return False
    if re.search(r"سال |هرقل|في قوله|يحدث|فقال|كنت|قلت ", name):
        return False
    tokens = name.split()
    if len(tokens) > 9:
        return False
    markers = ("بن", "ابن", "ابي", "ابو", "ابا", "بنت", "ام")
    return any(token in markers or name.startswith(token) for token in tokens) or len(tokens) <= 4


def _names_from_segment(segment: str, term: str) -> list[tuple[str, str]]:
    segment = _clean_person_name(segment)
    if not segment:
        return []
    if re.match(r"^(في قوله|انها قالت|انه قال)", segment):
        return []

    segment = re.split(
        r"\s+(انها قالت|انه قال|في قوله تعالى|في قوله|سال رسول|سال )",
        segment,
        maxsplit=1,
    )[0]
    names: list[tuple[str, str]] = []
    current_term = term
    clauses = re.split(r"\s+ان\s+", segment)
    for index, clause in enumerate(clauses):
        clause = _clean_person_name(clause)
        if re.search(r"\b(سال|هرقل|في قوله)\b", clause):
            break

        prophet_in_clause = "رسول الله" in clause or clause.startswith("النبي")
        person = re.split(r"\s+(قال قال رسول الله|قال رسول الله|رسول الله|النبي)", clause)[0]
        person = _clean_person_name(re.sub(r"(قال|قالت)+$", "", person))
        if person and _looks_like_name(person):
            names.append((person, current_term if index == 0 else "ان"))
            current_term = "عن"
        elif person and index == 0 and 0 < len(person.split()) <= 6:
            names.append((person, current_term))
            current_term = "عن"
        elif index > 0 and not _looks_like_name(clause):
            break

        if prophet_in_clause:
            names.append(("رسول الله", "سمعت"))
            break
        if not _looks_like_name(clause) and index > 0:
            break
    return names


def extract_chains(isnad: str) -> list[list[tuple[str, str]]]:
    """Return chains of (name, terminology) from an isnad string."""
    text = HONORIFIC_RE.sub(" ", clean_text(isnad))
    text = TASHKEEL_RE.sub("", text)
    text = re.sub(r"على المنبر", " ", text)
    chunks = [chunk.strip() for chunk in TAHWIL_RE.split(text) if chunk and chunk.strip()]
    if not chunks:
        chunks = [text]

    chains: list[list[tuple[str, str]]] = []
    for chunk in chunks:
        normalized = normalize_arabic(chunk)
        if not normalized:
            continue
        pieces = TERM_SPLIT_RE.split(normalized)
        current: list[tuple[str, str]] = []
        pending_term = "حدثنا"
        for piece in pieces:
            if not piece:
                continue
            if piece in {
                "حدثنا",
                "حدثني",
                "اخبرنا",
                "اخبرني",
                "انبانا",
                "انباني",
                "عن",
                "سمعت",
                "سمعنا",
                "انه سمع",
                "انها سمعت",
            }:
                pending_term = piece
                continue
            extracted = _names_from_segment(piece, pending_term)
            if not extracted:
                if re.search(r"في قوله|انها قالت|انه قال", piece):
                    break
                continue
            current.extend(extracted)
            pending_term = "عن"
        cleaned: list[tuple[str, str]] = []
        for name, used_term in current:
            if "رسول الله" in name or name == "النبي":
                name = "رسول الله"
            if cleaned and cleaned[-1][0] == name:
                continue
            cleaned.append((name, used_term))
        if cleaned:
            chains.append(cleaned)
    return chains


class Command(BaseCommand):
    help = "Clear the isnad tables and reload all_rawis.csv plus Sahih al-Bukhari.csv."

    def add_arguments(self, parser):
        parser.add_argument(
            "--rawis",
            default=str(DATA_DIR / "all_rawis.csv"),
            help="Path to all_rawis.csv",
        )
        parser.add_argument(
            "--bukhari",
            default=str(DATA_DIR / "Sahih al-Bukhari.csv"),
            help="Path to Sahih al-Bukhari.csv",
        )
        parser.add_argument("--limit", type=int, default=0, help="Load only the first N hadiths.")
        parser.add_argument(
            "--keep-existing",
            action="store_true",
            help="Do not wipe existing rows first.",
        )

    def handle(self, *args, **options):
        rawis_path = Path(options["rawis"])
        bukhari_path = Path(options["bukhari"])
        if not rawis_path.exists():
            raise CommandError(f"Rawis CSV not found: {rawis_path}")
        if not bukhari_path.exists():
            raise CommandError(f"Bukhari CSV not found: {bukhari_path}")

        if not options["keep_existing"]:
            self.stdout.write("Clearing Hadith, Narrator, and TransmissionEdge...")
            TransmissionEdge.objects.all().delete()
            Hadith.objects.all().delete()
            Narrator.objects.all().delete()

        narrators, token_index, norm_index = self.load_rawis(rawis_path)
        self.stdout.write(self.style.SUCCESS(f"Loaded {len(narrators)} narrators from all_rawis.csv."))

        stats = self.load_hadiths(
            bukhari_path,
            narrators,
            token_index,
            norm_index,
            limit=options["limit"],
        )
        self.stdout.write(
            self.style.SUCCESS(
                "Loaded "
                f"{stats['hadiths']} hadiths, "
                f"{stats['edges']} edges, "
                f"{stats['matched']} matched names, "
                f"{stats['unmatched']} unmatched names, "
                f"{stats['teacher_hits']} teacher-constrained matches."
            )
        )

    def load_rawis(self, path: Path):
        by_id: dict[int, Narrator] = {}
        token_index: dict[str, set[int]] = defaultdict(set)
        norm_index: dict[str, list[int]] = defaultdict(list)

        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                scholar_id = parse_int(row.get("scholar_indx"))
                if scholar_id is None:
                    continue
                raw_name = row.get("name") or ""
                english = extract_english_name(raw_name) or raw_name[:255]
                arabic = extract_arabic_span(raw_name)
                birth_year = parse_int(row.get("birth_date_hijri"))
                death_year = parse_int(row.get("death_date_hijri"))
                grade = (row.get("grade") or "")[:255]
                generation = ""
                gen_match = GENERATION_RE.search(grade)
                if gen_match:
                    generation = gen_match.group(1)[:255]

                narrator = Narrator(
                    id=scholar_id,
                    name=english,
                    arabic_name=arabic[:255],
                    aliases=raw_name,
                    birth_year=birth_year,
                    death_year=death_year,
                    birth_display=hijri_display(row.get("birth_date") or "", birth_year, "BH" if birth_year and birth_year > 40 and "BH" in (row.get("birth_date") or "") else "AH"),
                    death_display=hijri_display(row.get("death_date") or row.get("death_date_place") or "", death_year, "AH"),
                    birth_place=(row.get("birth_place") or "")[:255],
                    death_place=(row.get("death_place") or "")[:255],
                    tabaqah=generation or grade[:255],
                    region=(row.get("places_of_stay") or "")[:255],
                    tawthiq=grade[:255],
                    grade=grade,
                    tags=row.get("tags") or "",
                    biography=row.get("area_of_interest") or "",
                    parents=row.get("parents") or "",
                    teachers_inds=row.get("teachers_inds") or "",
                    students_inds=row.get("students_inds") or "",
                )
                by_id[scholar_id] = narrator

                for key in filter(None, [normalize_arabic(arabic), normalize_arabic(english)]):
                    norm_index[key].append(scholar_id)
                for token in distinctive_tokens(normalize_arabic(arabic)):
                    token_index[token].add(scholar_id)
                for token in distinctive_tokens(normalize_arabic(english)):
                    token_index[token].add(scholar_id)

        Narrator.objects.bulk_create(list(by_id.values()), batch_size=1000)
        return by_id, token_index, norm_index

    def load_hadiths(self, path, narrators, token_index, norm_index, limit=0):
        unmatched_id = UNMATCHED_ID_START
        unmatched_created: dict[str, Narrator] = {}
        hadiths: list[Hadith] = []
        parsed_chains: list[list[list[tuple[str, str]]]] = []
        matched = unmatched = teacher_hits = 0

        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        if limit:
            rows = rows[:limit]

        for row in rows:
            arabic_full = clean_text(row.get("Arabic_Text") or "")
            isnad, matn = split_isnad_matn(arabic_full)
            if not matn:
                # If the quote-based split failed, still try to keep a usable matn
                # by cutting at the first explicit prophetic formula.
                vocalized = re.search(
                    r"صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ\s*(?:يَقُولُ|فَقَالَ)?\s*",
                    arabic_full,
                )
                if vocalized and vocalized.end() < len(arabic_full) - 10:
                    isnad = arabic_full[: vocalized.end()].strip(" ،,:")
                    matn = arabic_full[vocalized.end() :].strip(" :،,")
            chains = extract_chains(isnad)
            parsed_chains.append(chains)

            reference = row.get("Reference") or ""
            number_match = HADITH_NO_RE.search(reference)
            hadith_number = number_match.group(1) if number_match else (row.get("In-book reference") or "")[:50]
            chapter_en = (row.get("Chapter_Title_English") or "")[:255]
            numeric_id = parse_int(hadith_number)
            hadiths.append(
                Hadith(
                    id=numeric_id,
                    hadith_number=str(hadith_number)[:50],
                    in_book_reference=(row.get("In-book reference") or "")[:100],
                    book_title=(row.get("Book") or "Sahih al-Bukhari")[:255],
                    chapter_number=(row.get("Chapter_Number") or "")[:50],
                    chapter_title=chapter_en,
                    chapter_title_arabic=(row.get("Chapter_Title_Arabic") or "")[:255],
                    arabic_isnad=isnad,
                    arabic_matn=matn or arabic_full,
                    arabic_full=arabic_full,
                    english_matn=clean_text(row.get("English_Text") or ""),
                    topic=chapter_en,
                    reference_url=reference[:200],
                    grade=(row.get("Grade") or "")[:100],
                )
            )

        with transaction.atomic():
            Hadith.objects.bulk_create(hadiths, batch_size=500)

        edges: list[TransmissionEdge] = []
        new_unmatched: list[Narrator] = []

        def get_or_make_unmatched(name: str) -> Narrator:
            nonlocal unmatched_id
            key = normalize_arabic(name)
            if key in unmatched_created:
                return unmatched_created[key]
            narrator = Narrator(
                id=unmatched_id,
                name=name[:255],
                arabic_name=name[:255],
                aliases=name,
                tabaqah="",
                region="",
                tawthiq="",
                grade="Unmatched isnad name",
                biography="Extracted from a Bukhari isnad; no confident all_rawis match.",
            )
            unmatched_id += 1
            unmatched_created[key] = narrator
            new_unmatched.append(narrator)
            narrators[narrator.id] = narrator
            return narrator

        def score_name(query: str, candidate: Narrator) -> float:
            q_norm = normalize_arabic(query)
            q_tokens = set(distinctive_tokens(q_norm))
            cand_norm = " ".join(
                filter(
                    None,
                    [
                        normalize_arabic(candidate.arabic_name),
                        normalize_arabic(candidate.name),
                        normalize_arabic(candidate.aliases),
                    ],
                )
            )
            c_tokens = set(distinctive_tokens(cand_norm))
            if not q_tokens:
                return 0.0
            overlap = len(q_tokens & c_tokens)
            if overlap == 0:
                if q_norm and q_norm in cand_norm:
                    return 0.6
                return 0.0
            score = overlap / len(q_tokens)
            if q_norm == normalize_arabic(candidate.arabic_name):
                score += 0.5
            return score

        def match_name(query: str, previous: Narrator | None) -> tuple[Narrator | None, bool]:
            q_norm = normalize_arabic(query)
            if q_norm in PROPHET_KEYS or "رسول الله" in q_norm or q_norm == "النبي":
                return narrators.get(PROPHET_ID), False

            pool: list[int] = []
            used_teachers = False
            if previous is not None and q_norm in FATHER_KEYS:
                parent_ids = [int(x) for x in PARENT_ID_RE.findall(previous.parents)]
                teacher_ids = parse_id_list(previous.teachers_inds)
                pool = [pid for pid in parent_ids if pid in narrators] or [
                    tid for tid in teacher_ids if tid in narrators
                ]
                used_teachers = True
            elif previous is not None:
                pool = [tid for tid in parse_id_list(previous.teachers_inds) if tid in narrators]
                used_teachers = bool(pool)

            def best_in(ids: list[int]) -> tuple[Narrator | None, float]:
                winner = None
                best = 0.0
                for sid in ids:
                    candidate = narrators.get(sid)
                    if candidate is None:
                        continue
                    current = score_name(query, candidate)
                    if current > best:
                        best = current
                        winner = candidate
                return winner, best

            if pool:
                winner, best = best_in(pool)
                if winner and best >= 0.45:
                    return winner, True

            exact_ids = norm_index.get(q_norm, [])
            if len(exact_ids) == 1:
                return narrators.get(exact_ids[0]), False
            if exact_ids:
                winner, best = best_in(exact_ids)
                if winner and best >= 0.5:
                    return winner, used_teachers

            tokens = distinctive_tokens(q_norm)
            candidate_ids: set[int] | None = None
            for token in tokens:
                posting = token_index.get(token)
                if not posting:
                    continue
                candidate_ids = posting if candidate_ids is None else candidate_ids & posting
            if not candidate_ids and tokens:
                candidate_ids = set()
                for token in tokens:
                    candidate_ids |= token_index.get(token, set())
            if candidate_ids:
                winner, best = best_in(list(candidate_ids)[:400])
                if winner and best >= 0.7:
                    return winner, False
            return None, False

        bukhari = narrators.get(BUKHARI_ID)
        prophet = narrators.get(PROPHET_ID)

        for hadith, chains in zip(hadiths, parsed_chains, strict=True):
            sequence = 0
            for chain in chains:
                student = bukhari
                for name, term in chain:
                    matched_narrator, via_teacher = match_name(name, student)
                    if matched_narrator is None:
                        matched_narrator = get_or_make_unmatched(name)
                        unmatched += 1
                    else:
                        matched += 1
                        if via_teacher:
                            teacher_hits += 1
                    if student is not None and matched_narrator.id != student.id:
                        edges.append(
                            TransmissionEdge(
                                teacher=matched_narrator,
                                student=student,
                                hadith=hadith,
                                terminology=term[:100],
                                sequence=sequence,
                            )
                        )
                        sequence += 1
                    student = matched_narrator
                if (
                    prophet is not None
                    and student is not None
                    and student.id != PROPHET_ID
                    and "رسول الله" in normalize_arabic(hadith.arabic_isnad + " " + hadith.arabic_matn[:80])
                ):
                    # Only attach the Prophet when the isnad actually reaches him
                    if any("رسول الله" in normalize_arabic(name) or "النبي" in normalize_arabic(name) for name, _ in chain):
                        pass
                    elif any(normalize_arabic(name) in PROPHET_KEYS for name, _ in chain):
                        pass

        if new_unmatched:
            Narrator.objects.bulk_create(new_unmatched, batch_size=500)

        TransmissionEdge.objects.bulk_create(edges, batch_size=1000)
        return {
            "hadiths": len(hadiths),
            "edges": len(edges),
            "matched": matched,
            "unmatched": unmatched,
            "teacher_hits": teacher_hits,
        }
