from abc import ABC, abstractmethod

from app.models.land_records import LandRecord712


class LandRecordsAdapter(ABC):
    """Implementations: MockAdapter (dev), MahabhulekhAdapter (prod —
    mahabhulekh.maharashtra.gov.in / Aaple Sarkar; later: Gujarat 7/12,
    Karnataka RTC, UP Khatauni). Swap via env `LAND_RECORDS_ADAPTER`;
    routers never change."""

    @abstractmethod
    def search(
        self,
        gat_number: str | None,
        village: str | None,
        district: str | None,
        record_type: str,
    ) -> list[LandRecord712]:
        ...

    @abstractmethod
    def get_pdf_url(self, record_id: str) -> str | None:
        ...

    @abstractmethod
    def get_by_id(self, record_id: str) -> LandRecord712 | None:
        ...
