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


def verify_app_check_token(token: str) -> bool:
    if not firebase_admin._apps:
        logger.warning("firebase not initialised; cannot verify App Check token")
        return False
    try:
        from firebase_admin import app_check
        app_check.verify_token(token)
        return True
    except Exception:
        return False
