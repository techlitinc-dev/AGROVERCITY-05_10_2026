from typing import Literal

from pydantic import BaseModel

CALL_CONTEXT_TYPES = (
    "transport_booking",
    "vehicle",
    "offer",
    "purchase",
    "resale_listing",
    "quote",
    "export_order",
)


class CallRequest(BaseModel):
    toUserId: str
    contextType: Literal[
        "transport_booking",
        "vehicle",
        "offer",
        "purchase",
        "resale_listing",
        "quote",
        "export_order",
    ]
    contextId: str
