"""Per-doc-type KYC extraction schemas (phase-07 WS-02, brief M11).

The Aadhaar schema rejects any unmasked 12-digit Aadhaar — only
`XXXX-XXXX-1234` is accepted (global rule 11)."""
import re

from pydantic import BaseModel, field_validator

AADHAAR_MASKED_RE = re.compile(r"^XXXX-XXXX-\d{4}$")
DIGITS_12_RE = re.compile(r"\d{12}")


class KYCAadhaarExtract(BaseModel):
    name: str
    dob: str
    maskedAadhaar: str

    @field_validator("maskedAadhaar")
    @classmethod
    def _masked_only(cls, value: str) -> str:
        if DIGITS_12_RE.search(re.sub(r"[\s-]", "", value)):
            raise ValueError("unmasked Aadhaar is never accepted")
        if not AADHAAR_MASKED_RE.match(value):
            raise ValueError("maskedAadhaar must match XXXX-XXXX-1234")
        return value


class KYCLand712Extract(BaseModel):
    ownerName: str
    surveyNumber: str
    district: str
    area: str


class KYCMandiLicenseExtract(BaseModel):
    licenseNumber: str
    holderName: str
    validUntil: str


# Vault `docType` -> extraction model. Doc types without a model skip AI
# extraction (no fabricated fields).
DOC_TYPE_SCHEMAS: dict[str, type[BaseModel]] = {
    "aadhaar": KYCAadhaarExtract,
    "712": KYCLand712Extract,
    "mandi_license": KYCMandiLicenseExtract,
}

# The field that carries the holder's name for profile-consistency checks.
NAME_FIELD = {
    "aadhaar": "name",
    "712": "ownerName",
    "mandi_license": "holderName",
}


def schema_defaults(doc_type: str) -> dict:
    model = DOC_TYPE_SCHEMAS.get(doc_type)
    if model is None:
        return {}
    return {name: "" for name in model.model_fields}


def parse_extract(doc_type: str, raw: dict) -> dict | None:
    """Validate `raw` against the doc type's model; None when there is no model
    or validation fails."""
    model = DOC_TYPE_SCHEMAS.get(doc_type)
    if model is None:
        return None
    try:
        return model(**{name: raw.get(name, "") for name in model.model_fields}).model_dump()
    except Exception:  # noqa: BLE001 — invalid extraction routes to the human queue
        return None
