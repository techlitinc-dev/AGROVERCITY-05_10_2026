"""Create (or update) a Firebase email/password user and grant admin claims.

Usage:
    python scripts/create_admin.py <email> [password]

Idempotent: an existing user keeps their UID — the password is updated when
given and the admin claim is (re)applied. Without a password argument a random
one is generated and printed once.

Prerequisite: the Email/Password provider must be enabled in the Firebase
console (Authentication → Sign-in method) for the project in
`secrets/firebase-service-account.json`.
"""
import secrets
import string
import sys

import firebase_admin.auth as firebase_auth

from app.core.firebase import init_firebase


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: python scripts/create_admin.py <email> [password]")
        sys.exit(1)
    email = sys.argv[1]
    if len(sys.argv) > 2:
        password = sys.argv[2]
    else:
        alphabet = string.ascii_letters + string.digits
        password = "".join(secrets.choice(alphabet) for _ in range(14))
    if len(password) < 6:
        print("firebase requires passwords of at least 6 characters")
        sys.exit(1)

    init_firebase()
    try:
        user = firebase_auth.get_user_by_email(email)
        firebase_auth.update_user(user.uid, password=password)
        uid = user.uid
        print(f"existing user {email} ({uid}) — password updated")
    except firebase_auth.UserNotFoundError:
        user = firebase_auth.create_user(email=email, password=password)
        uid = user.uid
        print(f"created user {email} ({uid})")

    firebase_auth.set_custom_user_claims(uid, {"admin": True})
    print(f"admin claim set for {uid}")
    print(f"sign in at the admin console with: {email} / {password}")


if __name__ == "__main__":
    main()
