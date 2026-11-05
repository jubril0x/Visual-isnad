import html as html_lib
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

from django.conf import settings

UA = "VisualIsnad/1.0 (local educational app; importing public scholar biographies)"
BIO_RE = re.compile(r"<div[^>]*id=['\"]bio\d+['\"][^>]*>(.*?)</div>", re.I | re.S)
HIDESHOW_RE = re.compile(r"<div[^>]*id=['\"]hideshow\d+['\"][^>]*>(.*?)</div>", re.I | re.S)
INTERESTS_RE = re.compile(r"Tafsir/Quran|Narrator\[Grade:")
ARABIC_CHAR_RE = re.compile(r"[\u0600-\u06FF]")
LATIN_CHAR_RE = re.compile(r"[A-Za-z]")
UNMATCHED_ID_START = 800000


def looks_like_interests(text: str) -> bool:
    return bool(INTERESTS_RE.search(text or "")) and "." not in (text or "")[:80]


def is_mostly_arabic(text: str) -> bool:
    arabic = len(ARABIC_CHAR_RE.findall(text or ""))
    latin = len(LATIN_CHAR_RE.findall(text or ""))
    if arabic < 12:
        return False
    return arabic >= latin


def is_english_biography(text: str) -> bool:
    cleaned = (text or "").strip()
    if not cleaned or looks_like_interests(cleaned):
        return False
    if cleaned.lower() in {"na", "n/a", "none", "-"}:
        return False
    if "Rate this translation" in cleaned:
        return False
    return not is_mostly_arabic(cleaned)


def html_to_text(chunk: str) -> str:
    chunk = re.sub(r"<br\s*/?>", "\n", chunk, flags=re.I)
    chunk = re.sub(r"</p>", "\n", chunk, flags=re.I)
    chunk = re.sub(r"<hr\s*/?>", "\n\n", chunk, flags=re.I)
    chunk = re.sub(r"<[^>]+>", "", chunk)
    chunk = html_lib.unescape(chunk)
    chunk = re.sub(r"\r\n?", "\n", chunk)
    chunk = re.sub(r"[ \t]+\n", "\n", chunk)
    chunk = re.sub(r"\n{3,}", "\n\n", chunk)
    return chunk.strip()


def extract_brief_biography(page_html: str) -> str:
    match = BIO_RE.search(page_html)
    if match:
        text = html_to_text(match.group(1))
        cut = re.search(r"\nLast Updated:", text)
        if cut:
            text = text[: cut.start()].strip()
        if is_english_biography(text):
            return text
    return extract_resource_biography(page_html)


def extract_resource_biography(page_html: str) -> str:
    match = HIDESHOW_RE.search(page_html)
    if not match:
        return ""
    english_parts = []
    for part in re.split(r"<hr\s*/?>", match.group(1), flags=re.I):
        text = html_to_text(part)
        if not text or text.startswith("Names used"):
            continue
        if not is_english_biography(text) or len(text) < 60:
            continue
        english_parts.append(text)
    if not english_parts:
        return ""
    english_parts.sort(key=len, reverse=True)
    text = english_parts[0]
    if len(text) > 3200:
        text = text[:3180].rsplit(" ", 1)[0] + "…"
    return text


def cache_path() -> Path:
    return Path(settings.BASE_DIR).parent / "data" / "muslimscholars_bios.json"


def load_cache() -> dict:
    path = cache_path()
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_cache(cache: dict) -> None:
    path = cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")


def fetch_page(scholar_id: int) -> str:
    url = f"https://muslimscholars.info/manage.php?ID={scholar_id}&submit=scholar"
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.read().decode("utf-8", "replace")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise last_error  # type: ignore[misc]


def fetch_biography(scholar_id: int) -> str:
    return extract_brief_biography(fetch_page(scholar_id))
