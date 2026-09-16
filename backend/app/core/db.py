import os
from typing import Any

from google.cloud import firestore
from google.oauth2 import service_account

from app.core.config import settings

_client = None


def get_db():
    global _client
    if _client is None:
        path = settings.firebase_service_account_path
        if os.path.exists(path):
            creds = service_account.Credentials.from_service_account_file(path)
            _client = firestore.AsyncClient(project=settings.firebase_project_id, credentials=creds)
        else:
            _client = firestore.AsyncClient(project=settings.firebase_project_id)
    return _client


async def get_doc(collection: str, doc_id: str) -> dict | None:
    snap = await get_db().collection(collection).document(doc_id).get()
    return snap.to_dict() if snap.exists else None


async def set_doc(collection: str, doc_id: str, data: dict):
    await get_db().collection(collection).document(doc_id).set(data)


async def delete_doc(collection: str, doc_id: str):
    await get_db().collection(collection).document(doc_id).delete()


async def query(collection: str, filters: list[tuple[str, str, Any]], limit: int = 100) -> list[dict]:
    q = get_db().collection(collection)
    for field, op, value in filters:
        q = q.where(field, op, value)
    return [doc.to_dict() async for doc in q.limit(limit).stream()]
