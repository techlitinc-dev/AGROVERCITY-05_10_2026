"""Phase-07 WS-06 task 6.10 — course report numbers are a stable regression."""
from tests.test_admin import _seed_admin, admin_headers


async def test_course_report_numbers_stable(client, user_store):
    admin_token = _seed_admin(user_store)
    user_store["courses/c1"] = {"id": "c1", "title": "Drip Irrigation", "status": "published"}
    user_store["course_purchases/p1"] = {
        "id": "p1", "status": "paid", "amountRupees": 1000, "commissionPercent": 15,
    }
    user_store["course_purchases/p2"] = {
        "id": "p2", "status": "paid", "amountRupees": 2000, "commissionPercent": 15,
    }
    resp = await client.get("/v1/admin/courses/report", headers=admin_headers(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["totalCourses"] == 1
    assert body["totalSales"] == 2
    assert body["grossMerchandiseValueRupees"] == 3000.0
    assert body["platformCommissionRupees"] == 450.0
    assert body["instructorEarningsRupees"] == 2550.0
