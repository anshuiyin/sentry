from __future__ import absolute_import

from sentry.models import OrganizationAvatar
from sentry.web.frontend.base import AvatarPhotoView


class OrganizationAvatarPhotoView(AvatarPhotoView):
    model = OrganizationAvatar
