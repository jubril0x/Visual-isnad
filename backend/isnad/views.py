from django.db.models import IntegerField, Q
from django.db.models.functions import Cast
from rest_framework import viewsets
from rest_framework.exceptions import NotFound

from .models import Hadith, Narrator, TransmissionEdge
from .serializers import HadithSerializer, NarratorSerializer, TransmissionEdgeSerializer


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


class HadithViewSet(viewsets.ModelViewSet):
    queryset = Hadith.objects.annotate(_num=Cast("hadith_number", IntegerField())).order_by("_num", "id")
    serializer_class = HadithSerializer

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field)
        hadith = resolve_hadith_lookup(lookup)
        if hadith is None:
            raise NotFound("Hadith not found.")
        return hadith

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        number = self.request.query_params.get("hadith_number")
        if number:
            queryset = queryset.filter(hadith_number=number)
        if search:
            queryset = queryset.filter(
                Q(hadith_number__icontains=search)
                | Q(topic__icontains=search)
                | Q(chapter_title__icontains=search)
                | Q(arabic_matn__icontains=search)
                | Q(english_matn__icontains=search)
            )
        return queryset


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
