import re
from collections import defaultdict

from django.db.models import IntegerField, Q
from django.db.models.functions import Cast
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .bukhari_books import BUKHARI_BOOKS
from .models import Hadith, Narrator, TransmissionEdge
from .serializers import (
    HadithListSerializer,
    HadithSerializer,
    NarratorSerializer,
    TransmissionEdgeSerializer,
)

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


class NarratorViewSet(viewsets.ModelViewSet):
    queryset = Narrator.objects.all()
    serializer_class = NarratorSerializer

    def get_queryset(self):
        queryset = super().get_queryset().order_by("id")
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
    queryset = Hadith.objects.annotate(_num=Cast("hadith_number", IntegerField())).order_by("_num", "id")
    serializer_class = HadithSerializer
    pagination_class = FlexiblePagination

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
        if number:
            queryset = queryset.filter(hadith_number=number)
        if book:
            queryset = queryset.filter(in_book_reference__startswith=f"Book {book},")
        if search:
            queryset = queryset.filter(
                Q(hadith_number__icontains=search)
                | Q(topic__icontains=search)
                | Q(chapter_title__icontains=search)
                | Q(arabic_matn__icontains=search)
                | Q(english_matn__icontains=search)
            )
        return queryset

    @action(detail=False, methods=["get"], url_path="books")
    def books(self, request):
        counts = defaultdict(int)
        chapters = {}
        for ref, chapter, arabic in Hadith.objects.values_list(
            "in_book_reference", "chapter_title", "chapter_title_arabic"
        ):
            match = BOOK_REF_RE.search(ref or "")
            if not match:
                continue
            number = int(match.group(1))
            counts[number] += 1
            chapters.setdefault(number, (chapter or "", arabic or ""))

        catalog = []
        for number in sorted(counts):
            title, arabic = BUKHARI_BOOKS.get(number, (f"Book {number}", ""))
            first_chapter, first_arabic = chapters.get(number, ("", ""))
            catalog.append(
                {
                    "number": number,
                    "title": title,
                    "title_arabic": arabic,
                    "count": counts[number],
                    "first_chapter": first_chapter,
                    "first_chapter_arabic": first_arabic,
                }
            )
        return Response(catalog)


class TransmissionEdgeViewSet(viewsets.ModelViewSet):
    queryset = TransmissionEdge.objects.select_related("teacher", "student", "hadith").all()
    serializer_class = TransmissionEdgeSerializer

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
