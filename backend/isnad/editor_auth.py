from django.contrib.auth import get_user_model
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

SIGNER = TimestampSigner(salt="visual-isnad-editor")
TOKEN_MAX_AGE = 60 * 60 * 24 * 14


def issue_editor_token(user) -> str:
    return SIGNER.sign(str(user.pk))


class EditorTokenAuthentication(BaseAuthentication):
    """Bearer token for the Vercel frontend talking to the Render API."""

    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return None
        token = header[7:].strip()
        if not token:
            return None
        try:
            user_id = SIGNER.unsign(token, max_age=TOKEN_MAX_AGE)
        except SignatureExpired as exc:
            raise AuthenticationFailed("Editor session expired. Sign in again.") from exc
        except BadSignature as exc:
            raise AuthenticationFailed("Invalid editor session.") from exc

        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id, is_active=True, is_staff=True)
        except User.DoesNotExist as exc:
            raise AuthenticationFailed("Invalid editor session.") from exc
        return (user, token)
