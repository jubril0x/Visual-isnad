from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import HadithViewSet, NarratorViewSet, TransmissionEdgeViewSet, auth_login, auth_logout, auth_me

router = DefaultRouter()
router.register("narrators", NarratorViewSet)
router.register("hadiths", HadithViewSet)
router.register("edges", TransmissionEdgeViewSet)

urlpatterns = [
    path("auth/me/", auth_me),
    path("auth/login/", auth_login),
    path("auth/logout/", auth_logout),
    path("", include(router.urls)),
]
