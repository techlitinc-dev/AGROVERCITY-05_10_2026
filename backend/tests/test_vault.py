from unittest.mock import Mock

from tests.test_diary import auth, seed_user

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * (1024 - 8)


def _fake_storage(monkeypatch):
    monkeypatch.setattr(
        "app.services.storage.upload_user_file",
        lambda uid, data, filename, content_type, prefix="vault": (
            f"{prefix}/{uid}/fake_{filename}",
            len(data),
        ),
    )
    monkeypatch.setattr(
        "app.services.storage.signed_download_url",
        lambda blob_path, minutes=60: f"https://storage.example.com/{blob_path}?sig=x",
    )
    monkeypatch.setattr("app.services.storage.delete_blob", lambda blob_path: None)


def _upload(client, token, content=PNG_BYTES, content_type="image/png", doc_type="aadhaar"):
    return client.post(
        "/v1/vault/documents",
        files={"file": ("test.png", content, content_type)},
        data={"docType": doc_type},
        headers=auth(token),
    )


async def test_upload_png_201(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = seed_user(user_store)
    resp = await _upload(client, token)
    assert resp.status_code == 201
    body = resp.json()
    assert body["docType"] == "aadhaar"
    assert body["downloadUrl"]
    assert body["sizeBytes"] == 1024
    assert "aadhaarNumber" not in str(body)


async def test_reject_text_file_415(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = seed_user(user_store)
    resp = await _upload(client, token, content=b"hello", content_type="text/plain")
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"


async def test_reject_oversize_413(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = seed_user(user_store)
    resp = await _upload(client, token, content=b"\x00" * (6 * 1024 * 1024))
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "FILE_TOO_LARGE"


async def test_delete_204_then_absent(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = seed_user(user_store)
    doc_id = (await _upload(client, token)).json()["id"]
    resp = await client.delete(f"/v1/vault/documents/{doc_id}", headers=auth(token))
    assert resp.status_code == 204
    resp = await client.get("/v1/vault/documents", headers=auth(token))
    assert resp.json()["total"] == 0
    resp = await client.delete(f"/v1/vault/documents/{doc_id}", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DOCUMENT_NOT_FOUND"


async def test_logger_never_logs_bytes(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    mock_logger = Mock()
    monkeypatch.setattr("app.routers.vault.logger", mock_logger)
    token = seed_user(user_store)
    secret = b"AADHAAR-SECRET-MARKER" + b"\x00" * 1000
    resp = await _upload(client, token, content=secret)
    assert resp.status_code == 201
    assert mock_logger.info.called
    for call in mock_logger.info.call_args_list:
        for arg in call.args + tuple(call.kwargs.values()):
            assert not isinstance(arg, bytes)
            assert "AADHAAR-SECRET-MARKER" not in str(arg)
