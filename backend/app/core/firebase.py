import logging
import os

import firebase_admin
from firebase_admin import credentials

from app.core.config import settings

logger = logging.getLogger(__name__)


def init_firebase():
    if firebase_admin._apps:
        return
    path = settings.firebase_service_account_path
    if not os.path.exists(path):
        logger.warning("Firebase service account not found at %s; skipping init", path)
        return
    cred = credentials.Certificate(path)
    firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
