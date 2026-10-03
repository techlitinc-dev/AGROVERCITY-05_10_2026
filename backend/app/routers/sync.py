from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import current_user_id
from app.services import sync as sync_service

router = APIRouter(prefix="/sync", tags=["sync"])


class SyncOperation(BaseModel):
    idempotencyKey: str
    method: str
    path: str
    body: dict = {}
    queuedAt: str | None = None


class SyncBatch(BaseModel):
    operations: list[SyncOperation] = Field(max_length=50)


@router.post("")
async def replay(batch: SyncBatch, uid: str = Depends(current_user_id)):
    results = [await sync_service.dispatch(uid, op.model_dump()) for op in batch.operations]
    return {
        "results": results,
        "applied": sum(1 for r in results if r["status"] == "applied"),
        "duplicates": sum(1 for r in results if r["status"] == "duplicate"),
        "errors": sum(1 for r in results if r["status"] == "error"),
    }
