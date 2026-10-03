from app.models.land_records import LandRecord712
from app.services.land_records.base import LandRecordsAdapter

_RECORDS = [
    LandRecord712(
        id="rec-1",
        gatNumber="123",
        village="Ozarkhed",
        district="Nashik",
        ownerName="राम सिंह",
        khataNumber="45",
        totalAreaHectares=1.2,
        totalAreaAcres=2.97,
        landClass="जिरायत",
        ferfarNumber="F-102",
        cropHistory="गेहूं, कांदा (2025)",
    ),
    LandRecord712(
        id="rec-2",
        gatNumber="456",
        village="Pimpalgaon",
        district="Nashik",
        ownerName="सीता देवी",
        khataNumber="78",
        totalAreaHectares=0.8,
        totalAreaAcres=1.98,
        landClass="बागायत",
        ferfarNumber="F-204",
        cropHistory="अंगूर (2025)",
    ),
    LandRecord712(
        id="rec-3",
        gatNumber="789",
        village="Dindori",
        district="Nashik",
        ownerName="अर्जुन पाटिल",
        khataNumber="12",
        totalAreaHectares=2.4,
        totalAreaAcres=5.93,
        landClass="जिरायत",
        ferfarNumber="F-318",
        cropHistory="प्याज, टमाटर (2025)",
    ),
]


class MockAdapter(LandRecordsAdapter):
    def search(
        self,
        gat_number: str | None,
        village: str | None,
        district: str | None,
        record_type: str,
    ) -> list[LandRecord712]:
        results = list(_RECORDS)
        if gat_number:
            results = [r for r in results if r.gatNumber == gat_number]
        if village:
            needle = village.lower()
            results = [r for r in results if needle in r.village.lower()]
        if district:
            needle = district.lower()
            results = [r for r in results if needle in r.district.lower()]
        return results

    def get_pdf_url(self, record_id: str) -> str | None:
        if self.get_by_id(record_id) is None:
            return None
        return "https://example.com/sample-712.pdf"

    def get_by_id(self, record_id: str) -> LandRecord712 | None:
        return next((r for r in _RECORDS if r.id == record_id), None)
