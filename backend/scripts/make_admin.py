import sys

import firebase_admin.auth as firebase_auth

from app.core.firebase import init_firebase


def main():
    if len(sys.argv) != 2:
        print("usage: python scripts/make_admin.py <uid>")
        sys.exit(1)
    uid = sys.argv[1]
    init_firebase()
    firebase_auth.set_custom_user_claims(uid, {"admin": True})
    print(f"admin claim set for {uid}")


if __name__ == "__main__":
    main()
