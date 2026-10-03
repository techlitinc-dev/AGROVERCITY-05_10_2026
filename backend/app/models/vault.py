from typing import Literal

from pydantic import BaseModel


class VaultDocumentOut(BaseModel):
    id: str
    docType: Literal["aadhaar", "712", "bankPassbook", "soilHealthCard", "other"]
    fileName: str
    downloadUrl: str
    uploadedAt: str
    sizeBytes: int
