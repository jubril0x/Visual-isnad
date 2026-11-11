import re
from collections import defaultdict

from django.core.cache import cache
from django.db.models import Count, Q
from django.db.models.functions import Left
from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .bukhari_books import BUKHARI_BOOKS
from .permissions import StaffWritePermission
from .models import Hadith, Narrator, TransmissionEdge
from .serializers import (
    COMPACT_NARRATOR_FIELDS,
    CompactNarratorSerializer,
    HadithListSerializer,
    HadithSerializer,
    NarratorSerializer,
    TransmissionEdgeSerializer,
)

BOOKS_CACHE_KEY = "hadith_books_catalog"
COMPACT_TRUE = {"1", "true", "yes"}

BOOK_REF_RE = re.compile(r"Book\s+(\d+)", re.I)


def hadith_by_pk(hadith_ref: str | None) -> Hadith | None:
    if not hadith_ref:
        return None
    return Hadith.objects.filter(pk=hadith_ref).first()


def hadith_by_number(hadith_ref: str | None) -> Hadith | None:
    if not hadith_ref:
        return None
    return Hadith.objects.filter(hadith_number=str(hadith_ref)).first()


def resolve_hadith_lookup(lookup: str | None) -> Hadith | None:
    """Detail URLs: printed Bukhari number first, then database pk."""
    return hadith_by_number(lookup) or hadith_by_pk(lookup)


def chain_payload(hadith: Hadith) -> dict:
    edges = list(
        TransmissionEdge.objects.filter(hadith=hadith)
        .order_by("sequence")
        .only("id", "teacher_id", "student_id", "hadith_id", "terminology", "sequence")
    )
    narrator_ids = {edge.teacher_id for edge in edges} | {edge.student_id for edge in edges}
    narrators = Narrator.objects.filter(id__in=narrator_ids).only(*COMPACT_NARRATOR_FIELDS)
    return {
        "narrators": CompactNarratorSerializer(narrators, many=True).data,
        "edges": TransmissionEdgeSerializer(edges, many=True).data,
    }


def book_catalog() -> list[dict]:
    cached = cache.get(BOOKS_CACHE_KEY)
    if cached is not None:
        return cached

    counted = list(
        Hadith.objects.exclude(book_number=None)
        .values("book_number")
        .annotate(count=Count("id"))
        .order_by("book_number")
    )
    counts: dict[int, int] = {int(row["book_number"]): int(row["count"]) for row in counted}

    if not counts:
        fallback: dict[int, int] = defaultdict(int)
        for ref in Hadith.objects.values_list("in_book_reference", flat=True).iterator(chunk_size=2000):
            match = BOOK_REF_RE.search(ref or "")
            if match:
                fallback[int(match.group(1))] += 1
        counts = fallback

    catalog = []
    for number in sorted(counts):
        title, arabic = BUKHARI_BOOKS.get(number, (f"Book {number}", ""))
        catalog.append(
            {
                "number": number,
                "title": title,
                "title_arabic": arabic,
                "count": counts[number],
            }
        )
    cache.set(BOOKS_CACHE_KEY, catalog, 60 * 60)
    return catalog


def staff_session_payload(user):
    if not user.is_authenticated:
        return {"authenticated": False, "can_edit_biographies": False, "username": "", "initials": ""}
    name = user.get_username()
    parts = [part for part in name.replace(".", " ").replace("_", " ").split() if part]
    initials = (parts[0][:2] if len(parts) == 1 else f"{parts[0][0]}{parts[1][0]}").upper() if parts else "ED"
    return {
        "authenticated": True,
        "can_edit_biographies": bool(user.is_staff),
        "username": name,
        "initials": initials,
    }


def auth_payload(request, user):
    payload = staff_session_payload(user)
    # The editor page cannot read a CSRF cookie set by the API host.
    payload["csrfToken"] = get_token(request)
    return payload


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def auth_me(request):
    return Response(auth_payload(request, request.user))


