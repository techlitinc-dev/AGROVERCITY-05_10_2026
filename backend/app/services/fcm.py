from app.services.notifications import send_fcm_to_user


async def notify(uid: str, title: str, body: str, data: dict):
    await send_fcm_to_user(uid, title, body, data)
