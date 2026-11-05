from rest_framework.permissions import SAFE_METHODS, BasePermission


class StaffWritePermission(BasePermission):
    """Anyone may read. Only Django staff may create, update, or delete."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff)
