"""Locust load test — AI gateway `decide()` path (phase-08 WS-02 task 2.12/2.13).

Drives 100 rps of decision-bearing requests through the HTTP surface that calls
`gateway.decide()` (`GET /v1/tasks/today` ranks tasks via `tasks.rank.v1`).

Budget-trip behaviour to assert (see instructions.md §WS-02 step 5): with
`AI_DAILY_BUDGET_USD` set low the gateway degrades to deterministic fallbacks
with `fallbackUsed` logged — zero 5xx, no caller exceptions.

Run (pair with a low budget so the trip happens mid-run):

    cd backend && AI_PROVIDER=shim AI_DAILY_BUDGET_USD=0.01 \
        .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
    cd backend && .venv/bin/locust -f tests/load/ai_gateway_locustfile.py \
        --headless -u 100 -r 20 -t 3m --host http://localhost:8000
"""
from locust import HttpUser, between, task

from app.services.tokens import create_access_token

# Dev-auth fixture: mint a JWT the same way the test suite does (global rule 8 —
# no privileged bypass; this token is a normal user token).
_DEV_UID = "loadtest-user"
_TOKEN = create_access_token(_DEV_UID)


class GatewayUser(HttpUser):
    wait_time = between(0.0, 0.05)

    def on_start(self):
        self.headers = {"Authorization": f"Bearer {_TOKEN}"}

    def _check(self, response):
        # Hard requirement: the gateway must degrade, never 5xx.
        if response.status_code >= 500:
            response.failure(f"server error {response.status_code}")

    @task(4)
    def tasks_today(self):
        with self.client.get("/v1/tasks/today", headers=self.headers, catch_response=True) as response:
            self._check(response)

    @task(1)
    def health(self):
        with self.client.get("/v1/health", catch_response=True) as response:
            self._check(response)
