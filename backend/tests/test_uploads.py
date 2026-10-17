from app.services.tokens import create_access_token


def auth(token):
    return {"Authorization": f"Bearer {token}"}


FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
FAKE_PDF = b"%PDF-1.4" + b"\x00" * 16
FAKE_MP3 = b"ID3" + b"\x00" * 16


def _patch_storage(monkeypatch):
    def fake_upload(uid, data, filename, content_type, prefix="vault"):
        return f"{prefix}/{uid}/{filename}", len(data)

    monkeypatch.setattr("app.services.storage.upload_user_file", fake_upload)
    monkeypatch.setattr(
        "app.services.storage.signed_download_url",
        lambda blob_path, minutes=60: f"https://cdn.example/{blob_path}",
    )


async def test_upload_files(client, monkeypatch):
    _patch_storage(monkeypatch)
    token = create_access_token("uid-1")
    resp = await client.post(
        "/v1/uploads",
        files=[
            ("files", ("thumb.png", FAKE_PNG, "image/png")),
            ("files", ("notes.pdf", FAKE_PDF, "application/pdf")),
        ],
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    first, second = body
    assert first["url"].startswith("https://cdn.example/uploads/uid-1/")
    assert first["url"].endswith(".png")
    assert first["storagePath"].startswith("uploads/uid-1/")
    assert first["contentType"] == "image/png"
    assert first["sizeBytes"] == len(FAKE_PNG)
    assert second["url"].endswith(".pdf")
    assert second["contentType"] == "application/pdf"
    assert second["sizeBytes"] == len(FAKE_PDF)


async def test_upload_podcast_audio_accepted(client, monkeypatch):
    _patch_storage(monkeypatch)
    token = create_access_token("uid-1")
    resp = await client.post(
        "/v1/uploads",
        files=[("files", ("episode1.mp3", FAKE_MP3, "audio/mpeg"))],
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["url"].endswith(".mp3")
    assert body[0]["contentType"] == "audio/mpeg"
    assert body[0]["sizeBytes"] == len(FAKE_MP3)


async def test_upload_dev_mode_shim(client):
    # Unpatched storage: dev mode writes to .local_uploads and returns file:// URLs.
    token = create_access_token("uid-1")
    resp = await client.post(
        "/v1/uploads",
        files=[("files", ("thumb.png", FAKE_PNG, "image/png"))],
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body[0]["url"].startswith("file://")
    assert body[0]["url"].endswith(body[0]["storagePath"].split("/")[-1])
    assert body[0]["sizeBytes"] == len(FAKE_PNG)


async def test_upload_requires_auth(client, monkeypatch):
    _patch_storage(monkeypatch)
    resp = await client.post(
        "/v1/uploads",
        files=[("files", ("a.png", FAKE_PNG, "image/png"))],
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "MISSING_TOKEN"


async def test_upload_too_many_files(client, monkeypatch):
    _patch_storage(monkeypatch)
    token = create_access_token("uid-1")
    resp = await client.post(
        "/v1/uploads",
        files=[("files", (f"p{i}.png", FAKE_PNG, "image/png")) for i in range(6)],
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_upload_bad_mime(client, monkeypatch):
    _patch_storage(monkeypatch)
    token = create_access_token("uid-1")
    resp = await client.post(
        "/v1/uploads",
        files=[("files", ("notes.txt", b"hello", "text/plain"))],
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_upload_file_too_large(client, monkeypatch):
    _patch_storage(monkeypatch)
    token = create_access_token("uid-1")
    big = b"\x00" * (5 * 1024 * 1024 + 1)
    resp = await client.post(
        "/v1/uploads",
        files=[("files", ("big.png", big, "image/png"))],
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