@api_view(["POST"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def auth_login(request):
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""
    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_staff or not user.is_active:
        return Response({"detail": "Staff sign-in is required to edit biographies."}, status=403)
    login(request, user)
    return Response(auth_payload(request, user))


@api_view(["POST"])
@permission_classes([AllowAny])
def auth_logout(request):
    logout(request)
    return Response(auth_payload(request, request.user))


class NarratorViewSet(viewsets.ModelViewSet):
    queryset = Narrator.objects.all()
    serializer_class = NarratorSerializer
    permission_classes = [StaffWritePermission]

    def get_serializer_class(self):
        if self.action == "list":
            return CompactNarratorSerializer
        return NarratorSerializer

    def get_queryset(self):
        queryset = super().get_queryset().order_by("id")
        if self.action == "list":
            queryset = queryset.only(*COMPACT_NARRATOR_FIELDS)
        search = self.request.query_params.get("search")
        hadith_number = self.request.query_params.get("hadith_number")
        hadith_id = self.request.query_params.get("hadith_id")
        hadith = hadith_by_number(hadith_number) if hadith_number else hadith_by_pk(hadith_id)
        if (hadith_number or hadith_id) and hadith is None:
            return queryset.none()
        if hadith:
            edge_qs = TransmissionEdge.objects.filter(hadith=hadith)
            narrator_ids = set(edge_qs.values_list("teacher_id", flat=True)) | set(
                edge_qs.values_list("student_id", flat=True)
            )
            queryset = queryset.filter(id__in=narrator_ids)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(arabic_name__icontains=search)
                | Q(aliases__icontains=search)
            )
        return queryset


class FlexiblePagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 600


class HadithViewSet(viewsets.ModelViewSet):
    queryset = Hadith.objects.order_by("id")
    serializer_class = HadithSerializer
    pagination_class = FlexiblePagination
    permission_classes = [StaffWritePermission]

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field)
        hadith = resolve_hadith_lookup(lookup)
        if hadith is None:
            raise NotFound("Hadith not found.")
        return hadith

    def get_serializer_class(self):
        compact = self.request.query_params.get("compact")
        if self.action == "list" and compact in {"1", "true", "yes"}:
            return HadithListSerializer
        return HadithSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        number = self.request.query_params.get("hadith_number")
        book = self.request.query_params.get("book")
        compact = self.request.query_params.get("compact") in COMPACT_TRUE
        if number:
            queryset = queryset.filter(hadith_number=number)
        if book and str(book).isdigit():
            queryset = queryset.filter(
                Q(book_number=int(book)) | Q(in_book_reference__startswith=f"Book {book},")
            )
        elif book:
            queryset = queryset.filter(in_book_reference__startswith=f"Book {book},")
        if search:
            queryset = queryset.filter(
                Q(hadith_number__icontains=search)
                | Q(topic__icontains=search)
                | Q(chapter_title__icontains=search)
            )
        if self.action == "list" and compact:
            queryset = queryset.defer(
                "arabic_isnad",
                "arabic_matn",
                "arabic_full",
                "reference_url",
            ).annotate(_preview=Left("english_matn", 80))
        return queryset

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        data = HadithSerializer(instance).data
        if request.query_params.get("chain") in COMPACT_TRUE:
            data.update(chain_payload(instance))
        return Response(data)

    @action(detail=False, methods=["get"], url_path="books")
    def books(self, request):
        return Response(book_catalog())

    @action(detail=False, methods=["get"], url_path="bootstrap")
    def bootstrap(self, request):
        books = book_catalog()
        first = (
            Hadith.objects.filter(hadith_number="1").first()
            or Hadith.objects.order_by("id").first()
        )
        if first is None:
            return Response({"books": books, "hadith": None, "narrators": [], "edges": []})
        payload = HadithSerializer(first).data
        chain = chain_payload(first)
        payload.update(chain)
        return Response({"books": books, "hadith": payload, **chain})


class TransmissionEdgeViewSet(viewsets.ModelViewSet):
    queryset = TransmissionEdge.objects.all()
    serializer_class = TransmissionEdgeSerializer
    permission_classes = [StaffWritePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        hadith_number = self.request.query_params.get("hadith_number")
        hadith_id = self.request.query_params.get("hadith_id")
        hadith = hadith_by_number(hadith_number) if hadith_number else hadith_by_pk(hadith_id)
        if hadith_number or hadith_id:
            if hadith is None:
                return queryset.none()
            queryset = queryset.filter(hadith=hadith).order_by("sequence")
        return queryset
