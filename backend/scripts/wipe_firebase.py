"""Wipe all Firestore data and Firebase Auth users for a clean zero-data test.

Usage:
    cd backend && .venv/bin/python scripts/wipe_firebase.py

Requires the service account at settings.firebase_service_account_path.
Destructive and irreversible — there is no backup. Use with care.
"""

import sys

sys.path.insert(0, ".")

from app.core.config import settings


def wipe_firestore(db) -> int:
    deleted = 0
    for collection in db.collections():
        n_before = deleted
        deleted += db.recursive_delete(collection)
        print(f"  deleted collection {collection.id} ({deleted - n_before} docs)")
    return deleted


def wipe_auth() -> int:
    from firebase_admin import auth

    deleted = 0
    page = auth.list_users()
    while page:
        uids = [u.uid for u in page.users]
        if uids:
            result = auth.delete_users(uids)
            deleted += result.success_count
            if result.failure_count:
                print(f"  WARNING: {result.failure_count} auth users failed to delete: {result.errors}")
        page = page.get_next_page()
    return deleted


def main():
    from google.cloud import firestore
    from google.oauth2 import service_account

    import firebase_admin
    from firebase_admin import credentials

    cred = credentials.Certificate(settings.firebase_service_account_path)
    firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
    creds = service_account.Credentials.from_service_account_file(settings.firebase_service_account_path)
    db = firestore.Client(project=settings.firebase_project_id, credentials=creds)

    print(f"Target project: {settings.firebase_project_id}")
    print("Wiping Firestore (all collections, recursively)...")
    n_docs = wipe_firestore(db)
    print(f"Firestore: {n_docs} documents deleted.")

    print("Wiping Firebase Auth users...")
    n_users = wipe_auth()
    print(f"Auth: {n_users} users deleted.")

    remaining = [c.id for c in db.collections()]
    print(f"Remaining collections: {len(remaining)} {remaining if remaining else ''}")


if __name__ == "__main__":
    main()
