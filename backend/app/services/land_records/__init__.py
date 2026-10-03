import os

from app.services.land_records.base import LandRecordsAdapter
from app.services.land_records.mock_adapter import MockAdapter

_ADAPTERS = {
    "mock": MockAdapter,
}


def get_adapter() -> LandRecordsAdapter:
    name = os.getenv("LAND_RECORDS_ADAPTER", "mock")
    if name not in _ADAPTERS:
        raise ValueError(f"unknown LAND_RECORDS_ADAPTER: {name}")
    return _ADAPTERS[name]()
