from django.contrib import admin
from .models import Narrator, Hadith, TransmissionEdge

admin.site.register(Narrator)
admin.site.register(Hadith)
admin.site.register(TransmissionEdge)