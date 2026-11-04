from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import HadithViewSet, NarratorViewSet, TransmissionEdgeViewSet

router = DefaultRouter()
router.register("narrators", NarratorViewSet)
router.register("hadiths", HadithViewSet)
router.register("edges", TransmissionEdgeViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
