from app.services.bank_verify.base import BankVerifyAdapter


class StubBankVerifyAdapter(BankVerifyAdapter):
    async def penny_drop(self, account_number: str, ifsc: str, account_holder: str) -> dict:
        return {"verified": True, "accountHolderMatch": True}
